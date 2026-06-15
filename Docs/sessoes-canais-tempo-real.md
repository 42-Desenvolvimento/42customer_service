# Sessoes de canais e eventos em tempo real

Este guia descreve como o Izing inicializa, monitora e desconecta canais de atendimento, com foco no fluxo de WhatsApp Web. Ele tambem registra os eventos Socket.IO usados pela interface para refletir status de conexao.

## Quando usar este documento

- Investigar uma conexao que ficou em `OPENING`, `qrcode`, `DISCONNECTED` ou `CONFLICT`.
- Alterar o fluxo de criacao, reconexao ou encerramento de sessoes.
- Integrar uma tela ou automacao que precise acompanhar estados de canais por tenant.
- Conferir quais variaveis de ambiente afetam Chromium, Redis e versao do WhatsApp Web.

## Codepaths cobertos

| Area | Arquivos principais |
| --- | --- |
| API de canais | `backend/src/routes/whatsappRoutes.ts`, `backend/src/controllers/WhatsAppController.ts` |
| API de sessoes | `backend/src/routes/whatsappSessionRoutes.ts`, `backend/src/controllers/WhatsAppSessionController.ts` |
| Inicializacao de sessoes | `backend/src/services/WbotServices/StartWhatsAppSession.ts`, `backend/src/services/WbotServices/StartAllWhatsAppsSessions.ts` |
| WhatsApp Web client | `backend/src/libs/wbot.ts` |
| Monitoramento e eventos do client | `backend/src/services/WbotServices/wbotMonitor.ts`, `backend/src/services/WbotServices/wbotMessageListener.ts` |
| Socket.IO backend | `backend/src/libs/socket.ts` |
| Socket.IO frontend | `frontend/src/utils/socket.js`, `frontend/src/layouts/socketInitial.js` |
| Tela de canais | `frontend/src/pages/sessaoWhatsapp/Index.vue`, `frontend/src/service/sessoesWhatsapp.js`, `frontend/src/store/modules/whatsapp.js` |
| Indicador de status | `frontend/src/components/StatusWhatsapp.vue`, `frontend/src/components/ItemStatusWhatsapp.vue` |

## Modelo mental

1. A conexao e cadastrada em `Whatsapps` com `tenantId`, `type`, `status`, credenciais opcionais e configuracoes como `chatFlowId`.
2. A tela **Canais** lista `GET /whatsapp/` e aciona `POST`, `PUT` ou `DELETE /whatsappsession/:whatsappId`.
3. `StartWhatsAppSession` marca a conexao como `OPENING`, emite `${tenantId}:whatsappSession` e delega para o starter do tipo do canal.
4. Para `type === "whatsapp"`, `initWbot` cria um `Client` de `whatsapp-web.js` com `LocalAuth`, registra eventos de QR Code/autenticacao/pronto e armazena a sessao em memoria.
5. `wbotMessageListener` registra handlers para mensagens, upload de midia, ACK e chamadas.
6. `wbotMonitor` escuta mudancas de estado, bateria e desconexao. Em desconexao, ele atualiza status para `OPENING`, limpa `session`/`qrcode` e tenta reiniciar a sessao depois de 2 segundos.
7. O frontend assina eventos por tenant e atualiza o Vuex (`UPDATE_SESSION`, `UPDATE_WHATSAPPS`, `DELETE_WHATSAPPS`).

## API operacional

Todas as rotas abaixo passam por `isAuth`; envie o JWT no mesmo formato usado pelo restante da API.

### Listar e gerenciar cadastro do canal

```http
GET    /whatsapp/
GET    /whatsapp/:whatsappId
POST   /whatsapp
PUT    /whatsapp/:whatsappId
DELETE /whatsapp/:whatsappId
```

Exemplo minimo para criar um canal WhatsApp:

```bash
curl -X POST "$BACKEND_URL/whatsapp" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Suporte principal",
    "type": "whatsapp",
    "farewellMessage": "Atendimento encerrado."
  }'
```

