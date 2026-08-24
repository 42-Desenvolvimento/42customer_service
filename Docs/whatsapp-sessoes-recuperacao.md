# Sessoes WhatsApp e recuperacao de envio

Este guia descreve como o backend inicializa e recupera sessoes WhatsApp, quais
eventos chegam ao frontend e como diagnosticar falhas comuns de conexao. O
conteudo foi validado contra os arquivos listados em [Codigo coberto](#codigo-coberto).

## Codigo coberto

- Backend:
  - `backend/src/app/index.ts`
  - `backend/src/libs/socket.ts`
  - `backend/src/libs/decodeTokenSocket.ts`
  - `backend/src/libs/wbot.ts`
  - `backend/src/helpers/GetTicketWbot.ts`
  - `backend/src/helpers/SetTicketMessagesAsRead.ts`
  - `backend/src/routes/whatsappSessionRoutes.ts`
  - `backend/src/controllers/WhatsAppSessionController.ts`
  - `backend/src/controllers/APIExternalController.ts`
  - `backend/src/services/WbotServices/StartAllWhatsAppsSessions.ts`
  - `backend/src/services/WbotServices/StartWhatsAppSession.ts`
  - `backend/src/services/WbotServices/StartWhatsAppSessionVerify.ts`
  - `backend/src/services/WbotServices/SendMessage.ts`
  - `backend/src/services/WbotServices/SendWhatsAppMedia.ts`
  - `backend/src/services/WbotServices/SendWhatsAppMessage.ts`
  - `backend/src/services/WbotServices/SyncUnreadMessagesWbot.ts`
  - `backend/src/services/WbotServices/wbotMonitor.ts`
  - `backend/src/models/Whatsapp.ts`
- Frontend:
  - `frontend/src/utils/socket.js`
  - `frontend/src/layouts/socketInitial.js`
  - `frontend/src/service/sessoesWhatsapp.js`
  - `frontend/src/store/modules/whatsapp.js`
  - `frontend/src/pages/sessaoWhatsapp/Index.vue`
  - `frontend/src/pages/sessaoWhatsapp/ItemStatusChannel.vue`

## Intencao do fluxo

O sistema mantem uma instancia `whatsapp-web.js` por canal WhatsApp ativo. O
backend persiste o status do canal no banco e publica eventos por Socket.IO para
que operadores vejam QR Code, abertura, conexao, queda e alertas de bateria sem
recarregar a pagina.

Mudancas recentes reforcaram a recuperacao em dois pontos sensiveis:

- `SetTicketMessagesAsRead` chama `StartWhatsAppSessionVerify` quando
  `wbot.sendSeen(...)` falha.
- `SendWhatsAppMedia` chama `StartWhatsAppSessionVerify` antes de retornar
  `ERR_SENDING_WAPP_MSG` quando o envio de midia falha.

## Arquitetura resumida

1. `backend/src/app/index.ts` cria o servidor HTTP, chama `initIO(app.server)` e
   somente depois executa `StartAllWhatsAppsSessions()`.
2. `StartAllWhatsAppsSessions` busca canais ativos. Para tipo `whatsapp`, ignora
   status `DISCONNECTED` e `qrcode`; para outros canais, valida tipo e
   credenciais de Telegram, Instagram, WABA 360 ou Messenger.
3. `StartWhatsAppSession` grava status `OPENING`, emite
   `<tenantId>:whatsappSession` com `action: "update"` e, quando o tipo e
   `whatsapp`, registra:
   - `initWbot`, que cria o `Client` do `whatsapp-web.js`;
   - `wbotMessageListener`, que trata mensagens recebidas, midias, ACKs e
     chamadas;
   - `wbotMonitor`, que acompanha estado, bateria e desconexao.
4. `initWbot` usa `LocalAuth` com `clientId` `wbot-<whatsapp.id>` e guarda a
   sessao no array em memoria quando recebe QR Code ou fica pronta.
5. No evento `ready`, `initWbot` grava `CONNECTED`, limpa `qrcode`, zera
   `retries`, salva informacoes do telefone/navegador, emite `update` e
   `readySession`, envia presenca disponivel e sincroniza mensagens nao lidas.
6. `SyncUnreadMessagesWbot` busca chats com mensagens nao lidas apos o `ready`,
   ignora grupos, recria tickets quando necessario e dispara webhooks de status
   de mensagem quando o ticket possui configuracao externa.

## Dependencias e configuracao

- `backend/package.json` usa `whatsapp-web.js` `^1.31.0`.
- `initWbot` passa argumentos de Chromium via `puppeteer`.
  - Por padrao usa a lista `minimal_args` definida em `backend/src/libs/wbot.ts`.
  - `CHROME_ARGS` substitui a lista padrao quando definido, separando argumentos
    por virgula.
  - `CHROME_BIN` define o executavel do Chromium/Chrome.
- `WEB_VERSION` troca a versao do WhatsApp Web usada pelo client. Sem variavel,
  o fallback atual e `2.2409.2`.
- `CONNECTIONS_LIMIT` limita a criacao de canais em `WhatsAppController.store`.
- Socket.IO usa Redis adapter com:
  - `IO_REDIS_SERVER`
  - `IO_REDIS_PORT`
  - `IO_REDIS_USERNAME`
  - `IO_REDIS_PASSWORD`

## Interfaces publicas

Todas as rotas abaixo usam `isAuth` e estao registradas em
`backend/src/routes/whatsappSessionRoutes.ts`.

| Metodo | Rota | Efeito |
| --- | --- | --- |
| `POST` | `/whatsappsession/:whatsappId` | Busca o canal do tenant autenticado e chama `StartWhatsAppSession`. |
| `PUT` | `/whatsappsession/:whatsappId` | Limpa `session`; se `isQrcode` for verdadeiro, remove a pasta local da sessao antes de reiniciar. |
| `DELETE` | `/whatsappsession/:whatsappId` | Faz logout/remove a instancia do canal e grava status `DISCONNECTED`. |

O CRUD de canais fica em `/whatsapp/` e `/whatsapp/:whatsappId`. A criacao
respeita `CONNECTIONS_LIMIT`; a remocao chama `removeWbot` e emite
`<tenantId>:whatsapp` com `action: "delete"`.

Exemplo para solicitar novo QR Code pela API:

```http
PUT /whatsappsession/12
Content-Type: application/json

{
  "isQrcode": true
}
```

A API externa tambem pode iniciar uma sessao vinculada ao token da configuracao:
`POST /v1/api/external/:apiId/start-session` usa `isAPIAuth`,
`APIExternalController.startSession` valida `APIConfig.sessionId`, testa
`getWbot(...).getState() === "CONNECTED"` e chama `StartWhatsAppSession` quando
a sessao nao esta pronta. O envio externo de mensagem usa
`POST /v1/api/external/:apiId` com upload opcional no campo `media`.

## Eventos Socket.IO

### Autenticacao e salas

O cliente envia o JWT em `handshake.auth.token`. `decodeTokenSocket` valida o
token, copia `id`, `profile` e `tenantId` para `socket.handshake.auth` e carrega
o usuario. Quando a validacao retorna `isValid: false`, o middleware encerra a
conexao com `authentication error`; o evento `tokenInvalid:<socket.id>` so e
emitido se o middleware cair no bloco `catch`.

Ao conectar, o socket entra na sala do tenant (`tenantId`). A tela tambem pode
entrar em salas especificas:

- `<tenantId>:joinNotification`
- `<tenantId>:joinChatBox` com `ticketId`
- `<tenantId>:joinTickets` com `status`

### Eventos de sessoes WhatsApp

| Evento | Payload | Quando ocorre |
| --- | --- | --- |
| `<tenantId>:whatsappSession` | `{ action: "update", session }` | Status muda para `OPENING`, `qrcode`, `CONNECTED`, estados do WhatsApp ou desconexao. |
| `<tenantId>:whatsappSession` | `{ action: "readySession", session }` | `wbot` terminou o evento `ready`. |
| `<tenantId>:change_battery` | `{ action: "update", batteryInfo }` | Bateria menor ou igual a 20% e telefone sem carregador. |
| `<tenantId>:whatsapp` | `{ action: "update" | "delete", ... }` | CRUD de conexoes WhatsApp. |

`frontend/src/layouts/socketInitial.js` atualiza a store com `UPDATE_SESSION`,
emite `UPDATE_SESSION` no `$root` e mostra notificacao quando recebe
`readySession`.

### Webhooks de status

`Whatsapp.HookStatus` roda em `@AfterUpdate`. Quando a conexao possui
`ApiConfig.urlServiceStatus`, o backend enfileira `WebHooksAPI` com payload
`type: "hookSessionStatus"` contendo `name`, `number`, `status`, `qrcode` e
`timestamp`. Se a configuracao tiver `authToken`, o token e incluido no payload.

## Estados operacionais

- `OPENING`: backend esta tentando inicializar a sessao.
- `qrcode`: existe QR Code pendente para leitura.
- `CONNECTED`: sessao pronta para enviar e receber mensagens.
- `DISCONNECTED`: canal desligado manualmente ou falha de autenticacao.
- `PAIRING` e `TIMEOUT`: a interface mostra perda de conexao com o celular.
- Outros estados podem vir diretamente do WhatsApp Web por `change_state`; a
  interface deve tratar esses valores como estado operacional da sessao.

## Recuperacao automatica

`StartWhatsAppSessionVerify(whatsappId, error)` reinicializa a sessao somente
quando o texto do erro contem uma destas assinaturas:

- `session closed`
- `ERR_WAPP_NOT_INITIALIZED`
- `TypeError: Cannot read property 'sendSeen' of undefined`

Quando uma assinatura bate, o servico:

1. busca o canal por `whatsappId`;
2. grava status `OPENING`;
3. emite `<tenantId>:whatsappSession` com `action: "update"`;
4. chama `initWbot`;
5. registra novamente `wbotMessageListener` e `wbotMonitor`.

### Pontos que acionam a verificacao

- Marcacao de leitura:
  - `SetTicketMessagesAsRead` marca mensagens locais como lidas, zera
    `ticket.unreadMessages` e chama `wbot.sendSeen(...)`.
  - Se `sendSeen` rejeitar a promise, chama `StartWhatsAppSessionVerify` e loga
    `nao foi possivel marcar como lido`.
- Envio de midia:
  - `SendWhatsAppMedia` chama `wbot.sendMessage(...)` com `MessageMedia`.
  - Em erro, loga `SendWhatsAppMedia | Error`, chama
    `StartWhatsAppSessionVerify` e retorna `ERR_SENDING_WAPP_MSG`.
- Envio direto de texto:
  - `SendWhatsAppMessage` chama `wbot.sendMessage(...)`, atualiza
    `lastMessage`/`lastMessageAt` e registra `UserMessagesLog` quando ha
    `userId`.
  - Em erro, loga `SendWhatsAppMessage | Error`, mas a chamada para
    `StartWhatsAppSessionVerify` esta comentada.

### Limites conhecidos

- `SendMessage.ts` envia texto e midia a partir de registros `Message`, mas nao
  chama `StartWhatsAppSessionVerify`; erros sobem pelo job ou caller que executa
  o servico. `SendWhatsAppMessage.ts` tambem tem a chamada de recuperacao
  comentada para erros de texto.
- A comparacao de `StartWhatsAppSessionVerify` converte o erro recebido para
  minusculo, mas a assinatura `TypeError: Cannot read property 'sendSeen' of
  undefined` esta declarada com letras maiusculas. Essa assinatura especifica
  pode nao bater ate ser normalizada no codigo.
- `initWbot` mantem sessoes em memoria no array `sessions`; reinicios de
  processo dependem da pasta `.wwebjs_auth` gerenciada pelo `LocalAuth`.
- O array `sessions` e local ao processo. Deploys com multiplas instancias ou
  overlap podem fazer `getWbot` procurar a sessao no processo errado; alem
  disso, `takeoverOnConflict: true` permite que uma instancia derrube outra.
- `wbotMonitor` reinicia apos `disconnected` sem chamar `removeWbot`, e
  `StartWhatsAppSessionVerify` tambem reinicializa sem cleanup previo. Se o
  erro se repetir, acompanhe logs para identificar listeners duplicados ou
  sessoes orfas.
- O boot nao retoma canais em status `qrcode`, porque
  `StartAllWhatsAppsSessions` exclui esse status do restart automatico.
- `initWbot` loga erros no `catch` externo, mas nao chama `reject`; uma falha
  antes dos eventos do client pode deixar a promise sem conclusao explicita.
- `SyncUnreadMessagesWbot` ignora grupos e usa `unreadMessages.map(async ...)`
  sem aguardar explicitamente cada processamento individual.
- O envio de midia remove o arquivo temporario com `fs.unlinkSync(media.path)`
  somente depois do envio e do log de usuario terminarem com sucesso.

## Runbook de troubleshooting

### Operador nao ve QR Code

1. Confirme que o canal esta ativo e com tipo `whatsapp`.
2. Na tela de sessoes, clique em conectar quando o status estiver
   `DISCONNECTED`.
3. Se continuar sem QR Code, solicite novo QR Code. Esse caminho chama
   `PUT /whatsappsession/:id` com `isQrcode: true`, remove a pasta local da
   sessao e reinicia.
4. No backend, procure logs `Session QR CODE: <nome>-ID: <id>-<status>`.

### Sessao cai ou muda de estado inesperadamente

1. Verifique conexao do celular e se o WhatsApp esta aberto.
2. Aguarde o monitor emitir novo `whatsappSession:update`.
3. Se o status nao voltar, use desconectar e depois conectar ou solicite novo QR
   Code.
4. No backend, procure `Disconnected session: <nome> | Reason: <reason>`.
   `wbotMonitor` grava status `OPENING`, limpa `session` e `qrcode`, e tenta
   `StartWhatsAppSession` apos 2 segundos.

### Envio de midia retorna `ERR_SENDING_WAPP_MSG`

1. Verifique se o canal do ticket esta `CONNECTED`.
2. Procure o log `SendWhatsAppMedia | Error`.
3. Se o erro contiver uma assinatura reconhecida, a sessao deve voltar para
   `OPENING` e emitir `whatsappSession:update`.
4. Caso a recuperacao nao aconteca, compare o texto exato do erro com as
   assinaturas em `StartWhatsAppSessionVerify`.

### Mensagens continuam nao lidas no WhatsApp

1. Confirme se o ticket possui `contact.number` e `whatsappId`.
2. Verifique se `SetTicketMessagesAsRead` atualizou mensagens locais e
   `unreadMessages` para `0`.
3. Procure o log `nao foi possivel marcar como lido`.
4. Se o erro for de sessao fechada ou nao inicializada, a verificacao tenta
   reiniciar o `wbot`.

## Exemplo de fluxo completo

1. Usuario admin abre a tela de sessoes no frontend.
2. A pagina lista canais via servicos de WhatsApp.
3. Admin clica em conectar.
4. Frontend chama `POST /whatsappsession/:id`.
5. Backend grava `OPENING` e emite `<tenantId>:whatsappSession`.
6. `initWbot` recebe QR Code, grava status `qrcode` e emite novo `update`.
7. Admin abre o modal de QR Code e faz a leitura.
8. No evento `ready`, backend grava `CONNECTED`, emite `update` e
   `readySession`.
9. Frontend atualiza a store e mostra notificacao de conexao pronta.
