# Documentacao tecnica

Este diretorio reune documentacao operacional e de arquitetura verificada no
codigo do projeto. Use estes arquivos como ponto de partida antes de alterar
fluxos compartilhados entre backend, frontend e canais de atendimento.

## Indice

- [WhatsApp: envio, leitura, recuperacao de sessao e Socket.IO](./whatsapp-envio-leitura-socket.md)
  - Fluxo de `GET/POST /messages/:ticketId`.
  - Envio de texto e midia pelo WhatsApp.
  - Marcacao de mensagens como lidas.
  - Recuperacao automatica de sessao do `whatsapp-web.js`.
  - Autenticacao e salas Socket.IO por tenant.

## Como manter

- Verifique o comportamento no codigo antes de atualizar exemplos ou runbooks.
- Prefira atualizar uma pagina existente quando o assunto ja estiver coberto.
- Inclua nomes de arquivos, rotas e variaveis de ambiente relevantes.
- Nao registre valores reais de segredos; documente apenas nomes de variaveis.
