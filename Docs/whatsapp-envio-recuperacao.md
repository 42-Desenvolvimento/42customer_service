# Envio e recuperacao de mensagens WhatsApp

Este guia descreve o caminho de envio de mensagens do atendimento ate o
`whatsapp-web.js`, como as sessoes sao inicializadas e quais falhas disparam
tentativa de recuperacao automatica.

## Escopo do fluxo

Codigo coberto:

- Frontend de atendimento: `frontend/src/pages/atendimento/InputMensagem.vue`
  e `frontend/src/service/tickets.js`.
- Rotas e controller de mensagens: `backend/src/routes/messageRoutes.ts` e
  `backend/src/controllers/MessageController.ts`.
- Criacao e despacho: `CreateMessageSystemService`,
  `SendMessageSystemProxy`, `SendWhatsAppMessage` e `SendWhatsAppMedia`.
- Sessoes WhatsApp: `libs/wbot.ts`, `StartWhatsAppSession`,
  `StartWhatsAppSessionVerify`, `StartAllWhatsAppsSessions` e `wbotMonitor`.
- Socket.IO: `libs/socket.ts`, `libs/decodeTokenSocket.ts`,
  `helpers/socketEmit.ts` e `frontend/src/layouts/socketInitial.js`.
- Agendamentos: job Bull `SendMessageSchenduled` e
  `SendMessagesSchenduleWbot`.

## Visao geral

1. O operador envia texto, arquivo, audio ou link pelo componente
   `InputMensagem.vue`.
2. O frontend chama `POST /messages/:ticketId` via `EnviarMensagemTexto`.
3. `MessageController.store` carrega o ticket, tenta marcar mensagens como
   lidas com `SetTicketMessagesAsRead` e delega a criacao para
   `CreateMessageSystemService`.
4. Se a mensagem nao possui `scheduleDate`, `CreateMessageSystemService`
   envia imediatamente pelo `SendMessageSystemProxy`.
5. Para tickets do canal WhatsApp:
   - mensagens de texto usam `SendWhatsAppMessage`;
   - midias usam `SendWhatsAppMedia`.
6. A mensagem persistida e emitida para o tenant via socket com `chat:create`.
7. Mensagens com `scheduleDate` ficam como `pending` e sao processadas pelo
   job Bull `SendMessageSchenduled`.

## Envio pelo atendimento

### Texto

`InputMensagem.vue` monta um objeto com `body`, `fromMe`, `read`,
`scheduleDate`, `quotedMsg` e um `id` gerado no frontend. Antes de enviar, o
componente tambem:

- expande mensagens rapidas quando o texto comeca com `/`;
- aplica assinatura do operador quando o toggle de assinatura esta ativo;
- bloqueia envio sem data quando a tela esta em modo de agendamento.

No backend, `SendWhatsAppMessage` obtem a sessao com `GetTicketWbot`, envia
para `<numero>@c.us` ou `<numero>@g.us`, desativa `linkPreview` e atualiza
`lastMessage`/`lastMessageAt` do ticket. Quando existe mensagem citada,
`SerializeWbotMsgId` gera o `quotedMessageId`.

Restricao atual: `SendWhatsAppMessage` apenas registra erro e retorna
`ERR_SENDING_WAPP_MSG`; a chamada para `StartWhatsAppSessionVerify` esta
comentada nesse caminho. Recuperacao automatica de sessao durante envio de
texto nao deve ser assumida.

### Midia e audio

O frontend aceita ate 5 arquivos e valida tamanho no `q-file`. A mensagem e
enviada como `multipart/form-data` no campo `medias`; audio gravado no browser
e enviado como arquivo `.mp3`.

`SendWhatsAppMedia` cria um `MessageMedia` com `MessageMedia.fromFilePath`,
envia com `sendAudioAsVoice: true`, atualiza o ticket, grava
`UserMessagesLog` quando ha `userId` e remove o arquivo temporario com
`fs.unlinkSync`.

Se o envio de midia falhar, o servico chama
`StartWhatsAppSessionVerify(ticket.whatsappId, err)` antes de propagar
`ERR_SENDING_WAPP_MSG`.

### Marcar conversa como lida

