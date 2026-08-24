# Documentacao tecnica

Este diretorio concentra notas tecnicas para desenvolvimento e operacao do
Izing/42customer_service. As paginas priorizam subsistemas que mudaram
recentemente ou que exigem conhecimento operacional para diagnostico.

## Guias

- [Sessoes WhatsApp e recuperacao de envio](whatsapp-sessoes-recuperacao.md)
  - Inicializacao e ciclo de vida das sessoes no backend.
  - Eventos Socket.IO consumidos pela interface.
  - Endpoints para conectar, desconectar e gerar novo QR Code.
  - Recuperacao acionada por falhas de envio de midia e marcacao de leitura.

## Convencoes para novas paginas

- Validar o comportamento contra o codigo antes de documentar.
- Preferir exemplos de endpoints, eventos e variaveis reais do projeto.
- Registrar limites conhecidos quando o codigo ainda nao cobre todos os cenarios.
- Manter o texto curto, com secoes que possam ser lidas rapidamente.
