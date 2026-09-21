# Envio de mensagens e sessoes WhatsApp

Este guia descreve o fluxo atual de envio pelo canal WhatsApp, a recuperacao de
sessoes `whatsapp-web.js` e os principais pontos de operacao. Ele cobre o canal
`whatsapp` tradicional; canais `telegram`, `instagram`, `messenger` e `waba`
compartilham partes do pipeline, mas usam clientes e servicos proprios.

## Codigo coberto

- Boot e filas: `backend/src/app/boot.ts`, `backend/src/app/index.ts`,
  `backend/src/app/bull.ts`, `backend/src/libs/Queue.ts`.
- Sessao WhatsApp: `backend/src/libs/wbot.ts`,
  `backend/src/services/WbotServices/StartAllWhatsAppsSessions.ts`,
  `StartWhatsAppSession.ts`, `StartWhatsAppSessionVerify.ts`,
  `wbotMonitor.ts`.
- Envio e agendamento: `backend/src/controllers/MessageController.ts`,
  `backend/src/services/MessageServices/CreateMessageSystemService.ts`,
  `backend/src/helpers/SendMessageSystemProxy.ts`,
  `backend/src/services/WbotServices/SendWhatsAppMessage.ts`,
  `SendWhatsAppMedia.ts`, `SendMessagesSchenduleWbot.ts`,
  `backend/src/jobs/SendMessageSchenduled.ts`.
- API externa e callbacks: `backend/src/controllers/APIExternalController.ts`,
  `backend/src/jobs/SendMessageAPI.ts`,
  `backend/src/services/WbotServices/helpers/HandleMsgAck.ts`,
  `backend/src/jobs/WebHooksAPI.ts`.
- Interface: `frontend/src/pages/atendimento/InputMensagem.vue`,
  `frontend/src/pages/sessaoWhatsapp/Index.vue`,
  `frontend/src/layouts/socketInitial.js`.

## Inicializacao da aplicacao

1. `server.ts` inicializa `app/index.ts`.
2. `bootstrap()` aguarda Postgres, configura Express, banco, modulos e Bull.
3. `bullMQ()` chama `Queue.process()` e registra jobs recorrentes, incluindo
   `SendMessageSchenduled` a cada 1 minuto.
4. Depois do HTTP server subir, `initIO()` inicializa Socket.IO e
   `StartAllWhatsAppsSessions()` religa canais ativos.

Ordem importante: sessoes so sao iniciadas depois do Socket.IO estar pronto,
porque mudancas de estado emitem eventos `${tenantId}:whatsappSession`.

## Ciclo de vida da sessao WhatsApp

`initWbot()` cria um `Client` do `whatsapp-web.js` com `LocalAuth` usando
`clientId: wbot-{whatsapp.id}`. A pasta local de autenticacao fica em
`backend/.wwebjs_auth/session-wbot-{id}` e pode ser removida por
`apagarPastaSessao()` quando a UI pede um novo QR Code.

Estados e eventos relevantes:

- `qr`: atualiza `Whatsapp.status` para `qrcode`, zera `retries`, salva o QR e
  emite `whatsappSession:update`.
- `ready`: atualiza status para `CONNECTED`, limpa `qrcode`, salva numero,
  versao do WhatsApp Web e versao do browser em `phone`, emite
  `whatsappSession:update` e `readySession`, envia presence e sincroniza nao
  lidas.
- `auth_failure`: apos mais de uma tentativa, limpa `session`, marca
  `DISCONNECTED`, incrementa `retries` e emite update.
- `change_state`: persiste o novo estado recebido do cliente e emite update.
- `change_battery`: persiste bateria/plugado, emite update e tambem
  `${tenantId}:change_battery` quando bateria <= 20 e nao esta carregando.
- `disconnected`: marca `OPENING`, limpa `session`/`qrcode` e chama
  `StartWhatsAppSession()` novamente depois de 2 segundos.

No boot, `StartAllWhatsAppsSessions()` religa apenas conexoes `isActive`.
Para `type: "whatsapp"`, conexoes com status `DISCONNECTED` ou `qrcode` nao
sao reiniciadas automaticamente.

## Rotas de sessao e uso pela UI

Rotas autenticadas em `backend/src/routes/whatsappSessionRoutes.ts`:

- `POST /whatsappsession/:whatsappId`: busca a conexao do tenant e chama
  `StartWhatsAppSession()`.
