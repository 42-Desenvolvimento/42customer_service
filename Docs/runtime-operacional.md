# Runtime operacional do backend

## Objetivo

Este guia resume as dependencias de runtime do backend e os pontos que mais
afetam setup, execucao local e troubleshooting: Postgres, Redis, Bull,
RabbitMQ, Chrome/Chromium e variaveis de ambiente.

## Codepaths cobertos

- `backend/.env.example`
- `backend/package.json`
- `backend/src/app/config-env.ts`
- `backend/src/app/boot.ts`
- `backend/src/app/index.ts`
- `backend/src/app/express.ts`
- `backend/src/config/database.ts`
- `backend/src/libs/socket.ts`
- `backend/src/libs/Queue.ts`
- `backend/src/app/bull.ts`
- `backend/src/libs/rabbitmq-server.ts`
- `backend/src/libs/wbot.ts`
- `backend/test-puppeteer.js`

## Comandos principais

No diretorio `backend/`:

```bash
npm run dev:server   # ts-node-dev em src/server.ts
npm run build        # compila TypeScript
npm run start        # nodemon em dist/server.js
npm run db:migrate   # limpa dist, compila e roda migrations
npm run db:seed      # roda seeds
npm test             # migrations/seeds de teste, jest e rollback
```

O `package.json` declara Node `>=18` para o backend.

## Carregamento de ambiente

`backend/src/app/config-env.ts` carrega:

- `.env.test` quando `NODE_ENV === "test"`;
- `.env` nos demais ambientes.

`backend/.env.example` e a referencia de variaveis. Ao atualizar o sistema,
revise esse arquivo antes de subir o backend.

## Boot do backend

Fluxo de inicializacao:

1. `server.ts` chama `app.start()`.
2. `app/boot.ts` aguarda Postgres, configura Express, banco, modulos e Bull.
3. `app/index.ts` inicia o HTTP server.
4. `initIO(app.server)` inicializa Socket.IO.
5. `StartAllWhatsAppsSessions()` tenta reabrir canais ativos.

Essa ordem importa porque os fluxos de sessao emitem eventos Socket.IO durante
inicializacao e reconexao.

## Variaveis de rede e HTTP

| Variavel | Uso no codigo |
| --- | --- |
| `BACKEND_URL` | Base para construcao de hooks, conforme `.env.example`. |
| `FRONTEND_URL` | Origem permitida no CORS do Express e usada em diretivas Helmet fora de `dev`. |
| `PROXY_PORT` | Porta esperada por proxy, conforme `.env.example`. |
| `PORT` | Porta do HTTP server; se ausente, o app usa `3100`. |
| `NODE_ENV` | Define arquivo `.env`, uso de Helmet e exposicao do Bull Board. |

`app/express.ts` aplica Helmet quando `NODE_ENV !== "dev"`. Em ambientes nao
produtivos onde `NODE_ENV` tambem nao seja `dev`, revise as diretivas de CSP em
caso de bloqueios no frontend.

## Postgres

`backend/src/config/database.ts` usa:

| Variavel | Padrao no codigo |
| --- | --- |
| `DB_DIALECT` | `postgres` |
| `DB_PORT` | `5432` |
| `POSTGRES_HOST` | `localhost` |
| `POSTGRES_DB` | `wchats` |
| `POSTGRES_USER` | `postgres` |
| `POSTGRES_PASSWORD` | `postgres` |
| `POSTGRES_POOL_MAX` | `100` |
| `POSTGRES_POOL_MIN` | `10` |
| `POSTGRES_POOL_ACQUIRE` | `30000` |
| `POSTGRES_POOL_IDLE` | `10000` |

O boot chama uma espera de conexao com Postgres antes de configurar banco e
modulos. Falhas nessa etapa bloqueiam a subida do backend.

## Redis: Socket.IO e Bull

O mesmo host Redis aparece em dois pontos:

