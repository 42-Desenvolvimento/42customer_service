# Sessoes WhatsApp, recuperacao e eventos em tempo real

Este runbook descreve como o backend inicia e recupera sessoes do
`whatsapp-web.js`, como o frontend recebe atualizacoes via Socket.IO e quais
pontos observar em operacao.

## Codigo coberto

- Inicializacao do app: `backend/src/app/index.ts`
- Socket.IO e autenticacao: `backend/src/libs/socket.ts`,
  `backend/src/libs/decodeTokenSocket.ts`, `backend/src/helpers/socketEmit.ts`
- Cliente WhatsApp: `backend/src/libs/wbot.ts`
- Ciclo de sessao: `backend/src/services/WbotServices/StartAllWhatsAppsSessions.ts`,
  `StartWhatsAppSession.ts`, `StartWhatsAppSessionVerify.ts`, `wbotMonitor.ts`
- Acoes que podem disparar recuperacao: `backend/src/helpers/SetTicketMessagesAsRead.ts`,
  `backend/src/services/WbotServices/SendWhatsAppMedia.ts`
- Endpoints internos: `backend/src/controllers/WhatsAppSessionController.ts`,
  `backend/src/routes/whatsappSessionRoutes.ts`
- Endpoint externo de inicio: `backend/src/controllers/APIExternalController.ts`
- Frontend: `frontend/src/utils/socket.js`,
  `frontend/src/layouts/socketInitial.js`, `frontend/src/pages/atendimento/mixinSockets.js`

## Visao geral

1. `application()` cria o servidor HTTP, chama `initIO(app.server)` e so depois
   executa `StartAllWhatsAppsSessions()`.
2. `initIO` cria o Socket.IO, configura o adapter Redis e valida o JWT enviado
   no handshake (`auth.token`).
3. Cada socket autenticado entra na sala do seu `tenantId`. Eventos genericos
   de ticket e contato usam `socketEmit`, que publica em:
   - `${tenantId}:ticketList` para `chat:*`, `ticket:*` e `notification:new`
   - `${tenantId}:contactList` para `contact:*`
4. Sessoes WhatsApp usam eventos especificos `${tenantId}:whatsappSession` e
   `${tenantId}:change_battery`. Esses eventos incluem o tenant no nome do
   canal e sao emitidos pelo `io.emit`.
5. `StartWhatsAppSession` marca a conexao como `OPENING`, emite a atualizacao e,
   para canais `type === "whatsapp"`, chama `initWbot`, registra o listener de
   mensagens e instala o `wbotMonitor`.

## Inicio automatico das sessoes

`StartAllWhatsAppsSessions` busca canais ativos (`isActive: true`) e inicia:

- WhatsApp com status diferente de `DISCONNECTED` e `qrcode`.
- Telegram com `tokenTelegram`.
- WABA 360 com `tokenAPI` e `wabaBSP === "360"`.
- Instagram com `instagramKey`.
- Messenger com `tokenAPI`.

Isso significa que uma sessao WhatsApp parada em `qrcode` nao e reiniciada no
boot. Ela depende de acao manual ou de endpoint que limpe/recrie a sessao.

## Ciclo do cliente WhatsApp

`initWbot` usa `LocalAuth` com `clientId` `wbot-${whatsapp.id}` e persiste os
dados locais em `.wwebjs_auth`. O cliente e configurado com:

- `CHROME_BIN`, quando definido, como caminho do executavel do Chrome.
- `CHROME_ARGS`, quando definido, substituindo a lista minima de argumentos.
- `WEB_VERSION`, quando definido, substituindo a versao padrao `2.2409.2`.
- Cache remoto de versao em `wppconnect-team/wa-version`.

Eventos relevantes:

- `qr`: atualiza `qrcode`, `status: "qrcode"`, reseta `retries` e adiciona o
  cliente no array em memoria se ainda nao existir.
- `auth_failure`: incrementa `retries`, marca `DISCONNECTED` e rejeita o inicio.
  Quando `retries > 1`, tambem limpa `session`.
- `ready`: marca `CONNECTED`, limpa `qrcode`, reseta `retries`, grava numero e
  informacoes de versao/browser, emite `readySession`, envia presence available
  e sincroniza mensagens nao lidas.

O array `sessions` fica somente em memoria do processo. Reinicios do backend
dependem da pasta `.wwebjs_auth` e do banco para reconstruir os clientes.

## Recuperacao automatica

Ha tres caminhos principais:

### 1. Monitor de desconexao

`wbotMonitor` escuta `disconnected`. Quando ocorre:

1. Atualiza a conexao para `status: "OPENING"`, `session: ""` e `qrcode: null`.
2. Agenda `StartWhatsAppSession(whatsapp)` apos 2 segundos.
3. Emite `${tenantId}:whatsappSession` com `action: "update"`.

### 2. Falha ao marcar ticket como lido

`SetTicketMessagesAsRead` marca mensagens locais como lidas, zera
`unreadMessages` e, para canal WhatsApp, chama `sendSeen`. Se `sendSeen` falhar,
o erro e encaminhado para `StartWhatsAppSessionVerify`.

Mesmo quando o `sendSeen` falha, o helper recarrega o ticket e emite
`ticket:update` via `socketEmit`.

### 3. Falha ao enviar midia

`SendWhatsAppMedia` cria `MessageMedia` a partir do arquivo recebido, envia a
midia, atualiza `lastMessage`/`lastMessageAt`, registra `UserMessagesLog` quando
ha `userId` e remove o arquivo local. Em erro, registra log, chama
`StartWhatsAppSessionVerify(ticket.whatsappId, err)` e retorna
`ERR_SENDING_WAPP_MSG`.

