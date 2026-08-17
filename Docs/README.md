# Documentacao tecnica

Este diretorio concentra notas tecnicas para desenvolvimento e operacao do
Izing/42customer_service. As paginas abaixo priorizam subsistemas que mudaram
recentemente ou que exigem conhecimento operacional para diagnostico.

## Guias

- [Sessoes WhatsApp e recuperacao de envio](whatsapp-sessoes-recuperacao.md)
  - Inicializacao de sessoes no backend.
  - Eventos Socket.IO usados pela interface.
  - Endpoints de conectar, desconectar e gerar novo QR Code.
  - Fluxos de recuperacao acionados por falhas de envio de midia e marcacao de
    mensagens como lidas.

## Convencoes para novas paginas

- Validar o comportamento contra o codigo antes de documentar.
- Preferir exemplos de endpoints, eventos e variaveis reais do projeto.
- Registrar limites conhecidos quando o codigo ainda nao cobre todos os cenarios.
- Manter o texto curto, com secoes que possam ser lidas rapidamente.
