# WhatsApp: envio, leitura, recuperacao de sessao e Socket.IO

Este documento descreve o fluxo atual de envio de mensagens, marcacao de leitura,
recuperacao de sessoes WhatsApp e eventos Socket.IO. O objetivo e ajudar devs e
operacao a alterar esse caminho sem quebrar notificacoes em tempo real ou deixar
sessoes do `whatsapp-web.js` presas em estado invalido.

## Escopo verificado

| Area | Arquivos principais |
| --- | --- |
| Rotas HTTP de mensagens | `backend/src/routes/messageRoutes.ts` |
| Entrada dos handlers | `backend/src/controllers/MessageController.ts` |
| Criacao e persistencia de mensagens | `backend/src/services/MessageServices/CreateMessageSystemService.ts` |
| Escolha do canal de envio | `backend/src/helpers/SendMessageSystemProxy.ts` |
| Envio WhatsApp texto | `backend/src/services/WbotServices/SendWhatsAppMessage.ts` |
| Envio WhatsApp midia | `backend/src/services/WbotServices/SendWhatsAppMedia.ts` |
| Marcacao como lida | `backend/src/helpers/SetTicketMessagesAsRead.ts` |
| Recuperacao de sessao | `backend/src/services/WbotServices/StartWhatsAppSessionVerify.ts`, `backend/src/libs/wbot.ts` |
| Socket.IO backend | `backend/src/libs/socket.ts`, `backend/src/helpers/socketEmit.ts` |
| Socket.IO frontend | `frontend/src/utils/socket.js`, `frontend/src/layouts/socketInitial.js`, `frontend/src/pages/atendimento/mixinSockets.js`, `frontend/src/pages/atendimento/TicketList.vue` |

## Fluxo de mensagens

### Consulta de mensagens

1. `GET /messages/:ticketId` passa por `isAuth`.
2. `MessageController.index` chama `ListMessagesService`.
3. O controller chama `SetTicketMessagesAsRead(ticket)` para zerar nao lidas e
   tentar enviar `sendSeen` no WhatsApp.
4. A resposta HTTP retorna `{ count, messages, messagesOffLine, ticket, hasMore }`.

Importante: neste controller a chamada para `SetTicketMessagesAsRead` nao usa
`await`. Erros assincronos dentro desse helper nao sao capturados pelo
`try/catch` do controller.

### Envio pelo atendimento

1. `POST /messages/:ticketId` recebe `messageData` e arquivos em `medias`.
2. `MessageController.store` carrega o ticket com `ShowTicketService`.
3. O controller chama `SetTicketMessagesAsRead(ticket)` antes de criar a nova
   mensagem.
4. `CreateMessageSystemService` monta `messageData`, aplica `pupa` no corpo com
   `protocol` e `name`, e decide se envia imediatamente ou agenda:
   - sem `scheduleDate`: chama `SendMessageSystemProxy`;
   - com `scheduleDate`: persiste como pendente sem enviar no mesmo fluxo.
5. Depois do envio imediato, a mensagem e salva em `Message` e emitida via
   `socketEmit` como `chat:create`.

`SendMessageSystemProxy` seleciona o canal pelo `ticket.channel`:

- `instagram`: `InstagramSendMessagesSystem`;
- `telegram`: `TelegramSendMessagesSystem`;
- demais casos, incluindo `whatsapp`: `SendWhatsAppMessage` ou
  `SendWhatsAppMedia`.

## Envio WhatsApp

### Texto

`SendWhatsAppMessage`:

- recupera o cliente em memoria com `GetTicketWbot(ticket)`;
- serializa mensagem citada quando `quotedMsg` esta presente;
- envia para `${ticket.contact.number}@${ticket.isGroup ? "g" : "c"}.us`;
- desativa preview de links com `linkPreview: false`;
- atualiza `lastMessage` e `lastMessageAt` do ticket;
- pode registrar `UserMessagesLog` se receber `userId`;
- em erro, grava log e dispara `AppError("ERR_SENDING_WAPP_MSG")`.

Restricao atual: a chamada a `StartWhatsAppSessionVerify` esta comentada neste
servico. Falhas de envio de texto nao iniciam recuperacao automatica de sessao.

