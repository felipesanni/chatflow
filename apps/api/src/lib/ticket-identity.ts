import { Prisma } from '@prisma/client';

export const ACTIVE_TICKET_STATUSES = ['open', 'pending'] as const;

export interface TicketChatIdentity {
  canonicalChatId: string | null;
  contactId: string | null;
  lookupChatIds: string[];
}

export function buildTicketAliasCandidates(params: {
  remoteJid?: string | null;
  canonicalChatId?: string | null;
  contactId?: string | null;
  aliases?: string[] | null;
}) {
  const normalizedContactId = normalizeTicketIdentityPhone(params.contactId);
  const rawRemoteJid = typeof params.remoteJid === 'string' && params.remoteJid.trim().length > 0
    ? params.remoteJid.trim()
    : null;
  const canonicalChatId = typeof params.canonicalChatId === 'string' && params.canonicalChatId.trim().length > 0
    ? params.canonicalChatId.trim()
    : null;
  const aliases = (params.aliases ?? [])
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return Array.from(new Set([
    rawRemoteJid,
    canonicalChatId,
    ...aliases,
    normalizedContactId ? normalizeTicketRemoteJid(normalizedContactId) : null,
    normalizedContactId ? `${normalizedContactId}@c.us` : null,
    normalizedContactId,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0)));
}

export function normalizeTicketIdentityPhone(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const digits = value.replace(/[^0-9]/g, '');
  if (!digits) {
    return null;
  }

  if (digits.length < 8 || digits.length > 15) {
    return null;
  }

  if (!digits.startsWith('55')) {
    return null;
  }

  if (digits.startsWith('0')) {
    return null;
  }

  if (/^(\d)\1+$/.test(digits)) {
    return null;
  }

  return digits;
}

export function normalizeTicketRemoteJid(phone: string) {
  return `${phone}@s.whatsapp.net`;
}

export function buildTicketChatIdentity(params: {
  remoteJid?: string | null;
  phone?: string | null;
  isGroup?: boolean;
  aliases?: string[] | null;
}): TicketChatIdentity {
  const rawRemoteJid = typeof params.remoteJid === 'string' && params.remoteJid.trim().length > 0
    ? params.remoteJid.trim()
    : null;
  const aliases = (params.aliases ?? [])
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const contactId = normalizeTicketIdentityPhone(params.phone);

  if (params.isGroup) {
    return {
      canonicalChatId: rawRemoteJid,
      contactId,
      lookupChatIds: Array.from(new Set([
        ...(rawRemoteJid ? [rawRemoteJid] : []),
        ...aliases,
      ])),
    };
  }

  const [localPart = '', rawDomain = ''] = rawRemoteJid?.split('@') ?? [];
  const baseLocalPart = localPart.split(':')[0]?.trim() ?? '';
  const normalizedDomain = rawDomain.trim().toLowerCase();
  const baseDigits = normalizeTicketIdentityPhone(baseLocalPart);
  const canonicalChatId = contactId
    ? normalizeTicketRemoteJid(contactId)
    : baseDigits
      ? normalizeTicketRemoteJid(baseDigits)
      : rawRemoteJid;
  const lookupChatIds = Array.from(new Set([
    canonicalChatId,
    rawRemoteJid,
    ...aliases,
    baseDigits ? normalizeTicketRemoteJid(baseDigits) : null,
    baseDigits ? `${baseDigits}@c.us` : null,
    baseDigits && normalizedDomain ? `${baseDigits}@${normalizedDomain}` : null,
    baseLocalPart && normalizedDomain ? `${baseLocalPart}@${normalizedDomain}` : null,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0)));

  return {
    canonicalChatId,
    contactId,
    lookupChatIds,
  };
}

export function buildActiveTicketIdentityWhere(
  whatsappInstanceId: string,
  identity: TicketChatIdentity,
): Prisma.TicketWhereInput {
  const orConditions: Prisma.TicketWhereInput[] = [
    ...(identity.lookupChatIds.length > 0
      ? [{
          externalChatId: {
            in: identity.lookupChatIds,
          },
        }]
      : []),
    ...(identity.contactId
      ? [{ externalContactId: identity.contactId }]
      : []),
  ];

  return {
    whatsappInstanceId,
    status: { in: [...ACTIVE_TICKET_STATUSES] },
    ...(orConditions.length > 0
      ? { OR: orConditions }
      : { externalChatId: '__unmatchable__' }),
  };
}

type PrismaTransactionalClient = {
  $transaction: <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => Promise<T>;
};

export async function withTicketIdentityLock<T>(
  prisma: PrismaTransactionalClient,
  params: {
    whatsappInstanceId: string;
    canonicalChatId: string | null;
  },
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return withScopedAdvisoryLock(prisma, {
    scope: params.whatsappInstanceId,
    key: params.canonicalChatId ?? 'unknown',
  }, operation);
}

export async function withScopedAdvisoryLock<T>(
  prisma: PrismaTransactionalClient,
  params: {
    scope: string;
    key: string;
  },
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${params.scope}), hashtext(${params.key}))`;
    return operation(tx);
  });
}
