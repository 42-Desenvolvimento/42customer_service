# Sessoes e envio WhatsApp

Este guia descreve como o backend inicia sessoes de atendimento, envia
mensagens WhatsApp e tenta recuperar sessoes quando a biblioteca
`whatsapp-web.js` falha. O foco e dar contexto para manutencao e operacao dos
fluxos alterados recentemente em `SetTicketMessagesAsRead`,
`SendWhatsAppMedia` e `socket`.

## Codigo coberto

| Area | Arquivos principais |
| --- | --- |
| Boot da aplicacao | `backend/src/app/index.ts`, `backend/src/app/boot.ts` |
| Socket.IO | `backend/src/libs/socket.ts`, `backend/src/helpers/socketEmit.ts`, `backend/src/libs/decodeTokenSocket.ts` |
| Sessao WhatsApp | `backend/src/libs/wbot.ts`, `backend/src/services/WbotServices/StartAllWhatsAppsSessions.ts`, `StartWhatsAppSession.ts`, `StartWhatsAppSessionVerify.ts`, `wbotMonitor.ts` |
| Envio de mensagens | `backend/src/helpers/SendMessageSystemProxy.ts`, `backend/src/services/WbotServices/SendWhatsAppMessage.ts`, `SendWhatsAppMedia.ts` |
| Marcacao de leitura | `backend/src/helpers/SetTicketMessagesAsRead.ts`, `backend/src/controllers/MessageController.ts`, `backend/src/services/TicketServices/UpdateTicketService.ts` |
| Frontend em tempo real | `frontend/src/utils/socket.js`, `frontend/src/layouts/socketInitial.js`, `frontend/src/pages/atendimento/mixinSockets.js`, `TicketList.vue` |

## Visao geral do fluxo

1. `backend/src/app/index.ts` cria o servidor HTTP, inicializa o Socket.IO com
   `initIO(app.server)` e so entao chama `StartAllWhatsAppsSessions()`.
2. `StartAllWhatsAppsSessions` busca canais ativos. Para `type = "whatsapp"`,
   reinicia apenas sessoes cujo status nao esteja em `DISCONNECTED` nem
   `qrcode`; outros canais ativos usam seus inicializadores especificos.
3. `StartWhatsAppSession` altera o status para `OPENING`, emite
   `<tenantId>:whatsappSession` e inicializa o cliente em `initWbot`.
4. `initWbot` cria um `Client` de `whatsapp-web.js` com `LocalAuth`, registra
   eventos de QR code, autenticacao, falha de auth e `ready`, e armazena a
   sessao conectada no array em memoria `sessions`.
5. Apos `ready`, o backend atualiza o canal para `CONNECTED`, emite
   `<tenantId>:whatsappSession` com `update` e `readySession`, chama
   `sendPresenceAvailable()` e sincroniza nao lidas com `SyncUnreadMessagesWbot`.

## Configuracao operacional

Variaveis relevantes em `backend/.env.example`:

```env
IO_REDIS_SERVER=izing-redis
IO_REDIS_PORT='6379'
IO_REDIS_DB_SESSION='2'
IO_REDIS_PASSWORD=
CHROME_BIN=/usr/bin/google-chrome
WEB_VERSION=2.2409.2
```

- `IO_REDIS_SERVER`, `IO_REDIS_PORT`, `IO_REDIS_USERNAME` e
  `IO_REDIS_PASSWORD` sao usados pelo adapter Socket.IO Redis.
- `IO_REDIS_DB_SESSION` e usado por `backend/src/libs/redisClient.ts`; a fila
  Bull em `backend/src/libs/Queue.ts` usa o DB `3`.
- `CHROME_BIN` customiza o binario do Chrome/Chromium usado pelo Puppeteer.
- `CHROME_ARGS`, quando definido, substitui a lista minima de argumentos de
  Chromium em `wbot.ts`.
- `WEB_VERSION` fixa a versao do WhatsApp Web usada pelo cache remoto; sem ela,
  o codigo usa `2.2409.2`.

## Eventos Socket.IO

### Autenticacao

`backend/src/libs/socket.ts` valida o token recebido em
`handshake.auth.token` com `decodeTokenSocket`. Quando o token e valido, o
backend adiciona `id`, `tenantId` e `user` ao handshake e chama `next()`.
Quando e invalido, chama `next(new Error("authentication error"))`; em excecao,
emite `tokenInvalid:<socket.id>` antes de negar a conexao.

O cliente padrao esta em `frontend/src/utils/socket.js`:

```js
io(process.env.VUE_URL_API, {
  reconnection: true,
  autoConnect: true,
  transports: ['websocket'],
  auth: cb => cb({ token: localStorage.getItem('token') })
})
```

### Salas e canais

Na conexao, o backend sempre junta o socket a sala do tenant
`tenantId.toString()` e registra:

- `<tenantId>:joinChatBox` para entrar na sala de um ticket.
- `<tenantId>:joinNotification` para notificacoes.
- `<tenantId>:joinTickets` para listas por status.

`socketEmit` envia eventos de ticket para a sala do tenant no canal
`<tenantId>:ticketList`; eventos de contato usam `<tenantId>:contactList`.
Alguns eventos diretos, como `<tenantId>:whatsappSession` e
`<tenantId>:change_battery`, sao emitidos diretamente pelo monitor da sessao.

Armadilha conhecida: `frontend/src/pages/atendimento/TicketList.vue` emite
`tenant:<tenantId>:joinChatBox`, `tenant:<tenantId>:joinTickets` e
`tenant:<tenantId>:joinNotification`, mas `backend/src/libs/socket.ts` registra
os eventos sem o prefixo `tenant:`. Outros pontos, como
`frontend/src/layouts/socketInitial.js`, usam o formato sem prefixo para
`joinNotification`.

## Envio de mensagens WhatsApp

O envio iniciado pelo atendimento passa por `SendMessageSystemProxy`:

- Se ha `messageData.mediaName`, canais Instagram e Telegram usam seus
  servicos especificos; qualquer outro canal cai no envio WhatsApp de midia.
- Se nao ha `media`, canais Instagram e Telegram usam seus servicos
  especificos; qualquer outro canal cai em `SendWhatsAppMessage`.

### Texto

`SendWhatsAppMessage`:

1. Resolve o cliente com `GetTicketWbot(ticket)`.
2. Envia para `<numero>@g.us` quando `ticket.isGroup` e verdadeiro, senao para
   `<numero>@c.us`.
3. Desativa preview de links com `linkPreview: false`.
4. Atualiza `ticket.lastMessage` e `ticket.lastMessageAt`.
5. Tenta registrar `UserMessagesLog` quando recebe `userId`.

Limite importante: o catch de `SendWhatsAppMessage` apenas registra
`SendWhatsAppMessage | Error: ...` e lanca `ERR_SENDING_WAPP_MSG`. A chamada a
`StartWhatsAppSessionVerify` esta comentada, portanto falhas de envio de texto
nao acionam recuperacao automatica por esse caminho.

### Midia

`SendWhatsAppMedia`:

1. Resolve o cliente com `GetTicketWbot(ticket)`.
2. Cria `MessageMedia` a partir de `media.path`.
3. Envia a midia com `{ sendAudioAsVoice: true }`.
4. Atualiza `ticket.lastMessage` com `media.filename`.
5. Tenta registrar `UserMessagesLog` quando recebe `userId`.
6. Remove o arquivo temporario com `fs.unlinkSync(media.path)`.

No catch, registra `SendWhatsAppMedia | Error: ...`, chama
`StartWhatsAppSessionVerify(ticket.whatsappId, err)` e lanca
`ERR_SENDING_WAPP_MSG`.

## Marcacao de leitura

`SetTicketMessagesAsRead(ticket)`:

1. Marca mensagens do ticket como `read: true`.
2. Atualiza `ticket.unreadMessages` para `0`.
3. Para WhatsApp, chama `GetTicketWbot(ticket).sendSeen(...)`.
4. Para Messenger, chama `messengerBot.markSeen(...)`.
5. Recarrega o ticket com `ShowTicketService`.
6. Emite `ticket:update` via `socketEmit`.

Se `sendSeen` rejeitar, o helper chama
`StartWhatsAppSessionVerify(ticket.whatsappId, e)` e registra
`nao foi possivel marcar como lido`. A excecao geral do helper nao relanca erro;
ela registra um warning e continua a emissao de atualizacao do ticket.

## Recuperacao de sessao

`StartWhatsAppSessionVerify(whatsappId, error)` tenta recuperar apenas quando a
mensagem de erro normalizada contem uma das assinaturas:

- `session closed`
- `err_wapp_not_initialized`
- `TypeError: Cannot read property 'sendSeen' of undefined`

Quando uma assinatura e encontrada:

1. Busca o canal em `Whatsapp.findByPk(whatsappId)`.
2. Atualiza o status para `OPENING`.
3. Emite `<tenantId>:whatsappSession` com `action: "update"`.
4. Chama `initWbot`, registra `wbotMessageListener` e `wbotMonitor`.