### Midia

`SendWhatsAppMedia`:

- cria `MessageMedia` a partir de `media.path`;
- envia para o mesmo JID usado em texto;
- usa `{ sendAudioAsVoice: true }`;
- atualiza `lastMessage` com `media.filename`;
- registra `UserMessagesLog` quando `userId` e informado;
- remove o arquivo temporario com `fs.unlinkSync(media.path)` apos envio bem
  sucedido;
- em erro, chama `StartWhatsAppSessionVerify(ticket.whatsappId, err)` e depois
  dispara `AppError("ERR_SENDING_WAPP_MSG")`.

Ponto de atencao: a remocao do arquivo temporario ocorre apenas no caminho de
sucesso. Se `MessageMedia.fromFilePath` ou `wbot.sendMessage` falhar, o arquivo
recebido pode permanecer no disco ate alguma limpeza externa.

## Marcacao de leitura

`SetTicketMessagesAsRead(ticket)` executa tres tarefas:

1. Atualiza todas as mensagens nao lidas do ticket para `read: true`.
2. Atualiza o ticket com `unreadMessages: 0`.
3. Por canal:
   - `whatsapp`: chama `GetTicketWbot(ticket)` e executa `wbot.sendSeen(...)`;
   - `messenger`: chama `getMessengerBot(ticket.whatsappId).markSeen(...)`.

Quando o `sendSeen` do WhatsApp rejeita, o helper chama
`StartWhatsAppSessionVerify(ticket.whatsappId, e)` e loga a falha. Ao final,
recarrega o ticket com `ShowTicketService` e emite `ticket:update` via
`socketEmit`.

## Recuperacao de sessao WhatsApp

`StartWhatsAppSessionVerify(whatsappId, error)` tenta reiniciar uma sessao apenas
para erros conhecidos:

- `session closed`;
- `ERR_WAPP_NOT_INITIALIZED`;
- uma assinatura de erro relacionada a `sendSeen` indefinido.

Quando ha correspondencia, o servico:

1. Busca a conexao `Whatsapp` pelo id.
2. Atualiza `status` para `OPENING`.
3. Emite `${tenantId}:whatsappSession` com `action: "update"`.
4. Chama `initWbot(whatsapp)`.
5. Reanexa `wbotMessageListener` e `wbotMonitor`.

As sessoes WhatsApp ficam no array em memoria `sessions` de `backend/src/libs/wbot.ts`.
Em restart do processo, `StartAllWhatsAppsSessions` recria apenas conexoes ativas:

- canais `instagram`, `telegram`, `waba` e `messenger` com status diferente de
  `DISCONNECTED`;
- canal `whatsapp` com status diferente de `DISCONNECTED` e `qrcode`;
- sempre com `isActive: true`.

Ponto de atencao: `StartWhatsAppSessionVerify` transforma o erro para lowercase,
mas a constante da assinatura de `sendSeen` indefinido esta em caixa mista. Como
`String#indexOf` e sensivel a caixa, essa assinatura especifica pode nao casar
como esperado.

## Socket.IO

### Autenticacao

O frontend cria o socket em `frontend/src/utils/socket.js`:

- conecta em `process.env.VUE_URL_API`;
- usa transporte `websocket`;
- envia o token de `localStorage.token` em `handshake.auth.token`.

No backend, `initIO`:

- aceita CORS com `origin: "*"`;
- configura `pingTimeout` de 180s e `pingInterval` de 60s;
- usa adapter Redis com `IO_REDIS_SERVER`, `IO_REDIS_PORT`,
  `IO_REDIS_USERNAME` e `IO_REDIS_PASSWORD`;
- valida o JWT com `decodeTokenSocket`;
- anexa `id`, `tenantId` e `user` em `socket.handshake.auth`.

Tokens ausentes retornam invalido sem log de erro. Tokens presentes e invalidos
sao registrados por `decodeTokenSocket`. Em excecoes no middleware, o backend
emite `tokenInvalid:${socket.id}`; o frontend remove dados locais de login e
redireciona para `login`.

### Salas e eventos