- `PUT /whatsappsession/:whatsappId`: se o body tiver `isQrcode`, remove a
  pasta local de sessao, limpa `session` no banco e inicia novamente.
- `DELETE /whatsappsession/:whatsappId`: faz logout/desconexao, remove o client
  em memoria e marca `DISCONNECTED`.

A tela `frontend/src/pages/sessaoWhatsapp/Index.vue` consome essas rotas pelos
helpers de `frontend/src/service/sessoesWhatsapp.js`. Ela exibe acoes conforme
o status:

- `qrcode`: botao para abrir QR Code.
- `DISCONNECTED`: botoes "Conectar" e "Novo QR Code".
- `OPENING`, `CONNECTED`, `PAIRING` ou `TIMEOUT`: botao "Desconectar".

`frontend/src/layouts/socketInitial.js` escuta `whatsappSession:update` para
atualizar a store e `readySession` para notificar o usuario.

## Envio pela tela de atendimento

`InputMensagem.vue` envia tudo para `POST /messages/:ticketId`:

- texto simples;
- link de videoconferencia;
- audio gravado como arquivo `.mp3`;
- multiplas midias via `FormData`;
- mensagens agendadas quando `scheduleDate` esta preenchido.

O controller:

1. carrega o ticket com `ShowTicketService`;
2. chama `SetTicketMessagesAsRead(ticket)` em modo best effort;
3. delega para `CreateMessageSystemService()`.

`CreateMessageSystemService()` monta o registro `Message` com:

- `fromMe: true` para envios de API externa;
- `status` recebido pelo caller, normalmente `pending`;
- `scheduleDate`, quando informado;
- interpolacao de `{{protocol}}` e `{{name}}` via `pupa()`;
- midias gravadas em `backend/public`.

Se nao houver `scheduleDate`, o envio e tentado imediatamente via
`SendMessageSystemProxy()`. Para ticket WhatsApp:

- com midia: `SendWhatsAppMedia()` cria `MessageMedia.fromFilePath()` e chama
  `wbot.sendMessage(chatId, media, { sendAudioAsVoice: true })`;
- sem midia: `SendWhatsAppMessage()` chama
  `wbot.sendMessage(chatId, body, { quotedMessageId, linkPreview: false })`.

Depois do envio imediato, o servico cria/atualiza `Message` com o `messageId`
retornado pelo WhatsApp e emite `chat:create` via Socket.IO.

## Mensagens agendadas

Mensagens com `scheduleDate` nao sao enviadas no request original. Elas ficam
com `messageId = null` e `status = "pending"` ate o job recorrente executar.

`SendMessageSchenduled` roda a cada minuto e chama
`SendMessagesSchenduleWbot()`:

- usa `TIMEZONE` ou `America/Sao_Paulo` por padrao;
- busca mensagens `fromMe`, `pending`, sem `messageId`, com `scheduleDate`
  menor/igual ao horario atual e maior/igual a 24 horas atras;
- considera tickets com status `open` ou `pending`;
- para WhatsApp, usa `SendMessage()`; para outros canais, usa
  `SendMessageSystemProxy()`.

Limite operacional: uma mensagem agendada ha mais de 24 horas nao entra nessa
busca. Se houver atraso prolongado do worker, Redis ou banco, e necessario
avaliar manualmente mensagens pendentes antigas.

## API externa de envio

`POST /v1/api/external/:apiId` e protegido por `isAPIAuth` e enfileira
`SendMessageAPI` no Bull. A rota aceita um arquivo `media` unico com limite de
5 MB ou `mediaUrl` no payload.

O job `SendMessageAPI`:

1. recupera a sessao em memoria com `getWbot(sessionId)`;
2. valida o numero com `wbot.getNumberId()`;
3. cria/recupera contato e ticket;
4. chama `CreateMessageSystemService()` com `sendType: "API"` e
   `status: "pending"`;
5. salva `apiConfig` e `externalKey` no ticket para correlacao de callbacks.

Falhas conhecidas no job:

- numero invalido gera webhook `hookMessageStatus` com `ack: -1`, quando
  `urlMessageStatus` esta configurada;
- erro de sessao gera webhook com `ack: -2` e o job falha para retry do Bull.

`POST /v1/api/external/:apiId/start-session` verifica se a sessao esta
`CONNECTED`; se nao estiver, chama `StartWhatsAppSession()`.

## Webhooks e ACKs

