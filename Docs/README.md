# Documentacao tecnica

Este diretorio reune guias tecnicos curtos para manutencao, operacao e
evolucao do 42 Customer Service. Os documentos priorizam fluxos que cruzam
backend, frontend, filas e integracoes externas.

## Guias

- [Envio de mensagens e sessoes WhatsApp](./whatsapp-envio-sessoes.md):
  ciclo de vida da sessao `whatsapp-web.js`, envio imediato/agendado,
  fila Bull, eventos Socket.IO, webhooks de status e pontos de troubleshooting.

## Convencoes

- Validar comportamento no codigo antes de atualizar um guia.
- Preferir atualizar paginas existentes a criar paginas redundantes.
- Citar os principais arquivos envolvidos para facilitar investigacao.
- Registrar limites conhecidos e diferencas entre fluxos quando eles impactam
  operacao ou desenvolvimento.
