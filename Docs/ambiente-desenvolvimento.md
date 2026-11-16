# Ambiente de desenvolvimento e servicos locais

Este runbook descreve como subir o 42customer_service para desenvolvimento e
quais componentes precisam estar alinhados para o backend, o frontend e as filas
funcionarem. Ele foi verificado contra os arquivos:

- `backend/package.json`
- `backend/.env.example`
- `backend/docker-compose.yml`
- `backend/src/app/index.ts`
- `backend/src/app/boot.ts`
- `backend/src/app/awaitPostgresConnection.ts`
- `backend/src/app/express.ts`
- `backend/src/app/bull.ts`
- `backend/src/libs/Queue.ts`
- `frontend/package.json`
- `frontend/.env.example`
- `frontend/quasar.conf.js`
- `frontend/src/service/request.js`

## Visao geral da arquitetura local

```text
Navegador
  |
  | HTTP/Socket.IO usando VUE_URL_API
  v
Frontend Quasar (frontend/)
  |
  | API REST, Socket.IO e arquivos /public
  v
Backend Express + TypeScript (backend/)
  |
  +-- Postgres: dados relacionais e migrations Sequelize
  +-- Redis: Socket.IO Redis adapter, sessoes/cache e filas Bull
  +-- RabbitMQ: consumidores de canais que usam AMQP_URL
```

O backend inicia por `backend/src/server.ts`, chama `application()` em
`backend/src/app/index.ts` e executa o bootstrap nesta ordem:

1. aguarda conexao com Postgres;
2. configura Express, CORS, body parser e Helmet quando `NODE_ENV` nao e `dev`;
3. inicializa a camada de banco e as rotas;
4. inicia filas Bull e registra `/admin/queues` apenas fora de `production`;
5. inicia Socket.IO e depois as sessoes WhatsApp.

## Pre-requisitos

- Node.js compativel com o backend (`backend/package.json` exige `>=18`).
- npm para instalar dependencias do backend e frontend.
- Docker e Docker Compose para subir Postgres, Redis e RabbitMQ localmente.
- Chrome/Chromium ou `CHROME_BIN` configurado quando os fluxos WhatsApp usam
  `whatsapp-web.js`/Puppeteer fora do Docker.

> Observacao: o frontend declara engines antigas em `frontend/package.json`,
> mas o backend e o Dockerfile atual usam Node 18. Evite misturar versoes sem
> rodar pelo menos build/lint dos dois projetos.

## Arquivos `.env`

Crie arquivos locais a partir dos exemplos e ajuste os hosts conforme o modo de
execucao:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Variaveis mais importantes:

| Variavel | Onde | Uso |
| --- | --- | --- |
| `NODE_ENV` | backend | Controla carregamento de Helmet e migrations automaticas em production. |
| `PORT` | backend | Porta HTTP do backend quando `app.get("port")` nao define outra. |
| `BACKEND_URL` | backend | Usado por Sentry, webhooks e montagem de URLs publicas. |
| `PROXY_PORT` | backend | Compoe links publicos de midias em `/public`. |
| `FRONTEND_URL` | backend | Origem permitida no CORS do Express. |
| `POSTGRES_HOST`, `DB_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | backend | Conexao Sequelize com Postgres. |
| `POSTGRES_POOL_MAX`, `POSTGRES_POOL_MIN`, `POSTGRES_POOL_ACQUIRE`, `POSTGRES_POOL_IDLE` | backend | Sobrescrevem o pool Sequelize quando necessario. |
| `IO_REDIS_SERVER`, `IO_REDIS_PORT`, `IO_REDIS_PASSWORD` | backend | Redis para Socket.IO, Bull e caches. |
| `IO_REDIS_DB_SESSION` | backend | DB Redis usado por `redisClient` e alguns servicos. |
| `AMQP_URL` | backend | Habilita consumidores RabbitMQ nos canais que usam AMQP. |
| `VUE_URL_API` | frontend | Base URL do Axios e do Socket.IO no navegador. |
| `VUE_FACEBOOK_APP_ID` | frontend | Exposto no build Quasar para integracoes Facebook. |

Mantenha `PORT`, `PROXY_PORT` e `VUE_URL_API` coerentes. `PORT` define onde o
backend escuta; `PROXY_PORT` e usado para gerar links publicos; `VUE_URL_API`
define para onde o navegador envia requisicoes. Se o backend escuta em `3000`
mas o frontend aponta para `3100`, chamadas HTTP e Socket.IO falham.

Nao reutilize valores de exemplo como segredo real. Troque `JWT_SECRET`,
`JWT_REFRESH_SECRET`, senhas de banco e credenciais externas em ambientes
compartilhados.

## Subindo dependencias com Docker

Para desenvolvimento com backend rodando no host, suba apenas os servicos de
infra:

```bash
cd backend
docker compose up -d redis postgres rabbitmq
```

Depois ajuste `backend/.env` para apontar para os servicos vistos pelo processo
Node:

```dotenv
POSTGRES_HOST=localhost
IO_REDIS_SERVER=localhost
```

Quando o backend roda dentro do Compose como servico `api`, os hosts precisam
ser nomes alcancaveis de dentro da rede Docker, por exemplo `postgres`/`pg` para
banco e `redis` para Redis. Use `host.docker.internal` somente quando o servico
real estiver fora do Compose, no host da maquina.

## Backend

Instale dependencias e rode migrations:

```bash
cd backend
npm install
npm run db:migrate
npm run db:seed
```

Inicie em desenvolvimento:

```bash
npm run dev:server
```

Scripts relevantes:

- `npm run build`: compila TypeScript para `dist/`.
- `npm run dev:server`: usa `ts-node-dev` em `src/server.ts`.
- `npm run start`: inicia `dist/server.js` com `nodemon`; exige build previo.
- `npm run db:migrate`: remove `dist`, compila e executa migrations Sequelize.
- `npm run db:seed`: executa seeders Sequelize.
- `npm test`: roda migrations/seed em `NODE_ENV=test`, executa Jest e desfaz
  migrations no `posttest`.

### Migrations automaticas

`backend/src/app/awaitPostgresConnection.ts` fica tentando autenticar no
Postgres a cada 5 segundos ate conseguir conectar. Em `NODE_ENV=production`,
depois da conexao, ele executa `npx sequelize db:migrate` automaticamente.

Em desenvolvimento, rode `npm run db:migrate` manualmente para manter o schema
atualizado.

## Frontend

Instale dependencias e suba o Quasar:

```bash
cd frontend
npm install
npm run dev
```

`frontend/quasar.conf.js` injeta `VUE_URL_API` e `VUE_FACEBOOK_APP_ID` no build.
O cliente HTTP em `frontend/src/service/request.js` usa `VUE_URL_API` como
`baseURL`, e `frontend/src/utils/socket.js` usa a mesma variavel para Socket.IO.

Se o backend estiver em `http://localhost:3100`, mantenha:

