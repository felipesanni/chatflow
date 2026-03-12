# API Workspace

Espaco reservado para o backend proprio do ChatFlow.

Objetivo inicial:

- autenticar agentes
- receber webhook da Evolution API
- persistir tickets e mensagens no PostgreSQL
- emitir eventos realtime para o frontend
- enviar mensagens para a Evolution API sem expor segredos ao navegador

Estrutura sugerida:

```text
apps/api/
  src/
    app.ts
    server.ts
    config/
    modules/
      auth/
      agents/
      customers/
      queues/
      tickets/
      messages/
      whatsapp/
      realtime/
      attachments/
      audit/
```