Restricoes verificadas no codigo:

- `name` e unico no model `Whatsapp`.
- `POST /whatsapp` bloqueia criacao quando a quantidade de conexoes do tenant alcanca `CONNECTIONS_LIMIT`.
- A tela atual de cadastro oferece `whatsapp`, `telegram` e `instagram`. O backend tambem tem ramificacoes historicas para outros starters; valide o model e migrations antes de expor novos tipos na UI.

### Iniciar, renovar QR Code e desconectar sessao

```http
POST   /whatsappsession/:whatsappId
PUT    /whatsappsession/:whatsappId
DELETE /whatsappsession/:whatsappId
```

Uso esperado:

- `POST` inicia a sessao existente.
- `PUT` limpa `session` antes de iniciar novamente. Quando o body contem `isQrcode: true`, tambem remove a pasta local `.wwebjs_auth/session-wbot-<id>` para forcar um novo QR Code.
- `DELETE` faz logout/destroy conforme o tipo do canal, remove a sessao em memoria quando aplicavel e persiste `DISCONNECTED`, `session: ""`, `qrcode: null`, `retries: 0`.

Exemplo para solicitar novo QR Code:

```bash
curl -X PUT "$BACKEND_URL/whatsappsession/42" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id": 42, "isQrcode": true}'
```

## Estados de sessao

| Estado | Origem principal | Significado operacional |
| --- | --- | --- |
| `OPENING` | `StartWhatsAppSession`, `StartWhatsAppSessionVerify`, `wbotMonitor` | O backend esta criando ou recriando o client. A UI exibe "Conectando". |
| `qrcode` | evento `qr` em `initWbot` | O WhatsApp Web gerou QR Code e aguarda leitura pelo celular. |
| `CONNECTED` | evento `ready` em `initWbot` | Client pronto para enviar/receber; `number` e dados de `phone` sao atualizados. |
| `DISCONNECTED` | falha de autenticacao ou `DELETE /whatsappsession/:id` | Sessao encerrada ou nao inicializada. A UI exibe botao "Conectar". |
| `PAIRING`, `TIMEOUT`, `DESTROYED`, `CONFLICT` | eventos de estado do `whatsapp-web.js` repassados por `change_state` | Estados de alerta exibidos no frontend. `CONFLICT` indica uso concorrente do WhatsApp Web. |

Na subida da aplicacao, `StartAllWhatsAppsSessions` reabre canais ativos. Para WhatsApp, sessoes em `DISCONNECTED` ou `qrcode` nao sao iniciadas automaticamente; os demais estados ativos entram no fluxo de start.

## Eventos Socket.IO

O backend inicializa Socket.IO com Redis adapter e autentica o socket pelo JWT em `handshake.auth.token`. O `tenantId` do token define a sala base do tenant.

### Salas de cliente

| Evento emitido pelo cliente | Sala criada |
| --- | --- |
| `${tenantId}:joinNotification` | `${tenantId}:notification` |
| `${tenantId}:joinChatBox` com `ticketId` | `${tenantId}:${ticketId}` |
| `${tenantId}:joinTickets` com `status` | `${tenantId}:${status}` |

### Eventos de canal recebidos pela UI

| Evento | Payload observado | Consumidor |
| --- | --- | --- |
| `${tenantId}:whatsappSession` | `{ action: "update", session }` | Atualiza status, `qrcode`, `updatedAt` e `retries` no Vuex. |
| `${tenantId}:whatsappSession` | `{ action: "readySession", session }` | Exibe notificacao positiva informando nome e numero conectados. |
| `${tenantId}:change_battery` | `{ action: "update", batteryInfo }` | Notifica bateria baixa quando `battery <= 20` e `plugged === false`. |
| `${tenantId}:whatsapp` | `{ action: "delete", whatsappId }` | Remove canal da store. |

## Configuracao de runtime

