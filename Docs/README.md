# Documentacao tecnica

Este diretorio reune notas curtas de arquitetura, operacao e troubleshooting
verificadas contra o codigo-fonte do projeto.

## Guias disponiveis

- [Envio WhatsApp, recuperacao de sessao e Socket.IO](./whatsapp-envio-recuperacao-socket.md)
  - Cobre envio de mensagens e midias, marcacao de leitura, recuperacao de
    sessoes WhatsApp e eventos em tempo real por tenant.
  - Inclui variaveis de ambiente, exemplos de eventos e limites atuais do
    fluxo.

## Como atualizar

- Prefira atualizar um guia existente quando o comportamento ja estiver coberto.
- Cite os arquivos fonte relevantes para facilitar validacao futura.
- Registre restricoes conhecidas quando o codigo atual depender de convencoes
  implicitas ou possuir divergencias entre frontend e backend.
