# Recuperacao de sessao WhatsApp

Este guia documenta o fluxo de recuperacao acionado quando uma sessao
`whatsapp-web.js` deixa de responder durante operacoes comuns de atendimento.
Ele cobre a mudanca recente relacionada ao envio de mensagens/midias e ao
marcar mensagens como lidas.

## Intencao

O backend mantem sessoes WhatsApp em memoria por processo, usando
`whatsapp-web.js` com `LocalAuth`. Quando a biblioteca perde o estado interno da
sessao, operacoes como `sendSeen` ou `sendMessage` podem falhar mesmo que a
conexao ainda exista no banco. O fluxo de recuperacao tenta colocar a conexao de
volta em `OPENING`, reinicializar o cliente e reconectar os listeners de
mensagem.

## Codepaths principais

| Responsabilidade | Arquivo |
| --- | --- |
| Inicializar cliente WhatsApp, QR Code e estado `CONNECTED` | `backend/src/libs/wbot.ts` |
| Reabrir conexoes ativas no boot da API | `backend/src/services/WbotServices/StartAllWhatsAppsSessions.ts` |
| Iniciar uma conexao e registrar listeners | `backend/src/services/WbotServices/StartWhatsAppSession.ts` |
| Monitorar `change_state`, bateria e `disconnected` | `backend/src/services/WbotServices/wbotMonitor.ts` |
| Detectar erros recuperaveis e reinicializar o wbot | `backend/src/services/WbotServices/StartWhatsAppSessionVerify.ts` |
| Marcar mensagens do ticket como lidas | `backend/src/helpers/SetTicketMessagesAsRead.ts` |
| Enviar midia WhatsApp pelo atendimento/API/bot | `backend/src/services/WbotServices/SendWhatsAppMedia.ts` |
| Emitir eventos de ticket para o frontend | `backend/src/helpers/socketEmit.ts` |

## Quando a recuperacao e acionada

`StartWhatsAppSessionVerify(whatsappId, error)` normaliza o erro recebido para
lowercase e compara contra estes sinais:

- `session closed`;
- `ERR_WAPP_NOT_INITIALIZED`;
- `TypeError: Cannot read property 'sendSeen' of undefined`.

Na implementacao atual, os dois primeiros sinais estao efetivos porque tambem
sao comparados em lowercase. O terceiro padrao esta escrito com maiusculas no
codigo enquanto o erro ja foi normalizado, entao pode nao casar ate que o padrao
tambem seja normalizado.

Hoje esse verificador e chamado em dois pontos:

1. `SetTicketMessagesAsRead`: quando `wbot.sendSeen(...)` rejeita ao tentar
   marcar mensagens como lidas.
2. `SendWhatsAppMedia`: quando o envio de midia cai no `catch` antes de retornar
   erro ao chamador.

> Restricao atual: `SendWhatsAppMessage` registra erro de envio de texto, mas a
> chamada para `StartWhatsAppSessionVerify` esta comentada. Portanto o fluxo de
> autorecuperacao cobre leitura (`sendSeen`) e midia, nao todos os erros de texto.

## O que acontece durante a reabertura

Quando o erro e reconhecido e a conexao existe:

1. o registro `Whatsapp` recebe `status: "OPENING"`;
2. o backend emite `${tenantId}:whatsappSession` com `action: "update"`;
3. `initWbot(whatsapp)` cria um novo cliente `whatsapp-web.js`;
4. `wbotMessageListener(wbot)` registra listeners para:
   - `message_create`;
   - `media_uploaded`;
   - `message_ack`;
   - `call`;
5. `wbotMonitor(wbot, whatsapp)` volta a monitorar estado, bateria e
   desconexoes.

Se o cliente chegar em `ready`, `libs/wbot.ts` atualiza a conexao para
`CONNECTED`, limpa o QR Code, grava numero/versao/browser, emite `readySession` e
sincroniza mensagens nao lidas.

## Impacto para usuarios e API

- Falha ao marcar mensagens como lidas nao deve impedir a resposta de
  `MessageController.index` ou `MessageController.store`; ambos envolvem
  `SetTicketMessagesAsRead(ticket)` em `try/catch`.
- Mesmo quando `sendSeen` falha, o helper atualiza mensagens locais para
  `read: true`, zera `ticket.unreadMessages` e emite `ticket:update` via
  `${tenantId}:ticketList`.
- Falha em envio de midia ainda retorna `ERR_SENDING_WAPP_MSG` ao fluxo de
  mensagem; a reabertura da sessao e disparada como efeito colateral para a
  proxima tentativa.

## Eventos Socket relevantes

- `StartWhatsAppSession`, `StartWhatsAppSessionVerify`, `wbot.ts` e
  `wbotMonitor.ts` emitem `${tenantId}:whatsappSession` para atualizar o estado
  da conexao na UI.
- `socketEmit` envia eventos de ticket para a sala do tenant:
  - canal padrao `${tenantId}:ticketList`;
  - payload `{ type, payload }`;
  - `ticket:update` e usado depois de marcar mensagens como lidas.
- `initIO` autentica o socket pelo token em `handshake.auth.token`, adiciona o
  cliente na sala do tenant e registra salas auxiliares de chat, notificacao e
  status de tickets.

## Variaveis e arquivos para conferir

- `backend/package.json`: usa `whatsapp-web.js` `^1.31.0`.
- `backend/.env.example`:
  - `CHROME_BIN` quando o ambiente nao fornece Chrome/Chromium no caminho
    padrao;
  - `WEB_VERSION` para fixar a versao do WhatsApp Web usada pelo cliente;
  - `IO_REDIS_SERVER`, `IO_REDIS_PORT` e `IO_REDIS_PASSWORD` para Socket/Bull.
- `.wwebjs_auth/session-wbot-<whatsapp.id>`: credenciais locais usadas pelo
  `LocalAuth`.

## Troubleshooting operacional

1. **Sessao fica em `OPENING`**: confira logs de `initWbot`, disponibilidade do
   Chrome/Chromium (`CHROME_BIN`) e se o processo consegue escrever em
   `.wwebjs_auth`.
2. **QR Code reaparece apos falha**: a sessao local pode ter expirado ou sido
   removida; releia o QR pela tela de sessoes.
3. **Logs mostram `ERR_WAPP_NOT_INITIALIZED`**: a sessao nao esta no array em
   memoria de `libs/wbot.ts`; inicie a conexao pela UI ou pela rota externa de
   start-session quando aplicavel.
4. **Logs mostram `nao foi possivel marcar como lido`**: o ticket ja foi marcado
   como lido localmente, mas o `sendSeen` falhou no WhatsApp; verifique se a
   conexao mudou para `OPENING` e depois `CONNECTED`.
5. **Midias continuam falhando apos reconectar**: valide o arquivo temporario
   recebido pelo upload, permissao de leitura e se a sessao usada pelo ticket e a
   mesma exibida como conectada na UI.

## Cuidados ao alterar este fluxo

- Evite chamar `initWbot` antes de `initIO`; a aplicacao inicia as sessoes
  somente depois que o servidor HTTP esta ouvindo para garantir que os eventos
  Socket existam.
- Se ampliar a recuperacao para envio de texto, preserve o comportamento atual de
  erro (`ERR_SENDING_WAPP_MSG`) para quem chama `SendWhatsAppMessage`.
- Ao adicionar novos padroes de erro em `StartWhatsAppSessionVerify`, prefira
  mensagens especificas da biblioteca para nao reiniciar sessoes em falhas de
  payload, permissao de arquivo ou validacao de contato.
