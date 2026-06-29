# Fluxos tecnicos do Izing

Este documento registra fluxos que cruzam backend, frontend, filas e integracoes
externas. Ele foi conferido contra o codigo-fonte atual e cobre areas citadas
como recentes no `CHANGELOG.md` 2.0.0/2.0.1: bot por conexao, envio via bot,
campanhas com delay, sessoes multicanal e integracoes por API.

## Visao geral da aplicacao

- **Backend**: Express + TypeScript + Sequelize. A inicializacao passa por
  `backend/src/app/index.ts` e `backend/src/app/boot.ts`: aguarda Postgres,
  configura Express, inicializa o banco, registra modulos/rotas e sobe Bull.
- **Frontend**: Quasar/Vue 2. As rotas de operacao ficam em
  `frontend/src/router/routes.js`, incluindo `/sessoes`, `/chat-flow`,
  `/campanhas`, `/api-service` e `/atendimento`.
- **Filas**: Bull usa Redis em `backend/src/libs/Queue.ts`, com host/porta de
  `IO_REDIS_SERVER` e `IO_REDIS_PORT`, senha opcional `IO_REDIS_PASSWORD` e
  banco Redis fixo `db: 3`. Cada fila processa ate 200 jobs em paralelo.
- **Socket**: depois que o servidor HTTP sobe, `initIO()` e chamado e so entao
  `StartAllWhatsAppsSessions()` reabre as sessoes ativas.
- **Dashboard Bull**: `backend/src/app/bull.ts` expoe `/admin/queues` apenas
  quando `NODE_ENV !== "production"`.

## ChatFlow e bot por conexao

### Intencao

O ChatFlow direciona tickets pendentes por um fluxo visual de nos. Ele envia
mensagens do bot, interpreta respostas do contato e pode encaminhar o ticket
para uma fila ou usuario.

### Onde configurar e persistir

- Frontend:
  - lista e builder em `/chat-flow` e `/chat-flow/builder`;
  - selecao do bot por conexao em `/sessoes`, campo `chatFlowId` carregado por
    `ListarChatFlow()`.
- Backend:
  - rotas autenticadas: `POST/GET /chat-flow`,
    `PUT/DELETE /chat-flow/:chatFlowId`;
  - controller: `backend/src/controllers/ChatFlowController.ts`;
  - modelo: `backend/src/models/ChatFlow.ts`, tabela `ChatFlow`, campo JSON
    `flow`, flags `isActive` e `isDeleted`, e `celularTeste`.

Somente usuarios admin criam e alteram fluxos pelo controller. O `flow` contem:

```json
{
  "name": "Atendimento inicial",
  "lineList": [{ "from": "start", "to": "node-1" }],
  "nodeList": [
    { "type": "configurations", "configurations": {} },
    { "id": "node-1", "type": "node", "interactions": [], "conditions": [] }
  ]
}
```

### Entrada no fluxo

`backend/src/helpers/CheckChatBotFlowWelcome.ts` decide se um ticket novo entra
no bot:

1. ignora tickets com `userId` definido ou grupos;
2. carrega a conexao (`Whatsapp`) do ticket;
3. escolhe `channel.chatFlowId` e, se nao houver, usa o setting
   `botTicketActive`;
4. exige `ChatFlow` ativo e nao deletado no mesmo tenant;
5. encontra no `lineList` a linha `from === "start"` e grava no ticket:
   `chatFlowId`, `stepChatFlow` e `lastInteractionBot`.

**Restricao importante:** `channel.chatFlowId` tem prioridade sobre o setting
global `botTicketActive`. Se nenhum dos dois existir, o ticket segue sem bot.

### Processamento de respostas

`backend/src/services/WbotServices/helpers/HandleMessage.ts` chama
`VerifyStepsChatFlowTicket()` apos gravar a mensagem e validar horario de
atendimento. O processamento so acontece quando o ticket:

- tem `chatFlowId`;
- esta com status `pending`;
- nao e mensagem `fromMe`;
- nao e grupo;
- ainda nao esta marcado como `answered`.

As condicoes sao comparadas com o corpo da mensagem em lowercase/trim. Condicao
com `type === "US"` funciona como "qualquer resposta".

As acoes suportadas estao em
`backend/src/services/ChatFlowServices/VerifyStepsChatFlowTicket.ts`:

