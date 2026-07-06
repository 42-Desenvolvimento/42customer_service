# Documentacao tecnica

Esta pasta concentra documentacao tecnica verificada contra o codigo-fonte do
projeto. Use estes guias para entender fluxos internos, pontos operacionais e
restricoes que nao aparecem no README principal.

## Guias disponiveis

- [Recuperacao de sessao WhatsApp](whatsapp-session-recovery.md): explica como
  o backend tenta reabrir sessoes `whatsapp-web.js` apos falhas em marcar
  mensagens como lidas ou enviar midia, quais eventos Socket sao emitidos e como
  diagnosticar problemas comuns.

## Referencias relacionadas

- `backend/.env.example`: variaveis de ambiente usadas por Postgres, Redis,
  Chrome/Chromium, RabbitMQ e canais externos.
- `README.md`: visao geral do produto, funcionalidades e licenca.
