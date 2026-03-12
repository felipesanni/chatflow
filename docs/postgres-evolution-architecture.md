# ChatFlow v2

Arquitetura alvo para a nova base do projeto com PostgreSQL, backend proprio e Evolution API na VPS.

## Objetivo

- Centralizar autenticacao, autorizacao e regras de negocio no servidor
- Usar PostgreSQL como fonte principal dos dados
- Manter a Evolution API apenas como integracao com WhatsApp
- Preservar tempo real para tickets e mensagens

## Stack sugerida

- `apps/web`: Next.js
- `apps/api`: Fastify
- `database`: PostgreSQL
- `realtime`: Socket.IO
- `storage`: S3, MinIO ou disco local da VPS
- `whatsapp`: Evolution API
- `orm`: Prisma
- `validation`: Zod
- `queue opcional`: Redis + BullMQ

## Fluxo principal

1. A Evolution API recebe a mensagem do WhatsApp.
2. A Evolution chama um webhook do `apps/api`.
3. O backend valida o payload e identifica a instancia.
4. O backend cria ou atualiza `tickets`, `ticket_messages` e `ticket_events` no PostgreSQL.
5. O backend publica eventos em tempo real via Socket.IO.
6. O frontend recebe a atualizacao e renderiza a conversa.
7. Quando um agente responde, o frontend chama a API propria.
8. A API grava a mensagem localmente e envia o conteudo para a Evolution API.

## Responsabilidades

### apps/web

- Login do agente
- Lista de tickets
- Janela de chat
- Painel de detalhes
- Modulo de agentes, filas e instancias
- Consumo de API e Socket.IO

### apps/api

- Autenticacao e sessao
- Regras de permissao
- Webhooks da Evolution API
- Envio de mensagens
- Atribuicao e transferencia de tickets
- Upload e assinatura de anexos
- Publicacao de eventos realtime
- Auditoria

## Estrutura de pastas alvo

```text
apps/
  web/
  api/
packages/
  db/
  shared/
docs/
  postgres-evolution-architecture.md
  postgres-initial-schema.sql
```

## Estrutura interna sugerida para `apps/api`

```text
apps/api/src/
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
    attachments/
    realtime/
    audit/
  plugins/
  lib/
```

## Autenticacao

- Login com email e senha
- Sessao com cookie `httpOnly`
- Perfis: `admin` e `agent`
- Permissao validada no backend em todas as rotas

## Realtime

- Socket.IO autenticado por sessao
- Eventos minimos:
  - `ticket.created`
  - `ticket.updated`
  - `ticket.assigned`
  - `ticket.closed`
  - `message.created`
  - `instance.updated`

## Integracao com Evolution API

- Segredos ficam apenas no backend
- O frontend nunca conhece `apiKey` ou endpoint privado
- O backend faz:
  - registrar webhooks
  - consultar status da instancia
  - solicitar QR code
  - enviar texto
  - enviar media
  - apagar mensagem
  - reagir

## Ordem recomendada de migracao

1. Criar schema PostgreSQL
2. Criar `apps/api`
3. Implementar autenticacao
4. Migrar webhook da Evolution para o backend
5. Migrar leitura de tickets e mensagens para API propria
6. Migrar envio de mensagem
7. Migrar anexos
8. Remover o restante do legado do frontend

## Primeiro recorte de entrega

Se quiser migrar com menos risco, implemente nesta ordem:

- auth
- tickets
- messages
- webhook evolution
- envio de mensagem
- realtime

Depois disso, mova:

- agentes
- filas
- anexos
- auditoria completa