| Acao | Efeito |
| --- | --- |
| `0` | Vai para `nextStepId`, zera `botRetries`, atualiza `lastInteractionBot` e envia as interacoes do proximo no. |
| `1` | Define `queueId`, limpa `chatFlowId`/`stepChatFlow`, registra log `queue` e pode autodistribuir para usuario. |
| `2` | Define `userId`, limpa `chatFlowId`/`stepChatFlow`, registra log `userDefine`. |

Quando uma acao termina em fila ou usuario, uma mensagem de boas-vindas pode ser
criada se `configurations.welcomeMessage.message` estiver preenchida.

### Mensagens do bot

`BuildSendMessageService` envia interacoes de texto e midia:

- texto usa template com `pupa`, incluindo `protocol` e `name`;
- midia usa arquivo salvo em `public/` e envia via `SendMessageSystemProxy`;
- mensagens geradas pelo bot entram com `sendType: "bot"` e status `pending`;
- eventos Socket `chat:create` e `ticket:update` atualizam a UI.

### Retentativas, encerramento e inatividade

- Respostas listadas em `configurations.answerCloseTicket` fecham o ticket e
  registram log `autoClose`.
- Se uma resposta nao casa com nenhuma condicao, o bot envia
  `notOptionsSelectMessage.message` ou a mensagem padrao, incrementa
  `botRetries` e repete as interacoes do no atual.
- Ao atingir `maxRetryBotMessage.number`, o ticket sai do bot e pode ir para
  fila (`type: 1`) ou usuario (`type: 2`) se houver `destiny`.
- `VerifyTicketsChatBotInactives` roda a cada 5 minutos e chama
  `FindUpdateTicketsInactiveChatBot` para mover tickets sem resposta com base em
  `notResponseMessage.time/type/destiny`.

**Restricao atual:** o job de inatividade filtra tickets cujo `chatFlowId` e
igual ao setting `botTicketActive`. Fluxos escolhidos apenas por conexao podem
nao ser tratados por essa rotina se o setting global apontar para outro fluxo.

### Contato de teste

`IsContactTest` so afeta canal `whatsapp`. Quando `celularTeste` esta
preenchido, contatos cujo numero nao contem o valor informado (ignorando o
primeiro caractere) sao ignorados pelo bot. Em outros canais, a checagem retorna
`false`.

## Sessoes multicanal e pipeline de mensagens WhatsApp

### Inicializacao de sessoes

`StartAllWhatsAppsSessions` carrega conexoes ativas:

- `whatsapp`: reinicia quando status nao esta em `DISCONNECTED` nem `qrcode`;
- `telegram`, `instagram`, `waba`, `messenger`: reinicia quando nao estao
  `DISCONNECTED` e possuem credenciais minimas do canal.

`StartWhatsAppSession` coloca a conexao em `OPENING`, emite
`<tenantId>:whatsappSession` e despacha conforme `Whatsapp.type`:

| Tipo | Servico |
| --- | --- |
| `whatsapp` | `initWbot`, `wbotMessageListener`, `wbotMonitor` |
| `telegram` | `StartTbotSession` |
| `instagram` | `StartInstaBotSession` |
| `messenger` | `StartMessengerBot` |
| `waba` + `wabaBSP === "360"` | `StartWaba360` |

No frontend, a criacao/edicao de conexoes fica em `/sessoes`. O modal permite
`whatsapp`, `telegram` e `instagram`; a listagem tambem trata `messenger`.

### Estados e QR Code do WhatsApp

`backend/src/libs/wbot.ts` usa `whatsapp-web.js` com `LocalAuth` e `clientId`
`wbot-<whatsapp.id>`. Eventos principais:

- `qr`: grava `qrcode`, status `qrcode`, zera `retries` e emite socket;
- `ready`: grava `CONNECTED`, limpa QR, atualiza numero/versao/browser, envia
  `readySession` e sincroniza mensagens nao lidas;
- `auth_failure`: depois de falhas, limpa a sessao, marca `DISCONNECTED` e
  emite socket;
- `disconnected`: `wbotMonitor` coloca status `OPENING`, limpa sessao/QR e
  tenta reiniciar em 2 segundos.

### Recebimento de mensagens

`wbotMessageListener` trata:

- `message_create` -> `HandleMessage`;
- `media_uploaded` -> `HandleMessage`;
- `message_ack` -> `HandleMsgAck`;
- `call` -> `VerifyCall`.

