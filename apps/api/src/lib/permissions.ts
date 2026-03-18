import type { Prisma, UserRole } from '@prisma/client';

export const permissionDefinitions = [
  { key: 'dashboard.view', group: 'Painel geral', label: 'Visualizar painel geral' },
  { key: 'tickets.view', group: 'Atendimento', label: 'Visualizar atendimento' },
  { key: 'tickets.accept', group: 'Atendimento', label: 'Aceitar atendimentos' },
  { key: 'tickets.reply', group: 'Atendimento', label: 'Responder mensagens' },
  { key: 'tickets.close', group: 'Atendimento', label: 'Encerrar atendimentos' },
  { key: 'tickets.groups', group: 'Atendimento', label: 'Visualizar grupos' },
  { key: 'channels.view', group: 'Canais e instancias', label: 'Visualizar canais e instancias' },
  { key: 'channels.manage', group: 'Canais e instancias', label: 'Cadastrar e editar instancias' },
  { key: 'quickReplies.view', group: 'Respostas rapidas', label: 'Visualizar respostas rapidas' },
  { key: 'quickReplies.manage', group: 'Respostas rapidas', label: 'Cadastrar e editar respostas rapidas' },
  { key: 'team.view', group: 'Equipe e filas', label: 'Visualizar equipe e filas' },
  { key: 'agents.manage', group: 'Equipe e filas', label: 'Cadastrar e editar usuarios' },
  { key: 'queues.manage', group: 'Equipe e filas', label: 'Cadastrar e editar filas' },
  { key: 'queues.assign', group: 'Equipe e filas', label: 'Associar agentes as filas' },
  { key: 'api.view', group: 'API', label: 'Visualizar modulo de API' },
  { key: 'contacts.view', group: 'Contatos', label: 'Visualizar contatos' },
  { key: 'contacts.manage', group: 'Contatos', label: 'Cadastrar e editar contatos' },
  { key: 'profile.view', group: 'Perfil', label: 'Visualizar perfil' },
  { key: 'activity.view', group: 'Atividade', label: 'Visualizar atividade operacional' },
  { key: 'calendar.view', group: 'Agenda', label: 'Visualizar agenda operacional' },
  { key: 'automations.view', group: 'Automacoes', label: 'Visualizar automacoes' },
  { key: 'settings.view', group: 'Configuracoes', label: 'Visualizar configuracoes' },
] as const;

export type PermissionKey = typeof permissionDefinitions[number]['key'];
export type PermissionMap = Record<PermissionKey, boolean>;

const allKeys = permissionDefinitions.map((item) => item.key) as PermissionKey[];

function buildPermissionMap(value: boolean): PermissionMap {
  return allKeys.reduce((acc, key) => {
    acc[key] = value;
    return acc;
  }, {} as PermissionMap);
}

export function defaultPermissionsForRole(role: UserRole): PermissionMap {
  if (role === 'admin') {
    return buildPermissionMap(true);
  }

  return {
    'dashboard.view': true,
    'tickets.view': true,
    'tickets.accept': true,
    'tickets.reply': true,
    'tickets.close': true,
    'tickets.groups': true,
    'channels.view': true,
    'channels.manage': false,
    'quickReplies.view': true,
    'quickReplies.manage': false,
    'team.view': false,
    'agents.manage': false,
    'queues.manage': false,
    'queues.assign': false,
    'api.view': false,
    'contacts.view': true,
    'contacts.manage': false,
    'profile.view': true,
    'activity.view': true,
    'calendar.view': true,
    'automations.view': false,
    'settings.view': false,
  };
}

export function resolvePermissions(role: UserRole, raw: Prisma.JsonValue | null | undefined): PermissionMap {
  const defaults = defaultPermissionsForRole(role);

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return defaults;
  }

  const parsed = { ...defaults };
  for (const key of allKeys) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === 'boolean') {
      parsed[key] = value;
    }
  }

  return parsed;
}

export function permissionsToJson(permissions: Partial<Record<PermissionKey, boolean>>, role: UserRole): Prisma.InputJsonValue {
  const defaults = defaultPermissionsForRole(role);
  const normalized = { ...defaults };

  for (const key of allKeys) {
    const value = permissions[key];
    if (typeof value === 'boolean') {
      normalized[key] = value;
    }
  }

  return normalized as Prisma.InputJsonValue;
}

export function hasPermission(role: UserRole, raw: Prisma.JsonValue | null | undefined, key: PermissionKey): boolean {
  return resolvePermissions(role, raw)[key] === true;
}
