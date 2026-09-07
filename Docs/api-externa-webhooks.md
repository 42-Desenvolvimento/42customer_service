# API externa e webhooks

Este guia descreve o fluxo de integracao externa que envia mensagens por uma
sessao WhatsApp cadastrada no Izing e recebe callbacks de status. Ele foi
verificado nos seguintes pontos do codigo:

- Backend: `backend/src/routes/apiConfigRoutes.ts`,
  `backend/src/routes/apiExternalRoutes.ts`,
  `backend/src/controllers/APIConfigController.ts`,
  `backend/src/controllers/APIExternalController.ts`,
  `backend/src/middleware/isAPIAuth.ts`.
- Filas e callbacks: `backend/src/jobs/SendMessageAPI.ts`,
  `backend/src/jobs/WebHooksAPI.ts`, `backend/src/libs/Queue.ts`,
  `backend/src/models/ApiConfig.ts`, `backend/src/models/ApiMessage.ts` e
  `backend/src/models/Whatsapp.ts`.
- Frontend: `frontend/src/pages/api/Index.vue`,
  `frontend/src/pages/api/ModalApi.vue` e `frontend/src/service/api.js`.

## Intencao e arquitetura

A funcionalidade separa dois tipos de acesso:

1. **Administracao da configuracao**: usuario autenticado e com perfil `admin`
   cria, lista, edita, remove e renova tokens em `/api-config`.
2. **Consumo externo**: uma integracao chama `/v1/api/external/:apiId` com o
   token gerado para aquela configuracao. O backend valida o token e enfileira o
   trabalho `SendMessageAPI` no Bull/Redis.

Cada configuracao de API (`ApiConfig`) pertence a um `tenantId` e aponta para
uma sessao WhatsApp (`sessionId`). O token JWT gerado para a integracao expira em
`730d` e carrega `tenantId` e `sessionId`. Ao receber uma chamada externa, o
backend tambem confere se o `apiId` da URL pertence ao mesmo tenant e a mesma
sessao do token.

## Configurar uma API no painel

No frontend, a tela **Configuracoes API** lista as APIs cadastradas e exibe:

- URL de integracao: `${VUE_URL_API}/v1/api/external/<apiId>`.
- Token da API, copiavel pela UI.
- URL de webhook de status da sessao.
- URL de webhook de status da mensagem.
- Token de autenticacao opcional para callbacks.

Ao criar ou editar uma configuracao:

- `name` e `sessionId` sao obrigatorios.
- `urlServiceStatus` e `urlMessageStatus` sao opcionais, mas precisam ser URLs
  validas quando informadas.
- `authToken`, quando informado, e enviado no header `authorization` dos
  callbacks. Inclua o prefixo esperado pelo receptor, por exemplo
  `Bearer <token>` ou `Token <token>`.
- Apenas sessoes `whatsapp` nao deletadas aparecem como opcao de envio na UI.
- Renovar o token invalida integracoes que ainda usam o token anterior.

## Endpoints administrativos

Todos os endpoints abaixo usam o JWT de usuario do painel (`Authorization:
Bearer <TOKEN_DO_USUARIO>`) e exigem perfil `admin`.

| Metodo | Caminho | Uso |
| --- | --- | --- |
| `POST` | `/api-config` | Cria uma configuracao e gera o token de integracao. |
| `GET` | `/api-config` | Lista configuracoes do tenant ordenadas por nome. |
| `PUT` | `/api-config/:apiId` | Atualiza nome, sessao, webhooks, token de callback e status ativo. |
| `DELETE` | `/api-config/:apiId` | Remove a configuracao do tenant. |
| `PUT` | `/api-config/renew-token/:apiId` | Gera um novo token para a configuracao. |

Exemplo de criacao:

```bash
curl -X POST "<BACKEND_URL>/api-config" \
  -H "Authorization: Bearer <TOKEN_DO_USUARIO>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ERP principal",
    "sessionId": 1,
    "urlServiceStatus": "https://integrador.example/webhooks/sessao",
    "urlMessageStatus": "https://integrador.example/webhooks/mensagem",
    "authToken": "Bearer <TOKEN_DO_RECEPTOR>"
  }'
```

## Enviar mensagem pela API externa

### Autenticacao

Os endpoints externos usam o token da propria configuracao:

```http
Authorization: Bearer <TOKEN_DA_API>
```

O middleware `isAPIAuth` rejeita chamadas sem token ou com token invalido com
HTTP `403`.

### Envio de texto

```bash
curl -X POST "<BACKEND_URL>/v1/api/external/<apiId>" \
  -H "Authorization: Bearer <TOKEN_DA_API>" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "5599999999999",
    "body": "Ola! Seu atendimento foi atualizado.",
    "externalKey": "pedido-123"
  }'
```

Resposta de aceite:

```json
{ "message": "Message add queue" }
```

A resposta indica que o job foi adicionado a fila, nao que a mensagem ja foi
entregue ao WhatsApp.

### Envio com midia

O endpoint aceita `multipart/form-data` com um unico arquivo no campo `media`.
O limite configurado na rota e de **1 arquivo** com ate **5 MB**.

