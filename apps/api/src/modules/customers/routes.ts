import type { FastifyPluginAsync } from 'fastify';
import { requirePermission } from '../../lib/auth-guard.js';

export const customerRoutes: FastifyPluginAsync = async (app) => {
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
};