Variaveis relevantes em `backend/.env.example` e no codigo:

| Variavel | Uso |
| --- | --- |
| `IO_REDIS_SERVER`, `IO_REDIS_PORT`, `IO_REDIS_USERNAME`, `IO_REDIS_PASSWORD` | Socket.IO Redis adapter. Necessario em ambientes com multiplas instancias. |
| `CHROME_BIN` | Caminho do Chrome/Chromium usado pelo Puppeteer. Se ausente, o client usa o default do pacote. |
| `CHROME_ARGS` | Lista separada por virgula para sobrescrever os argumentos minimos de Chromium. |
| `WEB_VERSION` | Versao do WhatsApp Web carregada pelo cache remoto; default atual no codigo: `2.2409.2`. |
| `CONNECTIONS_LIMIT` | Limite de canais por tenant validado ao criar conexao. |

## Runbook de troubleshooting

### A conexao ficou em `qrcode`

1. Abra **Canais** e confirme se o botao **QR Code** aparece para a conexao.
2. Leia o QR Code pelo aplicativo do WhatsApp no celular.
3. Se o QR Code parecer expirado, use **Novo QR Code**. Isso chama `PUT /whatsappsession/:id` com `isQrcode: true` e remove a pasta local de auth daquela sessao.
4. Verifique logs com `Session QR CODE: <nome>-ID: <id>-<status>` para confirmar que o evento `qr` esta chegando.

### A conexao ficou em `OPENING`

1. Confira se `CHROME_BIN` aponta para um binario existente quando o ambiente nao usa o Chromium embutido.
2. Revise `CHROME_ARGS`; quando definida, a variavel substitui a lista minima inteira.
3. Procure erros `initWbot error`, `StartWhatsAppSession | Error` ou falhas do Puppeteer.
4. Se houver erro `ERR_WAPP_NOT_INITIALIZED`, o helper `StartWhatsAppSessionVerify` tenta reinicializar quando recebe erros conhecidos de sessao fechada.

### A conexao caiu para `DISCONNECTED`

1. Verifique se houve `auth_failure`; depois de mais de uma tentativa o codigo limpa `session` e incrementa `retries`.
2. Para uma desconexao manual, confirme que `DELETE /whatsappsession/:id` retornou `Session disconnected.`.
3. Para desconexao inesperada, `wbotMonitor` registra `Disconnected session: <nome> | Reason: <motivo>` e tenta iniciar novamente apos 2 segundos.
4. Se a sessao continuar indisponivel, gere um novo QR Code para limpar a autenticacao local.

### Usuarios nao recebem atualizacao de status

1. Confirme que o frontend tem token valido no `localStorage` e que o socket nao recebeu `tokenInvalid:<socket.id>`.
2. Confira se o `tenantId` do usuario e o `tenantId` da conexao sao os mesmos; os eventos sao publicados como `${tenantId}:whatsappSession`.
3. Valide conectividade com Redis quando houver mais de uma instancia de backend, pois Socket.IO usa o adapter Redis.
4. No frontend, a atualizacao entra por `socketInitial.js` e mutacao `UPDATE_SESSION`.

## Cuidados ao alterar este fluxo

- Nao remova a emissao de `update` antes de iniciar sessoes; a UI depende dela para sair do estado anterior.
- Ao adicionar novos estados, atualize tambem `ItemStatusWhatsapp.vue` para evitar acesso a `status[wbot.status]` inexistente.
- Ao expor novos tipos de canal na UI, alinhe model, migrations, services de start/remove e campos obrigatorios do modal.
- Evite apagar `.wwebjs_auth` globalmente; o helper `apagarPastaSessao` remove apenas `session-wbot-<id>`.
- `sessions` em `backend/src/libs/wbot.ts` e uma lista em memoria. Reinicios de processo dependem de `LocalAuth` em disco e de `StartAllWhatsAppsSessions` para reabrir canais ativos.
