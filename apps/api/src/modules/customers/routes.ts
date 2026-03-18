import type { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requirePermission } from '../../lib/auth-guard.js';

export const customerRoutes: FastifyPluginAsync = async (app) => {
  const customerBodySchema = z.object({
    name: z.string().trim().min(1, 'Informe o nome do contato.'),
    phone: z.string().trim().optional().nullable(),
    email: z.string().trim().email('Informe um e-mail valido.').optional().or(z.literal('')).nullable(),
    companyName: z.string().trim().optional().or(z.literal('')).nullable(),
    notes: z.string().trim().optional().or(z.literal('')).nullable(),
  });

  function normalizePhone(value: string | null | undefined) {
    if (!value) return null;
    const digits = value.replace(/\D+/g, '');
    return digits || null;
  }

  app.get('/customers', async (request, reply) => {
    const access = await requirePermission(app, request, reply, 'contacts.view');
    if (!access) return;

    const items = await app.prisma.customer.findMany({
      include: {
        tickets: {
          select: {
            id: true,
            status: true,
            updatedAt: true,
            currentQueue: {
              select: {
                name: true,
              },
            },
          },
          orderBy: {
            updatedAt: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return {
      items: items.map((customer) => ({
        id: customer.id,
        name: customer.name,
        phone: customer.phoneE164,
        avatarUrl: customer.avatarUrl,
        email: customer.email,
        companyName: customer.companyName,
        notes: customer.notes,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        lastTicket: customer.tickets[0]
          ? {
              id: customer.tickets[0].id,
              status: customer.tickets[0].status,
              updatedAt: customer.tickets[0].updatedAt,
              queueName: customer.tickets[0].currentQueue?.name ?? null,
            }
          : null,
      })),
    };
  });

  app.post('/customers', async (request, reply) => {
    if (!(await requirePermission(app, request, reply, 'contacts.manage'))) return;

    const body = customerBodySchema.parse(request.body ?? {});
    const phone = normalizePhone(body.phone);
    const email = body.email?.trim() || null;

    if (phone) {
      const phoneConflict = await app.prisma.customer.findFirst({
        where: { phoneE164: phone },
        select: { id: true },
      });

      if (phoneConflict) {
        return reply.conflict('Ja existe um contato com este telefone.');
      }
    }

    if (email) {
      const emailConflict = await app.prisma.customer.findFirst({
        where: { email },
        select: { id: true },
      });

      if (emailConflict) {
        return reply.conflict('Ja existe um contato com este e-mail.');
      }
    }

    const customer = await app.prisma.customer.create({
      data: {
        id: randomUUID(),
        name: body.name.trim(),
        phoneE164: phone,
        avatarUrl: null,
        email,
        companyName: body.companyName?.trim() || null,
        notes: body.notes?.trim() || null,
      },
    });

    return reply.code(201).send({
      item: {
        id: customer.id,
        name: customer.name,
        phone: customer.phoneE164,
        avatarUrl: customer.avatarUrl,
        email: customer.email,
        companyName: customer.companyName,
        notes: customer.notes,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        lastTicket: null,
      },
    });
  });

  app.put('/customers/:customerId', async (request, reply) => {
    if (!(await requirePermission(app, request, reply, 'contacts.manage'))) return;

    const params = z.object({ customerId: z.string().uuid() }).parse(request.params);
    const body = customerBodySchema.parse(request.body ?? {});
    const phone = normalizePhone(body.phone);
    const email = body.email?.trim() || null;

    const existing = await app.prisma.customer.findUnique({
      where: { id: params.customerId },
      select: { id: true },
    });

    if (!existing) {
      return reply.notFound('Contato nao encontrado.');
    }

    if (phone) {
      const phoneConflict = await app.prisma.customer.findFirst({
        where: {
          phoneE164: phone,
          id: { not: params.customerId },
        },
        select: { id: true },
      });

      if (phoneConflict) {
        return reply.conflict('Ja existe outro contato com este telefone.');
      }
    }

    if (email) {
      const emailConflict = await app.prisma.customer.findFirst({
        where: {
          email,
          id: { not: params.customerId },
        },
        select: { id: true },
      });

      if (emailConflict) {
        return reply.conflict('Ja existe outro contato com este e-mail.');
      }
    }

    const customer = await app.prisma.customer.update({
      where: { id: params.customerId },
      data: {
        name: body.name.trim(),
        phoneE164: phone,
        email,
        companyName: body.companyName?.trim() || null,
        notes: body.notes?.trim() || null,
      },
    });

    return reply.send({
      item: {
        id: customer.id,
        name: customer.name,
        phone: customer.phoneE164,
        avatarUrl: customer.avatarUrl,
        email: customer.email,
        companyName: customer.companyName,
        notes: customer.notes,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
      },
    });
  });
};