Atencao: `error.toString().toLowerCase()` e aplicado antes da comparacao, mas a
assinatura `TypeError: Cannot read property 'sendSeen' of undefined` esta
declarada com letras maiusculas. Do jeito que o codigo esta, essa assinatura
nao casa por caixa; `session closed` e `ERR_WAPP_NOT_INITIALIZED` continuam
cobertos.

## Monitoramento de sessao

`wbotMonitor` registra tres eventos do cliente WhatsApp:

- `change_state`: atualiza `Whatsapp.status` com o novo estado e emite
  `<tenantId>:whatsappSession`.
- `change_battery`: atualiza `battery` e `plugged`; se a bateria for menor ou
  igual a 20 e o aparelho nao estiver carregando, emite
  `<tenantId>:change_battery`.
- `disconnected`: atualiza status para `OPENING`, limpa `session` e `qrcode`,
  agenda `StartWhatsAppSession(whatsapp)` em 2 segundos e emite atualizacao.

As sessoes ficam em memoria no array `sessions` de `wbot.ts`. Em reinicio de
processo, o backend depende de `LocalAuth` no diretorio `.wwebjs_auth` e do
estado salvo em banco para recriar os clientes elegiveis.

## Runbook de troubleshooting

### O frontend nao recebe atualizacoes em tempo real

1. Verifique se o token usado por `frontend/src/utils/socket.js` existe em
   `localStorage`.
2. Procure logs `tokenInvalid` ou `authentication error` no backend.
3. Confirme `IO_REDIS_SERVER`, `IO_REDIS_PORT`, `IO_REDIS_USERNAME` e
   `IO_REDIS_PASSWORD` quando houver mais de uma instancia.
4. Confirme se o frontend entrou nas salas corretas:
   `<tenantId>:joinNotification`, `<tenantId>:joinTickets` ou
   `<tenantId>:joinChatBox`.
5. Se o problema aparecer apenas em `TicketList.vue`, confira o prefixo dos
   eventos emitidos; esse componente usa `tenant:<tenantId>:...`, enquanto o
   backend escuta `<tenantId>:...`.

### Sessao WhatsApp nao reconecta no boot

1. Confira se o canal esta `isActive = true`.
2. Para `type = "whatsapp"`, status `DISCONNECTED` e `qrcode` sao ignorados por
   `StartAllWhatsAppsSessions`.
3. Verifique se existe estado local em `.wwebjs_auth/session-wbot-<id>` quando
   a sessao depender de `LocalAuth`.
4. Confira `CHROME_BIN`, `CHROME_ARGS` e permissoes do ambiente onde o
   Chromium roda.

### Envio de midia falha e a sessao fica instavel

1. Procure `SendWhatsAppMedia | Error:` nos logs.
2. Verifique se o erro contem `session closed` ou `ERR_WAPP_NOT_INITIALIZED`.
3. Se contiver uma assinatura coberta, o backend deve emitir status `OPENING`
   e tentar `initWbot` novamente.
4. Se o arquivo temporario de midia ainda existir, investigue falhas antes de
   `fs.unlinkSync(media.path)`.

### Envio de texto falha sem recuperar a sessao

Esse e o comportamento atual: `SendWhatsAppMessage` nao chama
`StartWhatsAppSessionVerify`. A operacao retorna `ERR_SENDING_WAPP_MSG`; a
recuperacao pode acontecer por outros caminhos, como `disconnected` no monitor
ou chamada manual de inicio de sessao, mas nao pelo catch do envio de texto.

### Marcar mensagens como lidas falha

1. Procure `nao foi possivel marcar como lido` nos logs.
2. Se o erro for de sessao fechada ou nao inicializada, o helper tentara
   `StartWhatsAppSessionVerify`.
3. Mesmo com falha no `sendSeen`, o helper atualiza leitura local, zera
   `unreadMessages` e emite `ticket:update`.

## Cuidados ao alterar

- `getWbot` lanca `ERR_WAPP_NOT_INITIALIZED` quando a sessao nao esta no array
  em memoria; trate isso como estado operacional, nao como ausencia do canal no
  banco.
- `StartWhatsAppSessionVerify` nao remove entradas antigas de `sessions` antes
  de inicializar outra sessao.
- Evite assumir que todo canal usa WhatsApp Web: `StartWhatsAppSession` tambem
  direciona Telegram, Instagram, Messenger e WABA para servicos proprios.
- Ao mudar nomes de eventos Socket.IO, atualize backend e frontend juntos; o
  frontend escuta varios canais com prefixo de tenant.