Ao conectar, o backend entra automaticamente na sala do tenant:

```text
socket.join(tenantId.toString())
```

Tambem existem eventos para salas especificas:

- `${tenantId}:joinChatBox` entra em `${tenantId}:${ticketId}`;
- `${tenantId}:joinNotification` entra em `${tenantId}:notification`;
- `${tenantId}:joinTickets` entra em `${tenantId}:${status}`.

`socketEmit` envia eventos de lista para a sala geral do tenant:

- eventos de chat/ticket/notificacao: `${tenantId}:ticketList`;
- eventos de contato: `${tenantId}:contactList`.

Outros fluxos ainda emitem diretamente para salas por status/ticket, por exemplo
`TicketController.remove` usa `${tenantId}:${ticket.status}`,
`${tenantId}:${ticketId}` e `${tenantId}:notification`.

### Armadilhas conhecidas de nomes de sala

Ha convencoes diferentes em partes do codigo:

- `backend/src/libs/socket.ts` espera eventos sem prefixo `tenant:`, como
  `${tenantId}:joinTickets`;
- `frontend/src/pages/atendimento/TicketList.vue` emite
  `tenant:${tenantId}:joinTickets`, `tenant:${tenantId}:joinNotification` e
  `tenant:${tenantId}:joinChatBox`;
- `DeleteWhatsAppMessage` usa salas/eventos com prefixo `tenant:`.

Antes de depender de uma sala especifica, confirme se emissor e receptor usam a
mesma convencao. Eventos enviados por `socketEmit` para a sala geral do tenant
continuam usando a sala `tenantId.toString()` criada automaticamente na conexao.

## Variaveis de ambiente relevantes

Backend:

- `JWT_SECRET`: valida tokens usados no handshake Socket.IO.
- `IO_REDIS_SERVER`, `IO_REDIS_PORT`, `IO_REDIS_USERNAME`,
  `IO_REDIS_PASSWORD`: adapter Redis do Socket.IO.
- `IO_REDIS_DB_SESSION`: usado por outros clientes Redis de sessao/fila.
- `CHROME_BIN`: caminho do Chromium/Chrome usado pelo Puppeteer.
- `CHROME_ARGS`: argumentos separados por virgula para o Chromium; quando
  ausente, `wbot.ts` usa uma lista minima com `--no-sandbox` e flags de baixo
  consumo.
- `WEB_VERSION`: versao do WhatsApp Web carregada pelo `whatsapp-web.js`; quando
  ausente, o codigo usa `2.2409.2`.

Frontend:

- `VUE_URL_API`: URL base usada pelo `socket.io-client` e deve apontar para o
  backend acessivel pelo navegador.

## Troubleshooting rapido

### O usuario e deslogado logo apos abrir a tela

Verifique:

1. Se `localStorage.token` existe e e um JWT valido para `JWT_SECRET`.
2. Se o backend registra erro em `decodeTokenSocket`.
3. Se o frontend recebeu `tokenInvalid:<socket.id>`.

### Eventos de ticket nao chegam a uma lista especifica

Verifique:

1. Se o componente entrou na sala com o mesmo nome esperado no backend.
2. Se o evento usa a convencao `${tenantId}:...` ou `tenant:${tenantId}:...`.
3. Se o fluxo usa `socketEmit`, que envia para a sala geral do tenant, ou
   emissoes diretas com `.to(...)`.

### Midia WhatsApp falha e a sessao nao volta

Verifique:

1. Se o erro contem uma das assinaturas reconhecidas por
   `StartWhatsAppSessionVerify`.
2. Se a conexao `Whatsapp` existe e esta ativa.
3. Se `initWbot` consegue iniciar Chromium com `CHROME_BIN`/`CHROME_ARGS`.
4. Se o frontend recebeu `${tenantId}:whatsappSession` com `action: "update"`.

### Texto WhatsApp falha e nao ha tentativa de recuperar sessao

Esse e o comportamento atual: `SendWhatsAppMessage` nao chama
`StartWhatsAppSessionVerify`. Compare com `SendWhatsAppMedia` e
`SetTicketMessagesAsRead` antes de alterar a politica de recuperacao.