`StartWhatsAppSessionVerify` so reinicia a sessao quando o texto do erro contem:

- `session closed`
- `err_wapp_not_initialized`
- a assinatura configurada para erro de `sendSeen` indefinido

Observacao: o erro recebido e convertido para lowercase antes da comparacao.
Ao alterar assinaturas de erro, mantenha os termos comparados no mesmo formato.

## Endpoints operacionais

Todos os endpoints abaixo usam `isAuth` e operam dentro do `tenantId` do usuario.

```http
POST /whatsappsession/:whatsappId
```

Inicia a sessao carregando a conexao por `ShowWhatsAppService` e chamando
`StartWhatsAppSession`.

```http
PUT /whatsappsession/:whatsappId
Content-Type: application/json

{ "isQrcode": true }
```

Limpa a pasta local da sessao quando `isQrcode` e verdadeiro, limpa o campo
`session` no banco e inicia novamente. Use quando precisar forcar novo QR Code.

```http
DELETE /whatsappsession/:whatsappId
```

Efetua logout/remove o cliente em memoria conforme o tipo do canal e marca a
conexao como `DISCONNECTED`, com `session: ""`, `qrcode: null` e `retries: 0`.

O endpoint externo de API (`startSession` em `APIExternalController`) valida se
o `apiId` pertence a sessao autenticada. Se `getWbot(...).getState()` nao
retornar `CONNECTED`, ele chama `StartWhatsAppSession`.

## Eventos recebidos pelo frontend

O cliente Socket.IO em `frontend/src/utils/socket.js` conecta em
`process.env.VUE_URL_API`, usa transporte `websocket` e envia o token salvo em
`localStorage` no handshake.

Listeners principais:

- `tokenInvalid:${socket.id}`: desconecta, limpa dados locais de usuario/token e
  redireciona para login.
- `${tenantId}:whatsappSession`:
  - `action: "update"` atualiza a store de sessoes.
  - `action: "readySession"` mostra notificacao positiva de conexao pronta.
- `${tenantId}:change_battery`: alerta quando a bateria reportada pelo cliente
  WhatsApp fica em ate 20% e o aparelho nao esta carregando.
- `${tenantId}:ticketList`: atualiza mensagens, tickets, acks e notificacoes.
- `${tenantId}:contactList`: atualiza contatos.

## Variaveis de ambiente relacionadas

Backend:

- `IO_REDIS_SERVER`, `IO_REDIS_PORT`, `IO_REDIS_USERNAME`,
  `IO_REDIS_PASSWORD`: usados pelo adapter Redis do Socket.IO.
- `IO_REDIS_DB_SESSION`: usado por `redisClient` para dados auxiliares de sessao,
  nao pelo adapter Socket.IO.
- `CHROME_BIN`: caminho do Chrome/Chromium para o Puppeteer.
- `CHROME_ARGS`: lista separada por virgula para substituir os argumentos
  padrao do Chrome.
- `WEB_VERSION`: versao do WhatsApp Web usada pelo `whatsapp-web.js`.
- `CONNECTIONS_LIMIT`: limite de conexoes criadas por tenant.

Frontend:

- `VUE_URL_API`: URL usada pelo Axios e pelo Socket.IO.

## Troubleshooting rapido

### Sessao nao reinicia apos deploy

- Verifique se o canal esta `isActive: true`.
- Para WhatsApp, confirme que o status nao esta `DISCONNECTED` nem `qrcode`.
- Confirme nos logs se `initIO` foi chamado antes de `StartAllWhatsAppsSessions`.
- Se o problema for QR Code antigo, use `PUT /whatsappsession/:id` com
  `isQrcode: true` para limpar a pasta local da sessao.

### Frontend nao recebe atualizacoes

- Confirme que o JWT esta no `localStorage` e e enviado no handshake.
- Valide `VUE_URL_API` e conectividade websocket com o backend.
- Verifique Redis (`IO_REDIS_*`), pois o adapter e criado durante `initIO`.
- Confirme se o usuario possui `tenantId`; sem ele o socket nao entra na sala do
  tenant.

### Envio de midia falha e a sessao continua quebrada

- Procure logs `SendWhatsAppMedia | Error`.
- Verifique se a mensagem do erro contem uma das assinaturas tratadas em
  `StartWhatsAppSessionVerify`.
- Confirme se existe registro da conexao (`Whatsapp.findByPk`) para o
  `ticket.whatsappId`.
- Lembre que erro de envio de texto em `SendWhatsAppMessage` nao chama
  recuperacao automatica no codigo atual.

### Tickets continuam com contador incorreto

- `SetTicketMessagesAsRead` atualiza o banco antes de chamar `sendSeen`.
- Se `sendSeen` falhar, o ticket ainda e recarregado e emitido como
  `ticket:update`.
- Investigue separadamente se a falha esta no estado local do ticket, no cliente
  WhatsApp ou na entrega do evento Socket.IO.

## Cuidados ao alterar este fluxo

- `getIO()` falha se o Socket.IO ainda nao foi inicializado; mantenha a ordem do
  bootstrap.
- `sessions` e um estado em memoria. Mudancas em escala horizontal exigem
  cuidado extra para decidir qual processo possui cada cliente WhatsApp.
- Ao adicionar novas condicoes de recuperacao, normalize a assinatura do erro
  antes de comparar.
- Evite apagar `.wwebjs_auth` sem intencao operacional clara: isso pode forcar
  novo pareamento por QR Code.
