import type { FastifyPluginAsync } from 'fastify';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod/v4';
import { requireApiAccessToken } from '../../lib/api-token-auth.js';

function jsonToolResult(statusCode: number, body: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(body) }],
    isError: statusCode >= 400,
  };
}

export const mcpRoutes: FastifyPluginAsync = async (app) => {
  app.post('/mcp', async (request, reply) => {
    const accessToken = await requireApiAccessToken(app, request, reply);
    if (!accessToken) return;

    const authorization = request.headers.authorization;
    if (!authorization) return reply.unauthorized('Token Bearer obrigatorio.');

    const callExternal = async (method: 'GET' | 'POST', path: string, payload?: unknown) => {
      const response = await app.inject({
        method,
        url: `/api/external/${path}`,
        headers: {
          authorization,
          ...(payload === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(payload === undefined ? {} : { payload: JSON.stringify(payload) }),
      });
      let result: unknown;
      try {
        result = response.json();
      } catch {
        result = { message: response.body || 'A API externa retornou uma resposta vazia.' };
      }
      return jsonToolResult(response.statusCode, result);
    };

    const server = new McpServer({ name: 'chatflow', version: '1.0.0' });
    const listArgs = z.object({ search: z.string().optional(), limit: z.number().int().min(1).max(200).optional() });

    server.registerTool('list_tickets', {
      title: 'Listar tickets',
      description: 'Lista tickets acessíveis ao token, com filtros de status, contato, fila, agente e instância.',
      inputSchema: z.object({
        search: z.string().optional(),
        status: z.enum(['open', 'pending', 'closed']).optional(),
        phone: z.string().optional(),
        queueId: z.union([z.string().uuid(), z.number().int().positive()]).optional(),
        agentId: z.union([z.string().uuid(), z.number().int().positive()]).optional(),
        whatsappInstanceId: z.union([z.string().uuid(), z.number().int().positive()]).optional(),
        limit: z.number().int().min(1).max(200).optional(),
        cursor: z.string().optional(),
      }),
      annotations: { readOnlyHint: true },
    }, async (args) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(args)) {
        if (value !== undefined) params.set(key, String(value));
      }
      return callExternal('GET', `tickets?${params.toString()}`);
    });

    server.registerTool('list_ticket_messages', {
      title: 'Ler mensagens de um ticket',
      description: 'Lê mensagens de uma conversa acessível ao token, em ordem cronológica.',
      inputSchema: z.object({ ticketId: z.string().uuid(), limit: z.number().int().min(1).max(500).optional(), cursor: z.string().optional() }),
      annotations: { readOnlyHint: true },
    }, async ({ ticketId, limit, cursor }) => {
      const params = new URLSearchParams();
      if (limit !== undefined) params.set('limit', String(limit));
      if (cursor) params.set('cursor', cursor);
      return callExternal('GET', `tickets/${ticketId}/messages?${params.toString()}`);
    });

    server.registerTool('list_new_messages', {
      title: 'Acompanhar mensagens novas',
      description: 'Retorna mensagens novas após o cursor informado. Guarde nextCursor e envie-o na próxima chamada para continuar a leitura sem duplicar mensagens.',
      inputSchema: z.object({
        after: z.string().optional(),
        limit: z.number().int().min(1).max(500).optional(),
        direction: z.enum(['inbound', 'outbound', 'system']).optional(),
        ticketId: z.string().uuid().optional(),
      }),
      annotations: { readOnlyHint: true },
    }, async ({ after, limit, direction, ticketId }) => {
      const params = new URLSearchParams();
      if (after) params.set('after', after);
      if (limit !== undefined) params.set('limit', String(limit));
      if (direction) params.set('direction', direction);
      if (ticketId) params.set('ticketId', ticketId);
      return callExternal('GET', `messages?${params.toString()}`);
    });

    server.registerTool('list_customers', {
      title: 'Listar contatos',
      description: 'Lista contatos que aparecem em tickets dentro do escopo deste token.',
      inputSchema: listArgs.extend({ phone: z.string().optional() }),
      annotations: { readOnlyHint: true },
    }, async (args) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(args)) if (value !== undefined) params.set(key, String(value));
      return callExternal('GET', `customers?${params.toString()}`);
    });

    server.registerTool('list_agents', {
      title: 'Listar agentes',
      description: 'Lista os agentes liberados para este token.',
      inputSchema: listArgs,
      annotations: { readOnlyHint: true },
    }, async (args) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(args)) if (value !== undefined) params.set(key, String(value));
      return callExternal('GET', `users?${params.toString()}`);
    });

    server.registerTool('list_queues', {
      title: 'Listar filas',
      description: 'Lista as filas liberadas para este token.',
      inputSchema: listArgs,
      annotations: { readOnlyHint: true },
    }, async (args) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(args)) if (value !== undefined) params.set(key, String(value));
      return callExternal('GET', `queues?${params.toString()}`);
    });

    server.registerTool('list_instances', {
      title: 'Listar instâncias WhatsApp',
      description: 'Lista as instâncias WhatsApp liberadas para este token.',
      inputSchema: listArgs,
      annotations: { readOnlyHint: true },
    }, async (args) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(args)) if (value !== undefined) params.set(key, String(value));
      return callExternal('GET', `instances?${params.toString()}`);
    });

    if (accessToken.accessMode === 'read_write') {
      server.registerTool('reply_to_ticket', {
        title: 'Responder ticket',
        description: 'Envia uma mensagem para um ticket acessível pelo token.',
        inputSchema: z.object({ ticketId: z.string().uuid(), body: z.string().min(1), replyToMessageId: z.string().uuid().optional() }),
        annotations: { readOnlyHint: false, destructiveHint: false },
      }, async ({ ticketId, body, replyToMessageId }) => callExternal('POST', `tickets/${ticketId}/messages`, { body, replyToMessageId }));

      server.registerTool('send_message', {
        title: 'Iniciar conversa',
        description: 'Inicia ou continua uma conversa pelo WhatsApp. A identidade de envio vem do responsável cadastrado no token.',
        inputSchema: z.object({
          phone: z.string().min(8),
          body: z.string().min(1),
          whatsappInstanceId: z.union([z.string().uuid(), z.number().int().positive()]),
          queueId: z.union([z.string().uuid(), z.number().int().positive()]).optional(),
          customerName: z.string().max(160).optional(),
        }),
        annotations: { readOnlyHint: false, destructiveHint: false },
      }, async (args) => callExternal('POST', 'messages/send', args));

      server.registerTool('transfer_ticket', {
        title: 'Transferir ticket',
        description: 'Transfere um ticket acessível pelo token para uma fila, um agente ou ambos, dentro dos limites deste token.',
        inputSchema: z.object({
          ticketId: z.string().uuid(),
          agentId: z.union([z.string().uuid(), z.number().int().positive()]).optional(),
          queueId: z.union([z.string().uuid(), z.number().int().positive()]).optional(),
          note: z.string().optional(),
        }).refine((args) => args.agentId !== undefined || args.queueId !== undefined, 'Informe agente, fila ou ambos.'),
        annotations: { readOnlyHint: false, destructiveHint: false },
      }, async ({ ticketId, ...body }) => callExternal('POST', `tickets/${ticketId}/transfer`, body));
    }

    if (accessToken.canMergeTickets) {
      server.registerTool('merge_tickets', {
        title: 'Mesclar tickets',
        description: 'Mescla tickets individuais arquivados do mesmo contato e instância em um ticket principal.',
        inputSchema: z.object({ primaryTicketId: z.string().uuid(), duplicateTicketIds: z.array(z.string().uuid()).min(1).max(50) }),
        annotations: { readOnlyHint: false, destructiveHint: true },
      }, async (args) => callExternal('POST', 'tickets/merge', args));
    }

    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    reply.raw.on('close', () => {
      void transport.close();
      void server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(request.raw, reply.raw, request.body);
    } catch (error) {
      app.log.error({ error }, 'Falha ao processar requisição MCP.');
      if (!reply.sent) return reply.code(500).send({ message: 'Falha ao processar a requisição MCP.' });
    }
  });

  for (const method of ['GET', 'DELETE'] as const) {
    app.route({
      method,
      url: '/mcp',
      handler: async (_request, reply) => reply.code(405).send({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Este endpoint MCP stateless aceita apenas POST.' },
        id: null,
      }),
    });
  }
};