`HandleMessage` faz a sequencia:

1. descarta mensagens invalidas e status;
2. respeita `ignoreGroupMsg` quando habilitado;
3. identifica contato e, para grupos, `groupContact`;
4. cria ou encontra ticket via `FindOrCreateTicketService`;
5. ignora mensagens de campanha e despedida;
6. grava texto ou midia (`VerifyMessage`/`VerifyMediaMessage`);
7. valida horario de atendimento;
8. chama ChatFlow quando aplicavel;
9. dispara webhook de mensagem recebida quando o ticket tem `apiConfig` com
   `externalKey` e `urlMessageStatus`.

`HandleMsgAck` atualiza o `ack` de mensagens internas, contatos de campanha e
mensagens de API. Se o ticket veio de API externa, tambem enfileira webhook
`hookMessageStatus`.

### Problemas comuns

- `ERR_WAPP_NOT_INITIALIZED` indica que a sessao nao esta no array em memoria de
  `libs/wbot.ts`. Inicie a sessao pela UI ou por `POST /v1/api/external/:apiId/start-session`.
- Falhas de QR/autenticacao geralmente exigem nova leitura de QR ou limpeza da
  pasta `.wwebjs_auth/session-wbot-<id>`.
- O backend precisa de Chrome/Chromium acessivel por `CHROME_BIN` quando o
  ambiente nao fornece binario padrao.
- Eventos Socket dependem de `initIO()`; por isso sessoes so devem iniciar apos
  o servidor HTTP estar ouvindo.

## API externa e webhooks

### Cadastro administrativo

As configuracoes ficam em `/api-service` no frontend e nas rotas:

- `POST/GET /api-config`;
- `PUT/DELETE /api-config/:apiId`;
- `PUT /api-config/renew-token/:apiId`.

Campos principais (`ApiConfig`):

- `id`: UUID publico da configuracao;
- `sessionId`: conexao usada para enviar;
- `token`: JWT gerado pelo backend, expira em 730 dias;
- `authToken`: valor opcional repassado no header `authorization` dos webhooks;
- `urlServiceStatus`: webhook de status da sessao;
- `urlMessageStatus`: webhook de mensagens e status de mensagens.

Somente admin pode criar, alterar, listar, remover ou renovar token.

### Autenticacao da API externa

As rotas publicas exigem header:

```http
Authorization: Bearer <token-da-api-config>
```

`isAPIAuth` valida o JWT com `JWT_SECRET` e injeta `tenantId` e `sessionId` em
`req.APIAuth`. O controller tambem verifica se o `sessionId` do token coincide
com o `sessionId` salvo na `ApiConfig` do `:apiId`.

### Enviar mensagem

Endpoint:

```http
POST /v1/api/external/:apiId
Content-Type: multipart/form-data
Authorization: Bearer <token>
```

Payload minimo:

```json
{
  "body": "Ola, tudo bem?",
  "number": "5599999999999",
  "externalKey": "pedido-123"
}
```

O upload opcional deve usar o campo `media`; a rota limita para 1 arquivo de ate
5 MB. O controller valida `body`, `number`, `externalKey` e enfileira
`SendMessageAPI`.

O job `SendMessageAPI`:

- valida o numero no WhatsApp;
- cria/atualiza contato;
- cria/encontra ticket;
- cria uma mensagem de sistema com `sendType: "API"`;
- grava `apiConfig` no ticket com `externalKey`;
- em caso de numero invalido ou erro de sessao, envia webhook
  `hookMessageStatus` quando `urlMessageStatus` estiver configurada.

Resposta HTTP esperada apos enfileirar:

```json
{ "message": "Message add queue" }
```

### Iniciar sessao pela API

Endpoint:

```http
POST /v1/api/external/:apiId/start-session
Authorization: Bearer <token>
```

Se `getWbot(sessionId).getState()` nao estiver `CONNECTED`, o controller chama
`StartWhatsAppSession` para a conexao da `ApiConfig` e retorna o objeto da
sessao.

### Payloads de webhook

Todos os webhooks sao POST. Se `authToken` estiver configurado, ele e enviado no
header `authorization`.

`hookMessageStatus`:

```json
{
  "ack": 2,
  "messageId": "ABCDEF",
  "externalKey": "pedido-123",
  "type": "hookMessageStatus"
}
```

