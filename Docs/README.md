# Documentacao tecnica

Esta pasta concentra runbooks e notas de arquitetura verificados contra o codigo
atual do projeto. Use estes documentos como complemento ao `README.md` principal,
especialmente para setup local, operacao e troubleshooting.

## Runbooks disponiveis

- [Ambiente de desenvolvimento e servicos locais](ambiente-desenvolvimento.md)
  - Backend Express/TypeScript, frontend Quasar, Postgres, Redis, RabbitMQ,
    migrations, filas Bull e armadilhas comuns de variaveis de ambiente.

## Como manter

- Atualize a pagina mais proxima do fluxo alterado antes de criar uma nova.
- Verifique nomes de scripts, rotas e variaveis diretamente no codigo.
- Nao copie valores reais de `.env`; documente apenas nomes, proposito e
  exemplos com placeholders.
