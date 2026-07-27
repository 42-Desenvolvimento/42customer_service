# Sessoes de canais e tempo real

## Objetivo

Este guia descreve como o backend inicia, desconecta e publica estados de
canais em tempo real, e como o frontend consome esses eventos para atualizar a
tela de **Canais** e notificacoes.

## Codepaths cobertos

- `backend/src/routes/whatsappRoutes.ts`
- `backend/src/routes/whatsappSessionRoutes.ts`
- `backend/src/controllers/WhatsAppController.ts`
- `backend/src/controllers/WhatsAppSessionController.ts`
- `backend/src/services/WbotServices/StartAllWhatsAppsSessions.ts`
- `backend/src/libs/socket.ts`
- `backend/src/helpers/socketEmit.ts`
- `frontend/src/service/sessoesWhatsapp.js`
- `frontend/src/layouts/socketInitial.js`
- `frontend/src/pages/sessaoWhatsapp/Index.vue`
- `frontend/src/pages/sessaoWhatsapp/ItemStatusChannel.vue`
- `frontend/src/pages/sessaoWhatsapp/ModalQrCode.vue`

## Rotas principais

Todas as rotas abaixo usam `isAuth`.

### Cadastro e manutencao de canais

| Metodo | Rota | Controller | Uso |
| --- | --- | --- | --- |
| `GET` | `/whatsapp/` | `WhatsAppController.index` | Lista canais do tenant autenticado. |
| `GET` | `/whatsapp/:whatsappId` | `WhatsAppController.show` | Consulta um canal do tenant. |
| `POST` | `/whatsapp` | `WhatsAppController.store` | Cria canal respeitando `CONNECTIONS_LIMIT`. |
| `PUT` | `/whatsapp/:whatsappId` | `WhatsAppController.update` | Atualiza dados do canal. |
| `DELETE` | `/whatsapp/:whatsappId` | `WhatsAppController.remove` | Marca/remove canal via service, remove o wbot em memoria e emite delete. |

### Controle de sessao

| Metodo | Rota | Controller | Uso |
| --- | --- | --- | --- |
| `POST` | `/whatsappsession/:whatsappId` | `WhatsAppSessionController.store` | Inicia a sessao do canal. |
| `PUT` | `/whatsappsession/:whatsappId` | `WhatsAppSessionController.update` | Limpa `session` e reinicia; quando `isQrcode` vem no body, apaga a pasta local da sessao. |
| `DELETE` | `/whatsappsession/:whatsappId` | `WhatsAppSessionController.remove` | Desconecta a sessao e marca o canal como `DISCONNECTED`. |

O frontend encapsula essas chamadas em
`frontend/src/service/sessoesWhatsapp.js`:

```js
StartWhatsappSession(id)      // POST /whatsappsession/:id
RequestNewQrCode(channel)     // PUT /whatsappsession/:id
DeleteWhatsappSession(id)     // DELETE /whatsappsession/:id
ListarWhatsapps()             // GET /whatsapp/
UpdateWhatsapp(id, data)      // PUT /whatsapp/:id
```

## Inicializacao no boot

O backend sobe nesta ordem:

1. `backend/src/app/boot.ts` aguarda Postgres, configura Express, banco,
   modulos e Bull.
2. `backend/src/app/index.ts` inicia o HTTP server.
3. `initIO(app.server)` configura Socket.IO.
4. `StartAllWhatsAppsSessions()` reabre canais ativos depois que o Socket.IO ja
   esta disponivel.

`StartAllWhatsAppsSessions` busca canais `isActive: true` e:

- reabre WhatsApp quando `status` nao esta em `DISCONNECTED` nem `qrcode`;
- reabre Telegram quando ha `tokenTelegram` e status diferente de
  `DISCONNECTED`;
- reabre WABA 360 quando ha `tokenAPI` e `wabaBSP === "360"`;
- reabre Instagram quando ha `instagramKey`;
- reabre Messenger quando ha `tokenAPI`.

## Socket.IO: autenticacao, salas e eventos

`backend/src/libs/socket.ts` cria o servidor Socket.IO com:

- CORS aberto para o socket (`origin: "*"`);
- `pingTimeout: 180000`;
- `pingInterval: 60000`;
- adapter `socket.io-redis` configurado por `IO_REDIS_SERVER`,
  `IO_REDIS_PORT`, `IO_REDIS_USERNAME` e `IO_REDIS_PASSWORD`.

