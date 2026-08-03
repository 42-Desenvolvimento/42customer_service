# Sessoes WhatsApp e recuperacao operacional

## Objetivo

O backend usa `whatsapp-web.js` para manter clientes WhatsApp em memoria,
publicar o estado das conexoes via Socket.IO e tentar reabrir sessoes quando
algumas operacoes indicam que o client local foi fechado ou ainda nao foi
inicializado. Este guia descreve o fluxo real no codigo atual e os limites da
recuperacao automatica.

## Codepaths cobertos

- Backend de boot: `backend/src/app/index.ts`, `backend/src/app/boot.ts`
- Socket.IO: `backend/src/libs/socket.ts`, `backend/src/libs/decodeTokenSocket.ts`
- Sessoes WhatsApp: `backend/src/libs/wbot.ts`
- Orquestracao de canais: `backend/src/services/WbotServices/StartAllWhatsAppsSessions.ts`
- Inicio/reinicio: `backend/src/services/WbotServices/StartWhatsAppSession.ts`
- Verificacao de recovery: `backend/src/services/WbotServices/StartWhatsAppSessionVerify.ts`
- Monitoramento: `backend/src/services/WbotServices/wbotMonitor.ts`
- Gatilhos de recovery: `backend/src/helpers/SetTicketMessagesAsRead.ts`,
  `backend/src/services/WbotServices/SendWhatsAppMedia.ts`
- Rotas operacionais: `backend/src/routes/whatsappRoutes.ts`,
  `backend/src/routes/whatsappSessionRoutes.ts`,
  `backend/src/controllers/WhatsAppController.ts`,
  `backend/src/controllers/WhatsAppSessionController.ts`
- Frontend: `frontend/src/service/sessoesWhatsapp.js`,
  `frontend/src/store/modules/whatsapp.js`,
  `frontend/src/layouts/socketInitial.js`,
  `frontend/src/utils/socket.js`

## Fluxo de boot

1. `backend/src/app/index.ts` cria o servidor HTTP, executa `bootstrap(app)` e
   passa o server para `initIO`.
2. `initIO` configura Socket.IO com Redis adapter e autentica cada conexao pelo
   token JWT recebido em `handshake.auth.token`.
3. Depois que o Socket.IO esta pronto, `StartAllWhatsAppsSessions()` busca
   canais ativos no banco e inicia os que podem voltar automaticamente.
4. Para registros `type: "whatsapp"`, somente canais ativos cujo `status` nao
   esta em `DISCONNECTED` nem `qrcode` sao reiniciados no boot.
5. `StartWhatsAppSession` marca a conexao como `OPENING`, emite
   `<tenantId>:whatsappSession` e chama `initWbot`.

O requisito de iniciar as sessoes somente apos `initIO` e importante: tanto
`StartWhatsAppSession` quanto `initWbot` emitem eventos de estado para o
frontend.

## Rotas de operacao

As rotas abaixo exigem `isAuth`:

```text
GET    /whatsapp/                 lista conexoes do tenant
GET    /whatsapp/:whatsappId      detalha uma conexao
POST   /whatsapp                  cria uma conexao
PUT    /whatsapp/:whatsappId      atualiza metadados da conexao
DELETE /whatsapp/:whatsappId      remove a conexao

POST   /whatsappsession/:id       inicia a sessao
PUT    /whatsappsession/:id       reinicia e pode solicitar novo QR Code
DELETE /whatsappsession/:id       desconecta a sessao
```

No frontend, `frontend/src/service/sessoesWhatsapp.js` encapsula essas chamadas
em funcoes como `StartWhatsappSession`, `RequestNewQrCode` e
`DeleteWhatsappSession`.

## Configuracao do client WhatsApp

`initWbot` cria um `Client` com:

- `LocalAuth({ clientId: "wbot-<id>" })`, persistindo credenciais em
  `.wwebjs_auth`.
- `takeoverOnConflict: true`.
- `puppeteer.executablePath` vindo de `CHROME_BIN`, quando definido.
- argumentos Chromium vindos de `CHROME_ARGS` separados por virgula; se a
  variavel nao existir, usa a lista minima definida em `backend/src/libs/wbot.ts`.
- `webVersion` vindo de `WEB_VERSION`; se ausente, usa `2.2409.2`.
- `webVersionCache` remoto em
  `https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html`.
- `qrMaxRetries: 5`.

O pacote atualmente declarado em `backend/package.json` e
`whatsapp-web.js` `^1.31.0`. Ao atualizar essa dependencia, valide pelo menos
login por QR Code, evento `ready`, envio de texto, envio de midia e `sendSeen`,
pois esses pontos dependem diretamente da API da biblioteca.

## Estados e eventos principais

`backend/src/libs/wbot.ts` atualiza o model `Whatsapp` conforme os eventos do
client:

- `qr`: grava `qrcode`, status `qrcode`, zera `retries`, registra a sessao em
  memoria e emite `<tenantId>:whatsappSession` com `action: "update"`.
