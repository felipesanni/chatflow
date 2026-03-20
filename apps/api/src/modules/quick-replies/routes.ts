import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { requirePermission } from '../../lib/auth-guard.js';

const quickReplySchema = z.object({
  shortcut: z
    .string()
    .min(1)
    .transform((value) => value.trim().replace(/^\/+/, '').toLowerCase())
    .pipe(z.string().min(1, 'Informe um atalho valido.')),
  content: z.string().min(1).transform((value) => value.trim()),
  isActive: z.boolean().default(true),
});

function serializeQuickReply(item: { id: string; shortcut: string; content: string; isActive: boolean; createdAt: Date; updatedAt: Date }) {
  return {
    id: item.id,
    shortcut: item.shortcut,
    content: item.content,
    isActive: item.isActive,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export const quickReplyRoutes: FastifyPluginAsync = async (app) => {
  app.get('/quick-replies', async (request, reply) => {
    if (!(await requirePermission(app, request, reply, 'quickReplies.view'))) return;

    const items = await app.prisma.quickReply.findMany({
      orderBy: [{ shortcut: 'asc' }],
    });

    return {
      items: items.map(serializeQuickReply),
    };
  });

  app.post('/quick-replies', async (request, reply) => {
    if (!(await requirePermission(app, request, reply, 'quickReplies.manage'))) return;

    const body = quickReplySchema.parse(request.body);

    const exists = await app.prisma.quickReply.findUnique({
      where: { shortcut: body.shortcut },
      select: { id: true },
    });

    if (exists) {
      return reply.conflict('Ja existe uma resposta rapida com este atalho.');
    }

    const item = await app.prisma.quickReply.create({
      data: {
        id: randomUUID(),
        shortcut: body.shortcut,
        content: body.content,
        isActive: body.isActive,
      },
    });

    return reply.code(201).send({
      item: serializeQuickReply(item),
    });
  });

  app.put('/quick-replies/:quickReplyId', async (request, reply) => {
    if (!(await requirePermission(app, request, reply, 'quickReplies.manage'))) return;

    const params = z.object({ quickReplyId: z.string().uuid() }).parse(request.params);
    const body = quickReplySchema.parse(request.body);

    const existing = await app.prisma.quickReply.findUnique({
      where: { id: params.quickReplyId },
      select: { id: true },
    });

    if (!existing) {
      return reply.notFound('Resposta rapida nao encontrada.');
    }

    const shortcutConflict = await app.prisma.quickReply.findFirst({
      where: {
        shortcut: body.shortcut,
        id: { not: params.quickReplyId },
      },
      select: { id: true },
    });

    if (shortcutConflict) {
      return reply.conflict('Ja existe outra resposta rapida com este atalho.');
    }

    const item = await app.prisma.quickReply.update({
      where: { id: params.quickReplyId },
      data: {
        shortcut: body.shortcut,
        content: body.content,
        isActive: body.isActive,
      },
    });

    return reply.code(200).send({
      message: 'Resposta rapida atualizada com sucesso.',
      item: serializeQuickReply(item),
    });
  });

  app.delete('/quick-replies/:quickReplyId', async (request, reply) => {
    if (!(await requirePermission(app, request, reply, 'quickReplies.manage'))) return;

    const params = z.object({ quickReplyId: z.string().uuid() }).parse(request.params);

    const existing = await app.prisma.quickReply.findUnique({
      where: { id: params.quickReplyId },
      select: { id: true },
    });

    if (!existing) {
      return reply.notFound('Resposta rapida nao encontrada.');
    }

    await app.prisma.quickReply.delete({
      where: { id: params.quickReplyId },
    });

    return reply.code(200).send({
      message: 'Resposta rapida excluida com sucesso.',
    });
  });
};
