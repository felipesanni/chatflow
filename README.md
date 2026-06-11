# ChatFlow

Base nova do ChatFlow para uso interno, pronta para implantacao via EasyPanel com tres servicos:

- `web`: Next.js
- `api`: Fastify + Prisma
- `postgres`: banco principal

## Arquitetura

- O frontend nao acessa banco diretamente.
- O Next.js usa um proxy interno em `/api-proxy/*` para falar com a API.
- O realtime do painel usa `Socket.IO` apontando para a URL publica da API.
- A API concentra autenticacao, regras de negocio, webhooks e envio para a Evolution.
- Chaves da Evolution sao armazenadas cifradas no banco.
- O PostgreSQL guarda tickets, mensagens, usuarios, filas e auditoria.
- A Evolution API continua na VPS como integracao com WhatsApp.

## Deploy com EasyPanel

Voce pode importar este repositorio no GitHub e criar tres servicos, ou usar o `docker-compose.yaml` como referencia.

### Servicos

- `postgres`
- `api`
- `web`

### Variaveis importantes da API

- `DATABASE_URL`
- `SESSION_SECRET`
- `WEB_APP_URL`
- `API_PORT`
- `ADMIN_BOOTSTRAP_EMAIL`
- `ADMIN_BOOTSTRAP_PASSWORD`
- `ADMIN_BOOTSTRAP_NAME`

### Variaveis importantes do web

- `API_PROXY_TARGET`
- `NEXT_PUBLIC_SOCKET_URL`

## Primeira subida

1. Configure as variaveis da API e do web.
2. Em producao, use a URL publica do frontend em `WEB_APP_URL`.
3. Em producao, use a URL publica da API em `NEXT_PUBLIC_SOCKET_URL`.
4. Suba `postgres`, `api` e `web`.
5. Execute as migrations do Prisma.
6. Se o banco estiver vazio, a API cria o primeiro admin automaticamente usando `ADMIN_BOOTSTRAP_*`.
7. Abra o web e confirme o login.
8. Cadastre a instancia Evolution no painel.
9. Se voce definir `webhookSecret` na instancia, envie esse valor no header `x-webhook-secret` ou na query `?secret=`.
10. Configure o webhook da Evolution apontando para `/api/webhooks/evolution`.

## Endpoints ja funcionais

- `GET /api/health`
- `POST /api/auth/bootstrap`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/agents`
- `POST /api/agents`
- `GET /api/queues`
- `POST /api/queues`
- `POST /api/queues/:queueId/agents`
- `GET /api/tickets`
- `GET /api/tickets/:ticketId`
- `POST /api/tickets/:ticketId/accept`
- `POST /api/tickets/:ticketId/close`
- `GET /api/tickets/:ticketId/messages`
- `POST /api/tickets/:ticketId/messages`
- `POST /api/webhooks/evolution`
- `GET /api/whatsapp/instances`
- `POST /api/whatsapp/instances`

## O que o painel ja cobre

- bootstrap do primeiro admin
- login e logout
- listagem de tickets
- leitura de mensagens
- envio de texto via Evolution
- assumir e encerrar ticket
- cadastro de instancias Evolution com chave cifrada em repouso
- cadastro de agentes
- cadastro de filas
- vinculacao de agentes em filas
- atualizacao realtime via `Socket.IO`

## Estrutura atual

- [apps/api/README.md](/C:/Users/Felipe.Sannino/Desktop/ChatFlow/apps/api/README.md)
- [docs/postgres-evolution-architecture.md](/C:/Users/Felipe.Sannino/Desktop/ChatFlow/docs/postgres-evolution-architecture.md)
- [docs/postgres-initial-schema.sql](/C:/Users/Felipe.Sannino/Desktop/ChatFlow/docs/postgres-initial-schema.sql)
- [packages/db/prisma/schema.prisma](/C:/Users/Felipe.Sannino/Desktop/ChatFlow/packages/db/prisma/schema.prisma)

## Comandos

```bash
npm run dev
npm run api:dev
npm run db:generate
npm run db:migrate
```

## Proximo passo operacional

- subir para o GitHub
- criar os tres servicos no EasyPanel
- executar `prisma generate` e as migrations
- ajustar `WEB_APP_URL` e `NEXT_PUBLIC_SOCKET_URL` com os dominios reais
- apontar o webhook da Evolution para a API publicada

## Observacoes

- Nao consegui executar `npm install`, `build`, `typecheck` ou migrations neste terminal porque o comando `npm` nao esta disponivel aqui.
- O codigo foi preparado para esse fluxo, mas a validacao executada no ambiente ainda fica pendente.
