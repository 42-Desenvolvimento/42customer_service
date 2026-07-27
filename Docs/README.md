# Documentacao tecnica

Este diretorio reune notas tecnicas para manter os fluxos operacionais do
projeto faceis de entender, validar e dar suporte. As paginas abaixo foram
escritas a partir do codigo atual do backend e do frontend.

## Guias disponiveis

- [Recuperacao de sessao WhatsApp](./whatsapp-session-recovery.md)
  - Cobre reabertura automatica de sessoes quando o `whatsapp-web.js` falha ao
    marcar mensagens como lidas ou enviar midia.
- [Sessoes de canais e tempo real](./sessoes-canais-tempo-real.md)
  - Cobre rotas de conexao, estados de canal, eventos Socket.IO e consumo no
    frontend.
- [Runtime operacional do backend](./runtime-operacional.md)
  - Cobre variaveis de ambiente, Postgres, Redis, Bull, RabbitMQ e
    Chrome/Chromium usados pelo backend.

## Como atualizar

1. Valide o comportamento no codigo antes de alterar a documentacao.
2. Prefira editar uma pagina existente quando o assunto ja estiver coberto.
3. Mantenha exemplos pequenos e inclua nomes de arquivos quando isso ajudar na
   navegacao.
4. Registre limitacoes conhecidas quando o codigo ainda nao cobre um caso.
