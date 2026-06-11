import { z } from 'zod';

export const ticketStatusSchema = z.enum(['open', 'pending', 'closed']);
export type TicketStatus = z.infer<typeof ticketStatusSchema>;

export const ticketListFilterSchema = z.object({
  status: ticketStatusSchema.optional(),
  agentId: z.string().uuid().optional(),
  queueId: z.string().uuid().optional(),
  search: z.string().min(1).optional(),
  limit: z.number().int().positive().max(100).default(20),
});

export const sendMessageSchema = z.object({
  body: z.string().min(1),
  replyToMessageId: z.string().uuid().optional(),
});

export type TicketListFilter = z.infer<typeof ticketListFilterSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