```dotenv
VUE_URL_API=http://localhost:3100
```

## Filas Bull, Redis e painel de filas

`backend/src/app/bull.ts` chama `Queue.process()` e agenda:

- `VerifyTicketsChatBotInactives`
- `SendMessageSchenduled`

As filas sao criadas em `backend/src/libs/Queue.ts` com concorrencia `200` por
fila e Redis em `IO_REDIS_SERVER`/`IO_REDIS_PORT`, usando DB Redis `3` para Bull.
O painel Bull Board fica em `/admin/queues` quando `NODE_ENV !== "production"`.

Se jobs nao forem processados:

1. confirme que o Redis esta acessivel pelo host definido em `IO_REDIS_SERVER`;
2. confira logs de `QueueListeners` no backend;
3. acesse `/admin/queues` em desenvolvimento para ver jobs aguardando/falhando;
4. valide se o processo backend foi iniciado depois do Redis estar disponivel.

## Health check, CORS e arquivos publicos

- `GET /health` retorna versao, uptime e status basico do servidor.
- O CORS aceita apenas `FRONTEND_URL` configurado no backend.
- Uploads e midias sao servidos por `/public`, apontando para
  `backend/public`.
- Links de midia sao montados em varios models com `BACKEND_URL` e
  `PROXY_PORT`; mantenha esses valores coerentes com o endereco externo usado
  pelo navegador.

## Execucao via Docker do backend

`backend/Dockerfile` usa Node 18, instala Chrome estavel, `ffmpeg` e PM2. Os
stages relevantes sao:

- `development-stage`: `NODE_ENV=development` e `npm run dev:server`;
- `production-stage`: `NODE_ENV=production` e `docker-entrypoint.sh`, que chama
  `pm2-docker start ./dist/server.js`.

O `backend/docker-compose.yml` tambem monta volumes persistentes:

- `.data/redis` para Redis;
- `.data/pg` para Postgres;
- `.data/rabbitmq` para RabbitMQ;
- `.data/.wwebjs_auth` para sessoes WhatsApp;
- `.data/medias` para arquivos publicos do backend.

## Troubleshooting rapido

### Backend fica em loop "Falha ao conectar ao PostgreSQL"

- Verifique `POSTGRES_HOST`, `DB_PORT`, usuario, senha e database.
- Se o backend roda no host, use o host/porta publicados pelo Docker.
- Se o backend roda dentro do Compose, use nomes de servico da rede Docker.
- Confirme se o volume `.data/pg` esta com permissoes corretas; o Compose tem o
  servico `pg_fixPermissions` para ajustar o dono do volume Bitnami.

### Frontend recebe erro de CORS

- Ajuste `FRONTEND_URL` no backend para a origem exata do Quasar.
- Reinicie o backend apos mudar `.env`, pois `dotenv` e lido no boot.
- Garanta que `VUE_URL_API` aponta para a porta real do backend.
- Verifique se `PORT` e `PROXY_PORT` nao foram confundidos: o navegador deve
  acessar a porta exposta pelo processo/proxy que recebe as requisicoes.

### Socket.IO autentica ou conecta de forma inconsistente

- O navegador usa `VUE_URL_API` tambem para Socket.IO.
- O backend usa Redis adapter com `IO_REDIS_SERVER` e `IO_REDIS_PORT`.
- Verifique se todos os processos backend compartilham o mesmo Redis quando ha
  mais de uma instancia.

### `/admin/queues` nao abre

- O painel nao e registrado em `NODE_ENV=production`.
- Confirme que o backend subiu com `NODE_ENV=dev` ou outro valor diferente de
  `production`.

### Midias aparecem com URL incorreta

- Confira `BACKEND_URL` e `PROXY_PORT`.
- Lembre que o Express serve arquivos em `/public`; proxies externos precisam
  encaminhar essa rota para o backend.
