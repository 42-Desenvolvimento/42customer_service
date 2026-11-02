# Envio WhatsApp, recuperacao de sessao e Socket.IO

Este guia descreve o fluxo usado para enviar mensagens pelo WhatsApp,
marcar tickets como lidos, tentar recuperar sessoes desconectadas e notificar
o frontend via Socket.IO. O foco e o comportamento verificado no codigo atual,
especialmente nas alteracoes recentes em envio de midia, `sendSeen` e
autenticacao do socket.

## Codepaths cobertos

- Inicializacao do backend:
  - `backend/src/server.ts`
  - `backend/src/app/index.ts`
- Socket.IO e autenticacao:
  - `backend/src/libs/socket.ts`
  - `backend/src/libs/decodeTokenSocket.ts`
  - `backend/src/helpers/socketEmit.ts`
  - `frontend/src/utils/socket.js`
  - `frontend/src/layouts/socketInitial.js`
  - `frontend/src/pages/atendimento/TicketList.vue`
- Envio e leitura de mensagens:
  - `backend/src/routes/messageRoutes.ts`
  - `backend/src/controllers/MessageController.ts`
  - `backend/src/helpers/SendMessageSystemProxy.ts`
  - `backend/src/helpers/SetTicketMessagesAsRead.ts`
  - `backend/src/services/WbotServices/SendWhatsAppMessage.ts`
  - `backend/src/services/WbotServices/SendWhatsAppMedia.ts`
- Ciclo de vida da sessao WhatsApp:
  - `backend/src/libs/wbot.ts`
  - `backend/src/services/WbotServices/StartAllWhatsAppsSessions.ts`
  - `backend/src/services/WbotServices/StartWhatsAppSession.ts`
  - `backend/src/services/WbotServices/StartWhatsAppSessionVerify.ts`
  - `backend/src/services/WbotServices/wbotMonitor.ts`

## Arquitetura resumida

1. `server.ts` chama o bootstrap da aplicacao.
2. `app/index.ts` cria o servidor HTTP, inicializa o Socket.IO com `initIO` e,
   somente depois disso, chama `StartAllWhatsAppsSessions`.
3. `StartAllWhatsAppsSessions` reabre canais ativos. Para WhatsApp, ignora
   sessoes com status `DISCONNECTED` ou `qrcode`.
4. `initWbot` cria um `Client` do `whatsapp-web.js` com `LocalAuth`, registra
   handlers de `qr`, `authenticated`, `auth_failure` e `ready`, e mantem as
   sessoes em memoria no array local `sessions`.
5. `wbotMonitor` observa `change_state`, `change_battery` e `disconnected`.
   Em desconexao, atualiza a sessao para `OPENING`, limpa campos de sessao/QR
   e agenda `StartWhatsAppSession` apos 2 segundos.

## Fluxo de envio de mensagem

### Texto

`POST /messages/:ticketId` passa por `MessageController.store`, carrega o
ticket e chama `CreateMessageSystemService`. Quando nao ha midia, o proxy
`SendMessageSystemProxy` usa `SendWhatsAppMessage` para tickets WhatsApp.

Restricao atual: `SendWhatsAppMessage` registra o erro e dispara
`ERR_SENDING_WAPP_MSG`, mas a chamada para `StartWhatsAppSessionVerify` esta
comentada. Ou seja, falha no envio de texto nao tenta reabrir a sessao por esse
codepath.

### Midia

Quando ha `mediaName`, `SendMessageSystemProxy` usa `SendWhatsAppMedia` para
WhatsApp. Esse servico:

1. obtem o cliente com `GetTicketWbot`;
2. cria `MessageMedia.fromFilePath(media.path)`;
3. envia para `<numero>@c.us` ou `<numero>@g.us`;
4. atualiza `lastMessage` e `lastMessageAt` do ticket;
5. tenta registrar `UserMessagesLog` quando existe `userId`;
6. remove o arquivo local com `fs.unlinkSync(media.path)`;
7. em erro, chama `StartWhatsAppSessionVerify(ticket.whatsappId, err)` e
   retorna `ERR_SENDING_WAPP_MSG`.

Exemplo do formato de destino WhatsApp usado pelo backend:

```text
5511999999999@c.us  # contato individual
120363000000000000@g.us  # grupo
```

## Marcacao de leitura

`SetTicketMessagesAsRead` e chamado em leituras/listagens e antes de envio pelo
controller de mensagens. O helper:

1. marca mensagens do ticket como `read: true`;
2. zera `ticket.unreadMessages`;
3. para WhatsApp, chama `wbot.sendSeen(...)`;
4. para Messenger, chama `messengerBot.markSeen(...)`;
5. recarrega o ticket com `ShowTicketService`;
6. emite `ticket:update` via `socketEmit`.

Quando `sendSeen` falha no WhatsApp, o `.catch` chama
`StartWhatsAppSessionVerify(ticket.whatsappId, e)` e apenas registra o erro no
console. A atualizacao do ticket e o evento de socket continuam acontecendo.

Ponto de atencao: `MessageController.index` e `MessageController.store` chamam
`SetTicketMessagesAsRead(ticket)` sem `await`. Como a funcao e assincrona, o
`try/catch` do controller nao captura rejeicoes assincronas desse helper.

## Recuperacao de sessao

`StartWhatsAppSessionVerify` tenta recuperar apenas erros conhecidos. O helper
converte o erro para string minuscula e procura:

- `session closed`
- `err_wapp_not_initialized`
- `TypeError: Cannot read property 'sendSeen' of undefined`