`hookMessage`:

```json
{
  "timestamp": 1710000000000,
  "message": {},
  "messageId": "ABCDEF",
  "ticketId": 123,
  "externalKey": "pedido-123",
  "type": "hookMessage"
}
```

`hookSessionStatus`:

```json
{
  "name": "Atendimento 1",
  "number": "5599999999999",
  "status": "CONNECTED",
  "qrcode": "",
  "timestamp": 1710000000000,
  "type": "hookSessionStatus"
}
```

`WebHooksAPI` tenta reenviar ate 50 vezes, com backoff fixo de 3 minutos. HTTP
404 nao derruba a fila; outros erros sao relancados para retry.

## Campanhas com agendamento e Bull

### Fluxo de uso

Frontend:

- `/campanhas` lista, cria, edita, inicia e cancela campanhas;
- `/campanhas/:campanhaId` gerencia contatos da campanha;
- o modal exige `name`, `start`, `message1`, `message2`, `message3` e
  `sessionId`;
- `delay` e exibido em segundos e inicia com valor padrao 20.

Backend:

- `POST/GET /campaigns`;
- `PUT/DELETE /campaigns/:campaignId`;
- `POST /campaigns/start/:campaignId`;
- `POST /campaigns/cancel/:campaignId`.

Somente admin executa operacoes de campanha.

### Agendamento

`StartCampaignService`:

1. carrega a campanha e seus contatos;
2. calcula `timeDelay` como `campaign.delay * 1000` ou `20000`;
3. converte `campaign.start` com timezone `America/Sao_Paulo`;
4. cria um job por contato em `SendMessageWhatsappCampaign`, usando
   `addBulk`;
5. incrementa o horario de envio a cada contato;
6. define `jobId` como
   `campaginId_<campaign.id>_contact_<contactId>_id_<campaignContact.id>`;
7. atualiza status da campanha para `scheduled`.

Cada contato recebe aleatoriamente uma das tres mensagens (`message1`,
`message2`, `message3`), e o campo escolhido e salvo como `messageRandom`.

### Envio e status

`SendMessageWhatsappCampaign` envia texto ou midia pela sessao WhatsApp da
campanha (`data.whatsappId`) e grava no `CampaignContacts`:

- `messageId`;
- `messageRandom`;
- `body`;
- `mediaName`;
- `timestamp`;
- `jobId`.

`Campaign` possui status `pending`, `scheduled`, `processing`, `canceled` e
`finished`. O hook `AfterFind` recalcula `processing`/`finished` com base nos
contadores de contatos quando a campanha nao esta em estado final.

### Constraints e pontos de atencao

- O calculo de janela valida 08:00-20:00 em `StartCampaignService`, mas a funcao
  `nextDayHoursValid` nao e chamada no fluxo atual de start. O agendamento usa
  diretamente `campaign.start`.
- O timezone de start e fixo em `America/Sao_Paulo`.
- O controller passa `options.delay: 2000`, mas cada job tambem recebe o delay
  calculado por contato. Ao depurar atrasos, confira o `opts.delay` final no
  Bull.
- O job usa `getWbot(data.whatsappId)`; campanhas falham se a sessao nao estiver
  inicializada no processo atual.

## Checklist de troubleshooting operacional

1. **Backend nao sobe**: confirmar Postgres antes de Express, pois
   `waitForPostgresConnection()` bloqueia o bootstrap.
2. **Filas paradas**: validar `IO_REDIS_SERVER`, `IO_REDIS_PORT`,
   `IO_REDIS_PASSWORD` e se o processo chamou `Queue.process()` em
   `backend/src/app/bull.ts`.
3. **Webhook nao chega**: confirmar URL na `ApiConfig`, verificar se o evento
   correto e `urlServiceStatus` ou `urlMessageStatus`, e observar retries da
   fila `WebHooksAPI`.
4. **Bot nao responde**: conferir se o ticket esta `pending`, sem `userId`, sem
   `answered`, sem grupo, dentro do horario de atendimento e com `chatFlowId`.
5. **Bot nao sai por inatividade**: verificar `botTicketActive` e a constraint
   atual do job de inatividade descrita acima.
6. **Campanha nao envia**: confirmar que a sessao da campanha esta conectada,
   que os jobs existem em `SendMessageWhatsappCampaign` e que a data inicial nao
   ficou no passado apos conversao de timezone.

