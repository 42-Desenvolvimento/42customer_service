# Sessoes WhatsApp e recuperacao de envio

Este guia descreve como o backend inicializa e recupera sessoes WhatsApp, quais
eventos chegam ao frontend e como diagnosticar falhas comuns de conexao. Ele foi
validado contra os arquivos listados em [Codigo coberto](#codigo-coberto).

## Codigo coberto

- Backend:
  - `backend/src/app/index.ts`
  - `backend/src/libs/socket.ts`
  - `backend/src/libs/decodeTokenSocket.ts`
  - `backend/src/libs/wbot.ts`
  - `backend/src/helpers/GetTicketWbot.ts`
  - `backend/src/helpers/SetTicketMessagesAsRead.ts`
  - `backend/src/helpers/socketEmit.ts`
  - `backend/src/routes/whatsappSessionRoutes.ts`
  - `backend/src/controllers/WhatsAppSessionController.ts`
  - `backend/src/services/WbotServices/StartAllWhatsAppsSessions.ts`
  - `backend/src/services/WbotServices/StartWhatsAppSession.ts`
  - `backend/src/services/WbotServices/StartWhatsAppSessionVerify.ts`
  - `backend/src/services/WbotServices/SendWhatsAppMessage.ts`
  - `backend/src/services/WbotServices/SendWhatsAppMedia.ts`
  - `backend/src/services/WbotServices/wbotMessageListener.ts`
  - `backend/src/services/WbotServices/wbotMonitor.ts`
- Frontend:
  - `frontend/src/utils/socket.js`
  - `frontend/src/layouts/socketInitial.js`
  - `frontend/src/service/sessoesWhatsapp.js`
  - `frontend/src/store/modules/whatsapp.js`
  - `frontend/src/pages/sessaoWhatsapp/Index.vue`
  - `frontend/src/pages/sessaoWhatsapp/ItemStatusChannel.vue`
  - `frontend/src/pages/sessaoWhatsapp/ModalQrCode.vue`

## Intencao do fluxo

O sistema mantem uma instancia `whatsapp-web.js` por canal WhatsApp ativo. O
backend atualiza o status do canal no banco e publica eventos por Socket.IO para
que operadores vejam QR Code, abertura, conexao, queda e alertas de bateria sem
recarregar a pagina.

Mudancas recentes tornaram a recuperacao mais visivel em dois pontos sensiveis:

- `SetTicketMessagesAsRead` chama `StartWhatsAppSessionVerify` quando
  `wbot.sendSeen(...)` falha.
- `SendWhatsAppMedia` chama `StartWhatsAppSessionVerify` antes de retornar
  `ERR_SENDING_WAPP_MSG` quando o envio de midia falha.

## Arquitetura resumida

1. `backend/src/app/index.ts` cria o servidor HTTP, inicializa Socket.IO com
   `initIO(app.server)` e so depois chama `StartAllWhatsAppsSessions()`.
2. `StartAllWhatsAppsSessions` busca canais ativos. Para WhatsApp, ignora status
   `DISCONNECTED` e `qrcode`; para outros canais considera Telegram, Instagram,
   WABA e Messenger conforme credenciais e tipo.
3. `StartWhatsAppSession` muda o status para `OPENING`, emite
   `<tenantId>:whatsappSession` e, quando o tipo e `whatsapp`, chama:
   - `initWbot`, que cria o `Client` do `whatsapp-web.js`;
   - `wbotMessageListener`, que registra mensagens, upload de midia, ack e
     chamadas;
   - `wbotMonitor`, que acompanha estado, bateria e desconexao.
4. `initWbot` usa `LocalAuth` com `clientId` `wbot-<whatsapp.id>` e adiciona a
   sessao em memoria quando recebe QR Code ou quando fica pronta.
5. Quando a sessao fica pronta, `initWbot` grava status `CONNECTED`, limpa
   `qrcode`, zera `retries`, salva informacoes do telefone/navegador, emite
   `update` e `readySession`, envia presenca disponivel e sincroniza mensagens
   nao lidas.

## Dependencias e configuracao

- `backend/package.json` usa `whatsapp-web.js` `^1.31.0`.
- `initWbot` passa argumentos de Chromium por `puppeteer`.
  - Por padrao usa a lista `minimal_args`.
  - `CHROME_ARGS` substitui a lista quando definido, separando argumentos por
    virgula.
  - `CHROME_BIN` define o executavel do Chromium/Chrome.
- `WEB_VERSION` troca a versao do WhatsApp Web usada pelo client. Sem variavel,
  o fallback atual e `2.2409.2`.
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

Exemplo para solicitar novo QR Code pela API:

```http
PUT /whatsappsession/12
Content-Type: application/json

{
  "isQrcode": true
}
```

## Eventos Socket.IO

### Autenticacao e salas

O cliente envia o JWT em `handshake.auth.token`. `decodeTokenSocket` valida o
token, copia `id`, `profile` e `tenantId` para `socket.handshake.auth` e carrega
o usuario. Quando a validacao retorna `isValid: false`, o middleware encerra a
conexao com `authentication error`; o evento `tokenInvalid:<socket.id>` so e
emitido se o proprio middleware cair no bloco `catch`.

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

`frontend/src/layouts/socketInitial.js` atualiza a store com `UPDATE_SESSION`,
emite `UPDATE_SESSION` no `$root` e mostra notificacao quando recebe
`readySession`.

## Estados operacionais

- `OPENING`: backend esta tentando inicializar a sessao.
- `qrcode`: existe QR Code pendente para leitura.
- `CONNECTED`: sessao pronta para enviar e receber mensagens.
- `DISCONNECTED`: canal desligado manualmente ou falha de autenticacao.
- `PAIRING` / `TIMEOUT`: estados vindos do WhatsApp Web tratados na interface
  como perda de conexao com o celular.

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
    `não foi possível marcar como lido`.
- Envio de midia:
  - `SendWhatsAppMedia` chama `wbot.sendMessage(...)` com `MessageMedia`.
  - Em erro, loga `SendWhatsAppMedia | Error`, chama
    `StartWhatsAppSessionVerify` e retorna `ERR_SENDING_WAPP_MSG`.

### Limites conhecidos

- `SendWhatsAppMessage` para texto nao chama `StartWhatsAppSessionVerify`; a
  importacao existe comentada e o erro retorna apenas `ERR_SENDING_WAPP_MSG`.
- A comparacao de `StartWhatsAppSessionVerify` converte o erro recebido para
  minusculo, mas a assinatura `TypeError: Cannot read property 'sendSeen' of
  undefined` esta declarada com letras maiusculas. Isso significa que essa
  assinatura especifica pode nao bater ate ser normalizada no codigo.
- `initWbot` mantem sessoes em memoria no array `sessions`; reinicios de
  processo dependem da pasta `.wwebjs_auth` gerenciada pelo `LocalAuth`.
- O envio de midia remove o arquivo temporario com `fs.unlinkSync(media.path)`
  somente depois do envio e do log de usuario terem terminado com sucesso.

## Runbook de troubleshooting

### Operador nao ve QR Code

1. Confirme que o canal esta ativo e com tipo `whatsapp`.
2. Na tela **Canais**, clique em **Conectar** quando o status estiver
   `DISCONNECTED`.
3. Se continuar sem QR Code, acione **Novo QR Code**. Esse caminho chama
   `PUT /whatsappsession/:id` com `isQrcode: true`, remove a pasta local da
   sessao e reinicia.
4. No backend, procure logs `Session QR CODE: <nome>-ID: <id>-<status>`.

### Sessao cai ou fica em `PAIRING`/`TIMEOUT`

1. Verifique conexao do celular e se o WhatsApp esta aberto.
2. Aguarde o monitor emitir novo `whatsappSession:update`.
3. Se o status nao voltar, use **Desconectar** e depois **Conectar** ou
   **Novo QR Code**.
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
3. Procure o log `não foi possível marcar como lido`.
4. Se o erro for de sessao fechada ou nao inicializada, a verificacao tenta
   reiniciar o `wbot`.

## Exemplo de fluxo completo

1. Usuario admin abre **Canais** no frontend.
2. A pagina lista canais via `GET /whatsapp/`.
3. Admin clica **Conectar**.
4. Frontend chama `POST /whatsappsession/:id`.
5. Backend grava `OPENING` e emite `<tenantId>:whatsappSession`.
6. `initWbot` recebe QR Code, grava status `qrcode` e emite novo `update`.
7. Admin abre o modal de QR Code e faz a leitura.
8. No evento `ready`, backend grava `CONNECTED`, emite `update` e
   `readySession`.
9. Frontend atualiza a store e mostra notificacao de conexao pronta.