Quando encontra um desses sinais, busca a conexao no banco, atualiza o status
para `OPENING`, emite `<tenantId>:whatsappSession` e reinicializa o cliente com
`initWbot`, `wbotMessageListener` e `wbotMonitor`.

Restricoes atuais:

- A constante de `sendSeen` esta com letras maiusculas enquanto o erro recebido
  e comparado em minusculas; por isso esse caso pode nao casar como esperado.
- A recuperacao nao remove entradas antigas do array em memoria `sessions` antes
  de reinicializar.
- Sessoes WhatsApp com status `qrcode` ou `DISCONNECTED` nao sao reiniciadas no
  boot automatico.
- Recuperacao por erro de envio esta ativa para midia e para falha de
  `sendSeen`, mas nao para envio de texto comum.

## Socket.IO por tenant

O backend inicializa o Socket.IO em `backend/src/libs/socket.ts` com:

- CORS liberado para `*`;
- `pingTimeout` de 180 segundos;
- `pingInterval` de 60 segundos;
- adapter Redis via `socket.io-redis`.

Na conexao, o frontend envia o JWT em `handshake.auth.token`
(`frontend/src/utils/socket.js`). O backend valida o token com
`decodeTokenSocket`, injeta `id`, `tenantId` e `user` em
`socket.handshake.auth`, e entao permite a conexao. Tokens ausentes ou invalidos
recebem `authentication error`; no `catch`, o servidor tambem emite
`tokenInvalid:<socket.id>`.

### Eventos registrados no backend

| Evento recebido do cliente | Sala associada |
| --- | --- |
| `<tenantId>:joinChatBox` | `<tenantId>:<ticketId>` |
| `<tenantId>:joinNotification` | `<tenantId>:notification` |
| `<tenantId>:joinTickets` | `<tenantId>:<status>` |

O socket tambem entra automaticamente na sala `<tenantId>` quando a conexao e
autenticada.

### Eventos emitidos pelo backend

| Origem | Evento | Payload |
| --- | --- | --- |
| `socketEmit` | `<tenantId>:ticketList` | `{ type, payload }` |
| `StartWhatsAppSession` / `initWbot` / `wbotMonitor` | `<tenantId>:whatsappSession` | `{ action, session }` |
| `wbotMonitor` | `<tenantId>:change_battery` | `{ action, batteryInfo }` |

`socketEmit` envia para a sala do tenant (`io.to(tenantId.toString())`) e troca
o canal para `<tenantId>:contactList` quando o tipo contem `contact:`.

## Variaveis de ambiente relevantes

| Variavel | Uso |
| --- | --- |
| `JWT_SECRET` | valida o token usado no handshake Socket.IO |
| `IO_REDIS_SERVER` | host do Redis para Socket.IO, filas e sessoes auxiliares |
| `IO_REDIS_PORT` | porta do Redis |
| `IO_REDIS_USERNAME` | usuario do Redis usado pelo adapter Socket.IO |
| `IO_REDIS_PASSWORD` | senha do Redis |
| `IO_REDIS_DB_SESSION` | DB Redis usado por alguns clientes/servicos auxiliares |
| `CHROME_BIN` | caminho do Chrome usado pelo Puppeteer/whatsapp-web.js |
| `CHROME_ARGS` | lista separada por virgula para substituir os argumentos padrao do Chrome |
| `WEB_VERSION` | versao do WhatsApp Web carregada pelo `whatsapp-web.js` |
| `CONNECTIONS_LIMIT` | limite de conexoes cadastravel em `WhatsAppController.store` |

## Troubleshooting

### O frontend conecta, mas tickets nao entram em tempo real

Verifique o prefixo dos eventos. O backend registra eventos como
`<tenantId>:joinTickets` e emite `<tenantId>:ticketList`. Em
`frontend/src/pages/atendimento/TicketList.vue`, parte do fluxo usa
`tenant:<tenantId>:joinTickets` e escuta `tenant:<tenantId>:ticket`, que nao
correspondem aos listeners/emissores atuais do backend.

### Sessao WhatsApp nao reabre depois de falha no envio

Confirme qual caminho falhou:

- midia: `SendWhatsAppMedia` chama `StartWhatsAppSessionVerify`;
- texto: `SendWhatsAppMessage` nao chama recuperacao no codigo atual;
- marcacao de leitura: o `.catch` de `sendSeen` chama recuperacao, mas a
  assinatura do erro de `sendSeen` pode nao casar por diferenca de caixa.

Tambem valide se a sessao nao esta em `qrcode` ou `DISCONNECTED`, pois esses
status sao ignorados por `StartAllWhatsAppsSessions` no boot.

### Eventos de sessao nao chegam ao cliente

1. Confirme que o token JWT esta presente em `localStorage` e e enviado por
   `frontend/src/utils/socket.js`.
2. Verifique se `JWT_SECRET` no backend corresponde ao emissor do token.
3. Confira conectividade com Redis (`IO_REDIS_SERVER` e `IO_REDIS_PORT`), pois o
   adapter e configurado sempre que o Socket.IO sobe.
4. Garanta que o cliente esta ouvindo `<tenantId>:whatsappSession` sem o prefixo
   `tenant:`.

### Mensagens ficam lidas no banco, mas WhatsApp nao recebe `sendSeen`

Esse e um comportamento possivel: `SetTicketMessagesAsRead` atualiza banco e
emite socket mesmo se `sendSeen` falhar. A falha e registrada no console e pode
acionar recuperacao de sessao, mas nao desfaz a marcacao local como lida.
