# Recuperacao de sessao WhatsApp

## Objetivo

O backend tenta reabrir uma sessao WhatsApp quando operacoes do
`whatsapp-web.js` indicam que o cliente local foi fechado ou ainda nao esta
inicializado. O fluxo reduz a necessidade de intervencao manual em falhas
transientes de leitura e envio de midia.

## Codepaths cobertos

- `backend/src/helpers/SetTicketMessagesAsRead.ts`
- `backend/src/services/WbotServices/SendWhatsAppMedia.ts`
- `backend/src/services/WbotServices/StartWhatsAppSessionVerify.ts`
- `backend/src/services/WbotServices/StartWhatsAppSession.ts`
- `backend/src/services/WbotServices/wbotMonitor.ts`
- `backend/src/libs/wbot.ts`
- `backend/src/helpers/GetTicketWbot.ts`

## Quando a verificacao roda

`StartWhatsAppSessionVerify(whatsappId, error)` e acionado em dois pontos:

1. **Marcar mensagens como lidas**
   - `SetTicketMessagesAsRead` atualiza mensagens locais como lidas e zera
     `ticket.unreadMessages`.
   - Para tickets WhatsApp, chama `GetTicketWbot(ticket)` e executa
     `wbot.sendSeen(<numero>@c.us|g.us)`.
   - Se `sendSeen` rejeitar a promise, chama
     `StartWhatsAppSessionVerify(ticket.whatsappId, error)` e registra no
     console que nao foi possivel marcar como lido.

2. **Enviar midia**
   - `SendWhatsAppMedia` carrega o arquivo com
     `MessageMedia.fromFilePath(media.path)`.
   - Envia para `<numero>@c.us` ou `<numero>@g.us` com
     `{ sendAudioAsVoice: true }`.
   - Em sucesso, atualiza `ticket.lastMessage` e `ticket.lastMessageAt`, tenta
     gravar `UserMessagesLog` quando `userId` existe e remove o arquivo local
     com `fs.unlinkSync(media.path)`.
   - Em erro, registra `SendWhatsAppMedia | Error`, chama
     `StartWhatsAppSessionVerify(ticket.whatsappId, err)` e propaga
     `AppError("ERR_SENDING_WAPP_MSG")`.

> Observacao: envio de texto em `SendWhatsAppMessage` tambem captura erros de
> envio, mas a chamada a `StartWhatsAppSessionVerify` esta comentada no codigo
> atual.

## Erros que disparam reabertura

`StartWhatsAppSessionVerify` transforma o erro em string minuscula e so tenta
reabrir a sessao quando encontra uma das assinaturas efetivamente compativeis:

- `session closed`
- `err_wapp_not_initialized`

O codigo tambem declara a assinatura
`TypeError: Cannot read property 'sendSeen' of undefined`, mas a comparacao
atual usa o erro ja convertido para minusculas contra essa string com letras
maiusculas. Assim, essa assinatura especifica nao deve ser tratada como gatilho
garantido ate que a comparacao seja normalizada.

Quando ha correspondencia:

1. Busca o canal em `Whatsapp.findByPk(whatsappId)`.
2. Atualiza `status` para `OPENING`.
3. Emite no Socket.IO o evento
   `<tenantId>:whatsappSession` com `{ action: "update", session }`.
4. Chama `initWbot(whatsapp)`.
5. Registra `wbotMessageListener(wbot)` e `wbotMonitor(wbot, whatsapp)`.

Se ocorrer erro durante essa reabertura, o erro e registrado com `logger.error`;
o helper nao propaga a excecao para o chamador.

## Ciclo da sessao WhatsApp

`StartWhatsAppSession` e o ponto comum para iniciar canais. Para `type:
"whatsapp"`, ele:

1. Atualiza o canal para `OPENING`.
2. Emite `<tenantId>:whatsappSession` com `action: "update"`.
3. Chama `initWbot`.
4. Anexa listeners de mensagens e monitoramento.

`initWbot` cria um `Client` do `whatsapp-web.js` com:

- `LocalAuth({ clientId: "wbot-<id>" })`, persistindo a sessao em
  `.wwebjs_auth`.
- `takeoverOnConflict: true`.
- `puppeteer.executablePath` vindo de `CHROME_BIN`, quando definido.
- argumentos de Chromium vindos de `CHROME_ARGS` ou da lista minima do codigo.
- `webVersion` vindo de `WEB_VERSION` ou `2.2409.2`.
- cache remoto de versao em
  `https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html`.
- `qrMaxRetries: 5`.

Eventos principais do cliente:

- `qr`: quando a sessao ainda nao esta conectada, grava `qrcode`, status
  `qrcode`, zera `retries`, adiciona a sessao ao array em memoria e emite
  `<tenantId>:whatsappSession`.
- `auth_failure`: registra falha, limpa `session` apos mais de uma tentativa,
  marca `DISCONNECTED`, incrementa `retries`, emite atualizacao e rejeita a
  inicializacao.
- `ready`: grava status `CONNECTED`, limpa `qrcode`, zera `retries`, salva
  `number` e dados de versao/browser em `phone`, emite `update` e
  `readySession`, adiciona a sessao ao array em memoria, envia presenca e
  sincroniza mensagens nao lidas.

## Monitoramento e reconexao

`wbotMonitor` complementa o ciclo:

- `change_state`: grava o novo estado como `status` do canal e emite
  `<tenantId>:whatsappSession`.
- `change_battery`: grava `battery` e `plugged`; se a bateria estiver em `20`
  ou menos e o telefone nao estiver carregando, emite
  `<tenantId>:change_battery`.
- `disconnected`: marca a sessao como `OPENING`, limpa `session` e `qrcode`,
  agenda `StartWhatsAppSession(whatsapp)` apos 2 segundos e emite atualizacao.

## Operacao e troubleshooting

- **Sessao nao inicializada**: `GetTicketWbot` chama `getWbot(ticket.whatsappId)`.
  Se a sessao nao estiver no array em memoria, `getWbot` lanca
  `AppError("ERR_WAPP_NOT_INITIALIZED")`. Esse erro e uma das assinaturas que
  `StartWhatsAppSessionVerify` reconhece.
- **QR Code nao aparece**: confirme se o canal esta com `status: "qrcode"` e se
  o frontend esta recebendo `<tenantId>:whatsappSession`. A pasta de sessao pode
  ser removida por `apagarPastaSessao(id)`, usada quando a rota de novo QR Code
  recebe `isQrcode`.
- **Falhas de Chromium/Puppeteer**: valide `CHROME_BIN`, `CHROME_ARGS` e
  `WEB_VERSION`. O arquivo `backend/test-puppeteer.js` faz um teste manual
  simples abrindo `https://web.whatsapp.com`.
- **Multiplas instancias**: as sessoes WhatsApp ficam em memoria no processo
  (`sessions: Session[]`). Redis replica eventos Socket.IO, mas nao compartilha
  objetos `Client` do WhatsApp entre processos.

## Limitacoes atuais

- A verificacao automatica nao roda no envio de texto porque a chamada em
  `SendWhatsAppMessage` esta comentada.
- `StartWhatsAppSessionVerify` depende de trechos de mensagem de erro; erros
  diferentes do `whatsapp-web.js` podem nao disparar reabertura.
- A assinatura declarada para `Cannot read property 'sendSeen' of undefined`
  nao esta normalizada para minusculas, embora o erro recebido seja convertido
  antes da comparacao.
- Em falha de envio de midia, o chamador recebe `ERR_SENDING_WAPP_MSG` mesmo
  quando a reabertura foi iniciada em segundo plano.