### Handshake autenticado

O frontend envia o token salvo em `localStorage` no campo `auth.token`:

```js
io(process.env.VUE_URL_API, {
  reconnection: true,
  autoConnect: true,
  transports: ['websocket'],
  auth: cb => cb({ token })
})
```

O backend valida esse token com `decodeTokenSocket`. Quando valido, mistura no
`socket.handshake.auth` os campos `id`, `tenantId`, `profile` e `user`. Quando
invalido, chama `next(new Error("authentication error"))`; em excecao tambem
emite `tokenInvalid:<socket.id>`.

No frontend, `socketInitial.js` escuta `tokenInvalid:<socket.id>`, desconecta,
limpa dados de login do `localStorage` e redireciona para `login`.

### Salas por tenant e ticket

Depois da conexao autenticada, o servidor:

- entra na sala do tenant: `<tenantId>`;
- aceita `<tenantId>:joinChatBox` e entra em `<tenantId>:<ticketId>`;
- aceita `<tenantId>:joinNotification` e entra em
  `<tenantId>:notification`;
- aceita `<tenantId>:joinTickets` e entra em `<tenantId>:<status>`.

`socketEmit` publica eventos de tickets e contatos na sala do tenant:

- tipos `contact:*` usam canal `<tenantId>:contactList`;
- demais tipos suportados usam canal `<tenantId>:ticketList`.

## Eventos de canais

Eventos de sessao usam o canal `<tenantId>:whatsappSession`.

| Evento | Origem | Payload | Efeito esperado |
| --- | --- | --- | --- |
| `action: "update"` | Start/restart, QR, auth failure, ready, monitoramento | `{ session }` | Atualiza a sessao no store e na tela. |
| `action: "readySession"` | `initWbot` no evento `ready` | `{ session }` | Notifica que a conexao esta pronta para enviar e receber. |

Outros canais tambem publicam nesse mesmo topico quando iniciam ou mudam estado
(Telegram, Instagram, Messenger e WABA 360), entao consumidores devem usar os
campos de `session.type` e `session.status`.

Eventos de remocao de canal usam `<tenantId>:whatsapp`:

- `action: "delete"` remove o canal do store pelo `whatsappId`;
- `action: "update"` atualiza dados de canal quando publicado por outros
  fluxos.

## Estados exibidos na tela de Canais

`ItemStatusChannel.vue` mapeia os estados atuais assim:

- `qrcode`: espera leitura do QR Code.
- `DISCONNECTED`: falha ou sessao desconectada; para WhatsApp, orienta tentar
  novamente ou pedir novo QR Code.
- `CONNECTED`: conexao estabelecida.
- `PAIRING` ou `TIMEOUT`: conexao com o celular perdida.
- `OPENING`: conexao em andamento.

A tela `frontend/src/pages/sessaoWhatsapp/Index.vue` habilita acoes conforme
estado:

- `Conectar`: quando `DISCONNECTED`;
- `Novo QR Code`: quando `DISCONNECTED` e `type === "whatsapp"`;
- `QR Code`: quando `type === "whatsapp"` e `status === "qrcode"`;
- `Desconectar`: quando o status esta em `OPENING`, `CONNECTED`, `PAIRING` ou
  `TIMEOUT`.

`ModalQrCode.vue` exibe `channel.qrcode`, permite solicitar novo QR Code e fecha
automaticamente quando o canal passa para `CONNECTED`.

## Troubleshooting rapido

- **Frontend nao atualiza status**: confirme se o token no `localStorage` e
  valido, se o socket conectou com `transports: ['websocket']` e se o usuario
  entrou em `<tenantId>:joinNotification`.
- **Eventos chegam para um tenant errado**: confira `tenantId` no JWT e no
  `socket.handshake.auth`; o backend converte `id` e `tenantId` para string no
  handshake.
- **Socket em ambiente com mais de uma instancia**: valide as variaveis
  `IO_REDIS_*`, pois o adapter Redis e responsavel por propagar eventos entre
  processos.
- **Sessao ativa nao reabre no boot**: confira `isActive`, `type` e `status`.
  WhatsApp em `qrcode` nao e reiniciado automaticamente no boot.
