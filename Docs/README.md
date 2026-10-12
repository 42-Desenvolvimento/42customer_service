# Documentacao tecnica

Esta pasta concentra runbooks e notas de arquitetura para manutencao do
projeto. Use estes documentos junto com o codigo-fonte; quando houver
divergencia, o codigo atual deve prevalecer.

## Guias disponiveis

- [Envio e recuperacao de mensagens WhatsApp](./whatsapp-envio-recuperacao.md)
  - Fluxo do frontend ate `MessageController`.
  - Criacao/envio de mensagens, midias e agendamentos.
  - Ciclo de vida das sessoes `whatsapp-web.js`.
  - Recuperacao automatica em falhas conhecidas e troubleshooting operacional.

## Convencoes

- Prefira atualizar documentos existentes antes de criar uma nova pagina.
- Inclua caminhos de arquivos e nomes de rotas para facilitar a manutencao.
- Documente restricoes conhecidas; evite assumir comportamento que nao esteja
  implementado no codigo.