`MessageController.index` e `MessageController.store` chamam
`SetTicketMessagesAsRead` sem aguardar a promise. Esse helper:

- marca mensagens do ticket como `read`;
- zera `unreadMessages`;
- para WhatsApp, chama `wbot.sendSeen`;
- para Messenger, chama `messengerBot.markSeen`;
- emite `ticket:update` via `socketEmit`.

Se `sendSeen` falhar em WhatsApp, o `catch` chama
`StartWhatsAppSessionVerify`. Essa chamada tenta cobrir falhas conhecidas de
sessao durante a marcacao como lida, mas depende das assinaturas de erro
aceitas pelo helper.

## Agendamentos

O job `SendMessageSchenduled` e registrado em `app/bull.ts` e roda a cada
minuto. Ele chama `SendMessagesSchenduleWbot`, que busca mensagens:

- `fromMe: true`;
- `messageId` nulo;
- `status: "pending"`;
- `scheduleDate` entre agora e as ultimas 24 horas;
- tickets com status `open` ou `pending`.

Para tickets WhatsApp, o envio passa por `SendMessage`. Para outros canais, o
job usa `SendMessageSystemProxy`.

Configuracoes relevantes:

- `TIMEZONE`: timezone usada para comparar `scheduleDate`
  (padrao `America/Sao_Paulo`).
- `IO_REDIS_SERVER`, `IO_REDIS_PORT`, `IO_REDIS_PASSWORD`: conexao Redis do
  Bull e do adapter Socket.IO.

Restricao: agendamentos WhatsApp fora da janela de 24 horas nao sao
selecionados por esse job.

## Ciclo de vida da sessao WhatsApp

### Inicializacao no boot

`app/index.ts` inicializa HTTP, chama `initIO` e so depois executa
`StartAllWhatsAppsSessions`. Essa ordem e importante porque os eventos de
status de sessao dependem do Socket.IO.

`StartAllWhatsAppsSessions` inicia canais ativos:

- WhatsApp com status diferente de `DISCONNECTED` e `qrcode`;
- Instagram, Telegram, WABA e Messenger com status diferente de
  `DISCONNECTED`.

### Criacao do client

`initWbot` cria um `Client` do `whatsapp-web.js` com:

- `LocalAuth({ clientId: "wbot-<id>" })`;
- argumentos de Chromium vindos de `CHROME_ARGS` ou da lista minima interna;
- `CHROME_BIN` opcional;
- `WEB_VERSION` opcional, com padrao `2.2409.2`;
- cache remoto em
  `https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html`;
- `qrMaxRetries: 5`.

Eventos principais:

- `qr`: grava QR code, status `qrcode`, zera retries e emite
  `<tenantId>:whatsappSession`;
- `auth_failure`: pode limpar `session` apos retries e volta para
  `DISCONNECTED`;
- `ready`: grava status `CONNECTED`, numero, versoes do WhatsApp Web/browser,
  emite `readySession`, adiciona a sessao em memoria e sincroniza mensagens
  nao lidas.

As sessoes ficam somente no array em memoria de `libs/wbot.ts`; reinicios de
processo dependem do boot para recria-las.

### Monitoramento

`wbotMonitor` escuta:

- `change_state`: atualiza status do canal e emite socket;
- `change_battery`: salva bateria e avisa o frontend quando bateria <= 20 sem
  carregador;
- `disconnected`: marca a sessao como `OPENING`, limpa `session`/`qrcode` e
  tenta reiniciar apos 2 segundos com `StartWhatsAppSession`.

## Recuperacao automatica

`StartWhatsAppSessionVerify` normaliza o erro com `toString().toLowerCase()` e
reinicia a sessao quando a mensagem contem uma das assinaturas efetivamente
comparadas em lowercase:

- `session closed`;
- `err_wapp_not_initialized`;

O codigo tambem declara a assinatura
`TypeError: Cannot read property 'sendSeen' of undefined`, mas essa constante
esta com maiusculas enquanto o erro foi convertido para lowercase. No estado
atual, essa comparacao nao e confiavel para disparar recuperacao.

Quando ha correspondencia:

