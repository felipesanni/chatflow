import type { FastifyInstance } from 'fastify';
import { deliverOutboundMessage, type OutgoingAttachmentInput } from './outbound-messages.js';

export async function processScheduledMessage(app: FastifyInstance, scheduledMessageId: string) {
  const scheduledMessage = await app.prisma.scheduledMessage.findUnique({
    where: { id: scheduledMessageId },
  });

  if (!scheduledMessage) {
    app.log.warn({ scheduledMessageId }, 'Mensagem agendada nao encontrada.');
    return null;
  }

  if (scheduledMessage.status === 'canceled' || scheduledMessage.status === 'sent') {
    return scheduledMessage;
  }

  const now = Date.now();
  const sendAtMs = scheduledMessage.sendAt.getTime();

  if (sendAtMs > now + 1_000) {
    if (app.jobs.enabled) {
      await app.jobs.enqueueScheduledMessage(
        { scheduledMessageId },
        {
          delayMs: Math.max(0, sendAtMs - now),
          jobId: `scheduled-message-${scheduledMessageId}-${sendAtMs}`,
        },
      );
    }

    return scheduledMessage;
  }

  await app.prisma.scheduledMessage.update({
    where: { id: scheduledMessageId },
    data: {
      status: 'processing',
      errorMessage: null,
    },
  });

  try {
    await deliverOutboundMessage(app, {
      ticketId: scheduledMessage.ticketId,
      actorUserId: scheduledMessage.createdByUserId,
      body: scheduledMessage.body ?? '',
      internalNote: scheduledMessage.internalNote,
      replyToMessageId: scheduledMessage.replyToMessageId,
      attachment: (scheduledMessage.attachmentPayload ?? null) as OutgoingAttachmentInput | null,
    });

    return await app.prisma.scheduledMessage.update({
      where: { id: scheduledMessageId },
      data: {
        status: 'sent',
        sentAt: new Date(),
        errorMessage: null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao enviar mensagem agendada.';

    await app.prisma.scheduledMessage.update({
      where: { id: scheduledMessageId },
      data: {
        status: 'failed',
        errorMessage: message,
      },
    });

    throw error;
  }
}