- `auth_failure`: marca `DISCONNECTED`, incrementa `retries`, pode limpar
  `session` apos mais de uma tentativa e rejeita a inicializacao.
- `ready`: marca `CONNECTED`, limpa `qrcode`, zera `retries`, salva o numero e
  informacoes de versao/browser em `phone`, emite `action: "update"` e
  `action: "readySession"`, envia presenca e sincroniza mensagens nao lidas.

`wbotMonitor` adiciona listeners complementares:

- `change_state`: grava o novo estado no campo `status` e emite atualizacao.
- `change_battery`: grava `battery` e `plugged`; se a bateria for `20` ou menor
  e o celular nao estiver carregando, emite `<tenantId>:change_battery`.
- `disconnected`: marca `OPENING`, limpa `session` e `qrcode`, agenda
  `StartWhatsAppSession(whatsapp)` apos 2 segundos e emite atualizacao.

No frontend, `frontend/src/layouts/socketInitial.js` escuta
`<tenantId>:whatsappSession`, atualiza a store por `UPDATE_SESSION` e exibe uma
notificacao quando recebe `readySession`.

## Quando a recuperacao automatica roda

`StartWhatsAppSessionVerify(whatsappId, error)` tenta reabrir uma sessao somente
quando o erro convertido para string contem uma destas assinaturas:

- `session closed`
- `err_wapp_not_initialized`

Quando ha correspondencia, o helper:

1. Busca o registro em `Whatsapp.findByPk(whatsappId)`.
2. Atualiza `status` para `OPENING`.
3. Emite `<tenantId>:whatsappSession` com `{ action: "update", session }`.
4. Chama `initWbot(whatsapp)`.
5. Reanexa `wbotMessageListener(wbot)` e `wbotMonitor(wbot, whatsapp)`.

Hoje esse helper e chamado por dois fluxos:

- `SetTicketMessagesAsRead`: se `wbot.sendSeen()` rejeitar ao marcar um ticket
  WhatsApp como lido.
- `SendWhatsAppMedia`: se o envio de midia falhar; depois de iniciar a
  verificacao, o fluxo ainda propaga `AppError("ERR_SENDING_WAPP_MSG")`.

## Limites conhecidos

- `SendWhatsAppMessage` captura erro no envio de texto, mas a chamada para
  `StartWhatsAppSessionVerify` esta comentada. Portanto, envio de texto nao
  deve ser considerado gatilho de recovery automatico.
- `StartWhatsAppSessionVerify` declara a assinatura
  `TypeError: Cannot read property 'sendSeen' of undefined`, mas compara essa
  string com o erro ja convertido para minusculas. Na forma atual, essa
  assinatura especifica nao e um gatilho confiavel.
- As sessoes ficam em um array em memoria dentro de `backend/src/libs/wbot.ts`.
  O Redis adapter replica eventos Socket.IO, mas nao compartilha instancias
  `Client` do WhatsApp entre processos.
- Em boot, canais WhatsApp em `DISCONNECTED` ou `qrcode` nao sao reiniciados
  automaticamente; eles dependem de acao operacional pela rota de sessao.
- A configuracao de Socket.IO aceita `origin: "*"`. Se houver requisito de
  endurecimento de CORS em producao, isso precisa ser alterado no codigo e
  validado com o frontend.

## Troubleshooting rapido

### QR Code nao aparece

1. Verifique se a conexao recebeu `status: "qrcode"` no banco.
2. Confirme se o frontend esta conectado ao Socket.IO com token valido.
3. Observe eventos `<tenantId>:whatsappSession` no cliente.
4. Para gerar novo QR Code, use `PUT /whatsappsession/:id` com `isQrcode`; o
   controller chama `apagarPastaSessao(id)` antes de reiniciar.

### Erro `ERR_WAPP_NOT_INITIALIZED`

Esse erro vem de `getWbot(whatsappId)` quando a sessao nao existe no array em
memoria. Ele pode disparar recovery quando passa por `SetTicketMessagesAsRead`
ou `SendWhatsAppMedia`, mas nao quando ocorre apenas no envio de texto.

### Falhas de Chrome/Puppeteer

Confira:

- `CHROME_BIN` no ambiente ou no Dockerfile.
- `CHROME_ARGS`, se estiver sobrescrevendo a lista padrao.
- `WEB_VERSION`, quando for necessario fixar uma versao do WhatsApp Web.
- Permissoes e conteudo de `.wwebjs_auth`, especialmente apos trocar de imagem
  Docker ou mover o processo de host.

### Frontend nao reflete status da conexao

1. Valide o token JWT usado por `frontend/src/utils/socket.js`.
2. Confirme se o backend aceitou a conexao em `backend/src/libs/socket.ts`.
3. Verifique se o evento emitido e `<tenantId>:whatsappSession` com
   `action: "update"` ou `action: "readySession"`.
4. Confirme se a store `frontend/src/store/modules/whatsapp.js` tem a conexao
   carregada; `UPDATE_SESSION` atualiza apenas itens ja existentes no array.
