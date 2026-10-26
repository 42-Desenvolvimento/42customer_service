# CI de imagens Docker

Este documento descreve os workflows de GitHub Actions que constroem e publicam imagens Docker do projeto. Ele foi verificado contra:

- `.github/workflows/docker-backend-image.yml`
- `.github/workflows/docker-frontend-image.yml`
- `backend/Dockerfile`
- `backend/docker-compose.yml`
- `backend/docker-entrypoint.sh`
- `backend/package.json`
- `frontend/package.json`
- `frontend/quasar.conf.js`

## Objetivo

Os workflows automatizam o build de backend e frontend quando arquivos dessas areas mudam em `master` ou em pull requests para `master`. A publicacao usa Docker Buildx para gerar imagens `linux/amd64` e `linux/arm64` no Docker Hub.

## Gatilhos e guarda de repositorio

| Workflow | Paths monitorados | Eventos | Job |
| --- | --- | --- | --- |
| `Deploy Back Docker` | `backend/**` | `push` e `pull_request` para `master` | `deploy_back` |
| `Deploy Front Docker` | `frontend/**` | `push` e `pull_request` para `master` | `deploy_front` |

Ambos os jobs possuem a condicao:

```yaml
if: github.repository == 'ldurans/izing.open.io'
```

Na pratica, isso significa que os workflows podem aparecer em forks ou repositorios espelhados, mas os jobs nao executam fora desse nome de repositorio. Se a publicacao precisar rodar em outro repositorio, ajuste essa condicao junto com as credenciais e nomes das imagens.

## Backend

### Build no workflow

O workflow de backend executa:

```sh
cd backend
npm install
export NODE_OPTIONS="--max_old_space_size=4096"
CI=false npm run build
docker buildx build --platform linux/amd64,linux/arm64 \
  -t izingopenio/izingopenio-backend:latest \
  --push ./backend
```

O script `npm run build` compila TypeScript com `tsc`, conforme `backend/package.json`.

### Dockerfile

`backend/Dockerfile` usa multiplos stages:

1. `global-deps-stage`: parte de `node:18-bookworm-slim`, instala dependencias de sistema, `ffmpeg`, Google Chrome e `pm2`.
2. `develop-stage`: copia `package*.json` e roda `npm install`.
3. `build-stage`: copia o restante do backend e executa `npm run build`.
4. `development-stage`: inicia `npm run dev:server`.
5. `production-stage`: copia `docker-entrypoint.sh` e inicia `pm2-docker start ./dist/server.js`.

O container de producao depende do build gerar `dist/server.js`. A aplicacao escuta em `PORT` quando definido, ou `3100` como fallback no bootstrap do backend.

### Compose local

`backend/docker-compose.yml` sobe os servicos locais:

- `redis`
- `postgres`
- `rabbitmq`
- `api`

O servico `api` faz build do `backend/Dockerfile`, carrega `backend/.env`, expoe `3100:3100` e persiste:

- `.data/.wwebjs_auth` em `/app/.wwebjs_auth`
- `.data/medias` em `/app/public`

Esse compose e util para validar o container do backend e suas dependencias, mas nao cobre o frontend.

## Frontend

### Build no workflow

O workflow de frontend executa:

```sh
npm install -g @quasar/cli
cd frontend
npm install
export NODE_OPTIONS=--openssl-legacy-provider
npx quasar build -P -m pwa
docker buildx build --platform linux/amd64,linux/arm64 \
  -t izingopenio/izingopenio-frontend:latest \
  --push ./frontend
```

O build Quasar usa o modo PWA e le variaveis via `frontend/quasar.conf.js`, incluindo:

- `VUE_URL_API`
- `VUE_FACEBOOK_APP_ID`

### Limitacao atual

O repositorio possui `backend/Dockerfile`, mas nao possui `frontend/Dockerfile`. Como o workflow chama `docker buildx build ... ./frontend`, a etapa de build/push da imagem de frontend tende a falhar enquanto nao houver um Dockerfile ou outra configuracao de build valida dentro de `frontend/`.

Antes de tratar falhas de Docker Hub ou Buildx como causa raiz, verifique primeiro se o Dockerfile do frontend foi criado.

## Credenciais e ambiente

Os dois workflows usam:

```yaml
environment: production
password: ${{ secrets.DOCKER_TOKEN }}
username: izingopenio
```

Requisitos operacionais:

- o environment `production` deve permitir o uso do secret;
- `DOCKER_TOKEN` deve ser um token valido do Docker Hub para o usuario configurado;
- as imagens sao publicadas sempre com a tag `latest`;
- nao ha tag por SHA, versao ou branch nos workflows atuais.

## Checklist de troubleshooting

### Job nao executa

1. Confirme se a alteracao tocou `backend/**` ou `frontend/**`.
2. Confirme se o evento e `push` para `master` ou `pull_request` tendo `master` como base.
3. Confirme se `github.repository` e exatamente `ldurans/izing.open.io`.

### Backend falha antes do Docker build

1. Reproduza localmente:
   ```sh
   cd backend
   npm install
   NODE_OPTIONS="--max_old_space_size=4096" CI=false npm run build
   ```
2. Verifique erros de TypeScript, dependencias nativas e versao de Node.
3. O workflow usa Node.js `20.x`, mas o Dockerfile usa `node:18-bookworm-slim`; diferencas de runtime podem aparecer entre a compilacao no runner e a execucao da imagem.

### Backend falha dentro do container

1. Confirme se `dist/server.js` foi gerado.
2. Confirme se `docker-entrypoint.sh` esta executavel na imagem.
3. Revise variaveis de ambiente obrigatorias do backend, como banco, Redis, JWT, URLs publica/frontend e Chrome.
4. Para execucao local com compose, confirme se Postgres, Redis e RabbitMQ estao saudaveis.

### Frontend falha no build Quasar

1. Reproduza localmente:
   ```sh
   cd frontend
   npm install
   NODE_OPTIONS=--openssl-legacy-provider npx quasar build -P -m pwa
   ```
2. Confirme se `VUE_URL_API` e `VUE_FACEBOOK_APP_ID` estao definidos quando necessarios.
3. Revise erros de lint carregados pelo `eslint-loader` em `frontend/quasar.conf.js`.

### Frontend falha no Docker build

1. Verifique se existe `frontend/Dockerfile`.
2. Se ainda nao existir, a falha e esperada para a etapa `docker buildx build ... ./frontend`.
3. Defina a estrategia antes de corrigir:
   - criar um Dockerfile que sirva `dist/pwa`;
   - publicar somente artefatos estaticos;
   - ou remover a etapa Docker ate a estrategia de empacotamento estar definida.

## Cuidados ao alterar

- Evite trocar a tag `latest` sem combinar uma politica de versionamento e rollback.
- Se adicionar tags por commit ou versao, mantenha `latest` apenas se ela continuar representando a imagem de producao esperada.
- Se habilitar o workflow em outro repositorio, atualize tambem usuario Docker Hub, nomes das imagens e secrets.
- Nao coloque valores reais de `.env` nos workflows; use secrets ou variaveis do environment.