1. **Socket.IO adapter**
   - `backend/src/libs/socket.ts`
   - variaveis: `IO_REDIS_SERVER`, `IO_REDIS_PORT`, `IO_REDIS_USERNAME`,
     `IO_REDIS_PASSWORD`
   - replica eventos Socket.IO entre processos.

2. **Bull**
   - `backend/src/libs/Queue.ts`
   - variaveis: `IO_REDIS_SERVER`, `IO_REDIS_PORT`, `IO_REDIS_PASSWORD`
   - usa `db: 3` fixo no codigo.

`IO_REDIS_DB_SESSION` existe em `.env.example`, mas nao e usado por
`Queue.ts`; a fila Bull fixa o banco Redis em `3`.

## Bull e rotinas agendadas

`Queue.ts` registra todos os jobs exportados por `backend/src/jobs/Index.ts` e
processa cada fila com concorrencia `200`.

Jobs exportados atualmente:

- `SendMessageWhatsappCampaign`
- `SendMessageWhatsappBusinessHours`
- `SendMessageAPI`
- `SendMessages`
- `WebHooksAPI`
- `VerifyTicketsChatBotInactives`
- `SendMessageSchenduled`

No boot, `app/bull.ts` chama:

```ts
Queue.process();
Queue.add("VerifyTicketsChatBotInactives", {});
Queue.add("SendMessageSchenduled", {});
```

Quando `NODE_ENV !== "production"`, o Bull Board fica disponivel em
`/admin/queues`.

## RabbitMQ

`backend/src/libs/rabbitmq-server.ts` encapsula `amqplib`:

- abre conexao com a URI recebida no construtor;
- cria canal;
- garante filas duraveis `waba360` e `messenger` no `start()`;
- publica mensagens persistentes em filas ou exchanges;
- em `consumeWhatsapp`, usa `prefetch(10)`, aguarda o callback, aplica pausa
  aleatoria e confirma com `ack`; em erro, usa `nack`.

Consumidores WABA 360 e Messenger instanciam o servidor com
`process.env.AMQP_URL || ""`. Conforme `.env.example`, para nao usar RabbitMQ a
variavel `AMQP_URL` pode ficar comentada; fluxos que dependem desses consumers
precisam de uma URI valida.

## Chrome/Chromium e whatsapp-web.js

`backend/src/libs/wbot.ts` cria o cliente WhatsApp com Puppeteer:

- `CHROME_BIN`: caminho do executavel; se ausente, Puppeteer decide o padrao.
- `CHROME_ARGS`: lista separada por virgula; quando ausente, usa a lista minima
  definida no codigo, incluindo `--no-sandbox` e `--disable-dev-shm-usage`.
- `WEB_VERSION`: versao do WhatsApp Web; padrao `2.2409.2`.

O projeto usa `whatsapp-web.js` `^1.31.0` no backend.

Teste manual de ambiente:

```bash
cd backend
node test-puppeteer.js
```

Esse script abre `https://web.whatsapp.com` em modo headless e ajuda a separar
problemas de Chromium/rede de problemas da sessao da aplicacao.

## Checklist de troubleshooting

- **Backend nao sobe**: verifique Postgres, variaveis `POSTGRES_*` e logs antes
  da etapa de modulos.
- **Socket nao propaga eventos em multiplas instancias**: confira `IO_REDIS_*`
  e conectividade com Redis.
- **Filas nao processam**: confira Redis, `NODE_ENV`, `/admin/queues` quando
  disponivel e erros dos listeners de Bull.
- **WABA/Messenger nao consomem mensagens**: confirme `AMQP_URL` e se as filas
  `waba360` e `messenger` foram criadas.
- **WhatsApp falha ao iniciar QR ou ready**: valide `CHROME_BIN`,
  `CHROME_ARGS`, `WEB_VERSION` e rode `node test-puppeteer.js`.
- **CORS/CSP bloqueando frontend**: revise `FRONTEND_URL` e `NODE_ENV`; Helmet
  e CSP sao aplicados quando o ambiente nao e `dev`.
