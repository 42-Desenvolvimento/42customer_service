# Documentacao tecnica

Este diretorio concentra guias tecnicos validados contra o codigo atual do
projeto. Use estes documentos para entender fluxos operacionais, pontos de
integracao e limitacoes conhecidas antes de alterar subsistemas criticos.

## Guias disponiveis

- [Sessoes WhatsApp e recuperacao operacional](./whatsapp-sessoes-recuperacao.md)
  - Cobre inicializacao de sessoes, eventos Socket.IO, rotas de operacao,
    configuracao do `whatsapp-web.js` e recuperacao automatica em falhas de
    leitura/envio de midia.

## Como manter estes docs

1. Verifique o comportamento no backend/frontend antes de documentar.
2. Prefira atualizar um guia existente quando o assunto ja estiver coberto.
3. Inclua caminhos de arquivos quando eles ajudarem a navegar pelo codigo.
4. Registre limitacoes conhecidas quando o codigo ainda nao cobre um caso.