`HandleMsgAck()` atualiza `Message.ack` quando o `whatsapp-web.js` informa
mudanca de ACK e emite `chat:ack`. Se o ticket possuir `apiConfig.externalKey`
e `apiConfig.urlMessageStatus`, tambem enfileira `WebHooksAPI` com
`hookMessageStatus`.

`WebHooksAPI` monta payloads especificos para:

- `hookMessageStatus`: `ack`, `messageId`, `externalKey`, `type`;
- `hookMessage`: `timestamp`, `message`, `messageId`, `ticketId`,
  `externalKey`, `type`;
- `hookSessionStatus`: `name`, `number`, `status`, `qrcode`, `timestamp`,
  `type`.

Quando `authToken` esta presente no payload interno, o job envia o webhook com
header `authorization`.

## Variaveis e configuracoes relevantes

- `IO_REDIS_SERVER`, `IO_REDIS_PORT`, `IO_REDIS_PASSWORD`: usados por Bull e
  pelo adapter Redis do Socket.IO.
- `CHROME_BIN`: caminho opcional do executavel Chromium/Chrome usado pelo
  Puppeteer.
- `CHROME_ARGS`: lista separada por virgula para substituir os argumentos
  padrao do Chromium.
- `WEB_VERSION`: versao do WhatsApp Web a carregar; se ausente, o codigo usa
  `2.2409.2` e cache remoto do `wppconnect-team/wa-version`.
- `TIMEZONE`: base para busca de mensagens agendadas.
- `MIN_SLEEP_INTERVAL` e `MAX_SLEEP_INTERVAL`: atraso aleatorio entre envios em
  `SendMessagesSystemWbot()`.
- `BACKEND_URL` e `PROXY_PORT`: montam URLs publicas de midia em `Message`.
- `CONNECTIONS_LIMIT`: limita criacao de conexoes por tenant.

Nao registrar valores reais de segredos em documentacao ou logs. Para operacao,
referencie somente os nomes das variaveis.

## Troubleshooting rapido

### `ERR_WAPP_NOT_INITIALIZED`

`getWbot()` nao encontrou a sessao em memoria. Verifique se a conexao aparece
como `CONNECTED`, se o processo atual executou `StartWhatsAppSession()` e se a
instancia correta do backend esta processando envios.

### QR Code aparece novamente no boot

Conexoes WhatsApp com status `qrcode` nao sao religadas por
`StartAllWhatsAppsSessions()`. O operador deve abrir a tela de canais e
concluir a leitura do QR Code.

### Mensagem agendada nao saiu

Verifique:

1. se Redis esta acessivel para Bull;
2. se o job `SendMessageSchenduled` esta ativo;
3. se `scheduleDate` esta dentro da janela dos ultimos 24 horas;
4. se o ticket esta `open` ou `pending`;
5. se a sessao do `whatsappId` esta em memoria.

### Midia falha e a sessao tenta recuperar

`SendWhatsAppMedia()` chama `StartWhatsAppSessionVerify()` quando ocorre erro.
A recuperacao so e disparada para mensagens de erro que contenham `session
closed`, `ERR_WAPP_NOT_INITIALIZED` ou a assinatura legada
`Cannot read property 'sendSeen' of undefined`.

### Texto falha sem reiniciar sessao

`SendWhatsAppMessage()` registra o erro e lanca `ERR_SENDING_WAPP_MSG`, mas a
chamada para `StartWhatsAppSessionVerify()` esta comentada. Se apenas envios de
texto falham apos queda de sessao, reinicie a conexao pela tela de canais ou
pela rota de start-session antes de investigar outros componentes.

### Nao marca como lida

`SetTicketMessagesAsRead()` atualiza banco e tenta `wbot.sendSeen()`. A falha
de `sendSeen()` chama `StartWhatsAppSessionVerify()` no `catch` da promise, mas
o helper nao interrompe a resposta HTTP; ele segue emitindo `ticket:update`.

## Cuidados ao alterar o fluxo

- Evite iniciar sessoes antes de `initIO()`, pois listeners emitem eventos de
  status para o tenant.
- Ao mudar retries de jobs, considere que `Queue.process()` processa cada fila
  com concorrencia 200.
- Ao alterar `SendMessageSystemProxy()`, valide os quatro tipos de canal que
  compartilham o helper.
- Ao alterar payloads de webhook, preserve `externalKey` para correlacao com
  sistemas externos.
- Ao mexer em arquivos de midia, lembre que uploads internos usam
  `backend/public` e a API externa limita `media` a 5 MB.
