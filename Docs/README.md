# Documentacao tecnica

Este diretorio centraliza notas tecnicas verificadas no codigo do projeto. Use-o para
entender contratos publicos, fluxos operacionais e cuidados de manutencao que nao
cabem no README principal.

## Guias disponiveis

- [API externa e webhooks](api-externa-webhooks.md): criacao de configuracoes de
  API, autenticacao por token, envio externo de mensagens, callbacks de status e
  cuidados operacionais das filas Bull.

## Como manter

- Atualize a pagina existente quando o comportamento documentado mudar.
- Confirme rotas, payloads e limites diretamente no codigo antes de publicar.
- Mantenha exemplos com placeholders (`<BACKEND_URL>`, `<TOKEN_DA_API>`) para nao
  expor credenciais ou valores de ambientes reais.