1. Busca o registro `Whatsapp` pelo id.
2. Atualiza status para `OPENING`.
3. Emite update de sessao no socket do tenant.
4. Chama `initWbot`.
5. Registra `wbotMessageListener` e `wbotMonitor`.

Chamadores atuais:

- `SetTicketMessagesAsRead`, quando `sendSeen` falha;
- `SendWhatsAppMedia`, quando envio de midia falha.

Nao ha recuperacao automatica nesse helper para todo erro de envio. Erros fora
das assinaturas acima apenas sao registrados pelo chamador.

## Socket.IO e eventos para o frontend

`initIO` usa CORS aberto, `pingTimeout` de 180s e adapter Redis. A autenticacao
le `socket.handshake.auth.token`, valida o JWT com `decodeTokenSocket`, anexa
`id`, `tenantId`, `profile` e `user` no handshake e coloca o socket na sala do
tenant.

Eventos de entrada registrados por tenant:

- `<tenantId>:joinChatBox` entra na sala do ticket;
- `<tenantId>:joinNotification` entra na sala de notificacoes;
- `<tenantId>:joinTickets` entra na sala por status de ticket.

Em token ausente ou invalido, a conexao falha com `authentication error`. No
catch, o backend tambem emite `tokenInvalid:<socket.id>`, que o frontend usa
para desconectar e redirecionar ao login.

Eventos de saida relevantes:

- `<tenantId>:whatsappSession`: atualizacao/pronto de sessao;
- `<tenantId>:change_battery`: alerta de bateria;
- `<tenantId>:ticketList` com `chat:create`, `ticket:update` e notificacoes.

## Operacao e troubleshooting

### Redis indisponivel

Sintomas:

- Socket.IO nao propaga eventos entre instancias.
- Jobs Bull nao processam agendamentos.
- `/admin/queues` pode falhar em ambiente nao-producao.

Verifique `IO_REDIS_SERVER`, `IO_REDIS_PORT`, `IO_REDIS_PASSWORD` e se o Redis
aceita conexao no banco usado pelo Bull (`db: 3` em `libs/Queue.ts`).

### QR code nao aparece ou sessao nao reinicia no boot

`StartAllWhatsAppsSessions` ignora sessoes WhatsApp em status `qrcode` ou
`DISCONNECTED`. Para forcar novo QR code pela aplicacao, use a acao que chama
`PUT /whatsappsession/:whatsappId` com `isQrcode`, pois o controller apaga a
pasta local da sessao antes de iniciar novamente.

### Erro ao enviar texto

`SendWhatsAppMessage` nao chama recuperacao automatica. Se o erro indicar
sessao ausente ou fechada, reinicie a sessao pelo painel ou pela rota
`POST /whatsappsession/:whatsappId` e acompanhe os eventos
`whatsappSession`.

### Erro ao enviar midia ou marcar como lida

Esses caminhos chamam `StartWhatsAppSessionVerify`, mas apenas erros com as
assinaturas conhecidas disparam reinicio. Caso a falha tenha outra mensagem,
investigue logs de `SendWhatsAppMedia`, `SetTicketMessagesAsRead` e
`wbotMonitor`.

### Mensagem agendada nao saiu

Confirme:

1. Redis/Bull ativo.
2. Job `SendMessageSchenduled` registrado.
3. `scheduleDate` dentro das ultimas 24 horas no timezone configurado.
4. Ticket com status `open` ou `pending`.
5. Para WhatsApp, sessao carregada em memoria para `ticket.whatsappId`.

## Cuidados ao alterar esse fluxo

- Mantenha `initIO` antes de `StartAllWhatsAppsSessions`; sessoes emitem
  eventos durante a inicializacao.
- Ao adicionar novas assinaturas de erro em `StartWhatsAppSessionVerify`, use
  comparacao em lowercase ou normalize a constante tambem.
- Se habilitar recuperacao em `SendWhatsAppMessage`, avalie risco de reinicios
  repetidos em erros permanentes de contato, midia ou quota.
- Nao assuma que o array `sessions` e compartilhado entre processos; ele e
  local a cada instancia Node.
- Ao alterar limites de upload no frontend, confira tambem limites de proxy,
  Express/Multer e armazenamento em `backend/public`.
