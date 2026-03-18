import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { requirePermission } from '../../lib/auth-guard.js';
import { sendEvolutionText } from '../../lib/evolution-client.js';
import { loadEnv } from '../../config/env.js';
import { decryptSecret, encryptSecret } from '../../lib/secrets.js';

const createMessageBodySchema = z.object({
  body: z.string().min(1),
  replyToMessageId: z.string().uuid().optional(),
});

const env = loadEnv();

export const messageRoutes: FastifyPluginAsync = async (app) => {
  app.get('/tickets/:ticketId/messages', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'tickets.view');
    if (!access) return;
    const session = access.session;

    const params = z.object({ ticketId: z.string().uuid() }).parse(request.params);
    const items = await app.prisma.ticketMessage.findMany({
      where: { ticketId: params.ticketId },
      orderBy: { createdAt: 'asc' },
      include: { senderAgent: true, attachments: true },
    });

    return {
      items: items.map((message: any) => ({
        id: message.id,
        ticketId: message.ticketId,
        direction: message.direction,
        contentType: message.contentType,
        body: message.body,
        senderName: message.senderNameSnapshot,
        externalMessageId: message.externalMessageId,
        createdAt: message.createdAt,
        senderAgent: message.senderAgent ? { id: message.senderAgent.id, name: message.senderAgent.name } : null,
        attachments: message.attachments,
      })),
      viewer: {
        id: session.userId,
        role: session.role,
      },
    };
  });

  app.post('/tickets/:ticketId/messages', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'tickets.reply');
    if (!access) return;
    const session = access.session;

    const params = z.object({ ticketId: z.string().uuid() }).parse(request.params);
    const body = createMessageBodySchema.parse(request.body);

    const ticket = await app.prisma.ticket.findUnique({
      where: { id: params.ticketId },
      include: {
        currentAgent: true,
        whatsappInstance: true,
      },
    });

    if (!ticket) {
      return reply.notFound('Ticket nao encontrado.');
    }

    if (!ticket.externalChatId) {
      return reply.badRequest('O ticket nao possui um destino do WhatsApp configurado.');
    }

    const quotedMessage = body.replyToMessageId
      ? await app.prisma.ticketMessage.findUnique({ where: { id: body.replyToMessageId } })
      : null;

    const decryptedApiKey = decryptSecret(ticket.whatsappInstance.apiKeyEncrypted, env.SESSION_SECRET);

    if (!ticket.whatsappInstance.apiKeyEncrypted.startsWith('enc:')) {
      await app.prisma.whatsAppInstance.update({
        where: { id: ticket.whatsappInstance.id },
        data: {
          apiKeyEncrypted: encryptSecret(decryptedApiKey, env.SESSION_SECRET),
        },
      });
    }

    const delivery = await sendEvolutionText({
      baseUrl: ticket.whatsappInstance.baseUrl,
      apiKey: decryptedApiKey,
      instanceName: ticket.whatsappInstance.evolutionInstanceName,
      remoteJid: ticket.externalChatId,
      text: body.body,
      quotedMessageId: quotedMessage?.externalMessageId ?? undefined,
    });

    if (!delivery.ok) {
      return reply.code(400).send({
        message: 'Falha ao enviar a mensagem para a Evolution API.',
        status: delivery.status,
        payload: delivery.payload,
      });
    }

    const message = await app.prisma.ticketMessage.create({
      data: {
        id: randomUUID(),
        ticketId: ticket.id,
        senderAgentId: session.userId,
        externalMessageId: delivery.messageId,
        direction: 'outbound',
        contentType: 'text',
        body: body.body,
        senderNameSnapshot: ticket.currentAgent?.name ?? session.email,
        replyToMessageId: body.replyToMessageId,
        deliveredAt: new Date(),
      },
    });

    await app.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        lastMessagePreview: body.body,
        unreadCount: 0,
        status: 'open',
        currentAgentId: ticket.currentAgentId ?? session.userId,
        updatedAt: new Date(),
      },
    });

    await app.prisma.ticketEvent.create({
      data: {
        id: randomUUID(),
        ticketId: ticket.id,
        eventType: 'message_out',
        actorUserId: session.userId,
        metadata: { messageId: message.id, externalMessageId: delivery.messageId },
      },
    });

    app.io.emit('message.created', {
      ticketId: ticket.id,
      messageId: message.id,
      direction: message.direction,
    });

    app.io.emit('ticket.updated', {
      ticketId: ticket.id,
      lastMessagePreview: body.body,
      unreadCount: 0,
    });

    return reply.code(201).send({ item: message });
  });
};