```bash
curl -X POST "<BACKEND_URL>/v1/api/external/<apiId>" \
  -H "Authorization: Bearer <TOKEN_DA_API>" \
  -F "number=5599999999999" \
  -F "body=Segue o documento solicitado." \
  -F "externalKey=pedido-123" \
  -F "media=@/caminho/arquivo.pdf"
```

Campos obrigatorios validados pelo controller:

- `body`: texto da mensagem.
- `number`: numero destino.
- `externalKey`: chave da integracao externa usada nos callbacks.
- `tenantId` e `sessionId` sao preenchidos a partir do token validado.

## Iniciar ou recuperar sessao

```bash
curl -X POST "<BACKEND_URL>/v1/api/external/<apiId>/start-session" \
  -H "Authorization: Bearer <TOKEN_DA_API>"
```

O backend:

1. valida `apiId`, `tenantId` e `sessionId`;
2. carrega a sessao via `ShowWhatsAppService`;
3. tenta consultar `getWbot(sessionId).getState()`;
4. chama `StartWhatsAppSession(whatsapp)` quando o estado nao e `CONNECTED` ou
   quando a consulta da sessao falha;
5. retorna o registro da sessao WhatsApp.

## Callbacks enviados pelo backend

Os callbacks sao executados pela fila `WebHooksAPI`, com `delay` inicial de 6
segundos, ate 50 tentativas e backoff fixo de 3 minutos entre falhas.

Quando o payload do callback inclui `authToken`, o job `WebHooksAPI` envia o
valor como:

```http
authorization: <authToken>
```

### Status da sessao

Origem: hook `Whatsapp.HookStatus` apos atualizacao da sessao.

URL de destino: `urlServiceStatus`.

Payload:

```json
{
  "name": "Atendimento 1",
  "number": "5599999999999",
  "status": "CONNECTED",
  "qrcode": null,
  "timestamp": 1720000000000,
  "type": "hookSessionStatus"
}
```

### Status da mensagem

Origem: atualizacoes de ACK em `HandleMsgAck`, persistencia de `ApiMessage` e
erros do job `SendMessageAPI`.

URL de destino: `urlMessageStatus`.

Payload:

```json
{
  "ack": 1,
  "messageId": "ABCDEF",
  "externalKey": "pedido-123",
  "type": "hookMessageStatus"
}
```

Casos especiais observados no job `SendMessageAPI`:

- `ack: -1`: numero nao encontrado no WhatsApp (`number invalid in whatsapp`).
- `ack: -2`: erro ao acessar ou usar a sessao (`error session`).

### Mensagem recebida

Origem: recebimento/sincronizacao de mensagens WhatsApp em tickets que carregam
`apiConfig.externalKey` e `apiConfig.urlMessageStatus`.

URL de destino: `urlMessageStatus`.

Payload:

```json
{
  "timestamp": 1720000000,
  "message": "Texto recebido do contato",
  "messageId": "ABCDEF",
  "ticketId": 123,
  "externalKey": "pedido-123",
  "type": "hookMessage"
}
```

## Fila e requisitos operacionais

- A fila Bull usa Redis configurado por `IO_REDIS_SERVER`, `IO_REDIS_PORT` e
  `IO_REDIS_PASSWORD`, sempre no banco Redis `db: 3`.
- `SendMessageAPI` e `WebHooksAPI` processam com concorrencia definida em
  `Queue.process()` (`queue.bull.process(200, queue.handle)`).
- O aceite HTTP do envio externo ocorre antes do processamento real. Para
  diagnostico, verifique logs do backend e falhas dos jobs Bull.
- Em caso de numero invalido, o arquivo enviado como `media` e removido do disco
  antes do callback de erro.
- O callback de webhook trata HTTP 404 como URL inexistente e encerra sem nova
  tentativa; outros erros sao reenfileirados conforme as tentativas do job.

## Armadilhas conhecidas

- `isActive` e salvo em `ApiConfig`, mas o controller da API externa nao bloqueia
  explicitamente chamadas quando a configuracao esta inativa. Nao use esse campo
  como unico mecanismo de revogacao; renove/remova o token quando precisar
  interromper uma integracao.
- O token da API contem `tenantId` e `sessionId`, mas nao contem `apiId`; a
  protecao contra troca de configuracao acontece pela consulta do `apiId` na URL
  e pela comparacao da sessao.
- `urlMessageStatus` tambem recebe eventos de mensagem recebida (`hookMessage`),
  nao apenas status de envio.
- O payload final dos callbacks nao inclui o campo `error`, mesmo quando ele e
  montado internamente em alguns fluxos de falha; consumidores devem usar `ack`
  e `type` para distinguir estados.
- Nos callbacks de erro `ack: -1` e `ack: -2`, o job `SendMessageAPI` monta o
  header a partir de `data.authToken`, mas o controller atual envia esse valor
  dentro de `apiConfig`. Valide o header nesses fluxos antes de depender dele.
- Tokens de callback (`authToken`) sao enviados sem transformacao. Informe o
  valor completo esperado pelo receptor, incluindo prefixos.
