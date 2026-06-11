import type { Prisma } from '@prisma/client';

export type TicketGroupVisibility = {
  isGroup?: boolean | null;
  hiddenForUsers?: Array<{ userId: string }>;
};

export function groupTicketHiddenUsersInclude(viewerId: string) {
  return {
    where: {
      userId: viewerId,
    },
    select: {
      userId: true,
    },
  };
}

export function isGroupTicketHiddenForViewer(
  ticket: TicketGroupVisibility,
  viewer: { id: string; role: 'admin' | 'agent' },
) {
  if (viewer.role === 'admin' || !ticket.isGroup) {
    return false;
  }

  return Boolean(ticket.hiddenForUsers?.some((item) => item.userId === viewer.id));
}

export function groupTicketVisibilityWhere(viewer: { id: string; role: 'admin' | 'agent' }) {
  if (viewer.role === 'admin') {
    return {};
  }

  return {
    OR: [
      { isGroup: false },
      {
        isGroup: true,
        hiddenForUsers: {
          none: {
            userId: viewer.id,
          },
        },
      },
    ],
  } satisfies Prisma.TicketWhereInput;
}
