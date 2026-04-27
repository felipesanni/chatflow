"use client";

import * as React from "react";
import { io, type Socket } from "socket.io-client";
import { PhotoProvider, PhotoView } from "react-photo-view";
import {
  Archive,
  ArrowRightLeft,
  Copy,
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  Clock,
  Code2,
  Eye,
  EyeOff,
  FileAudio,
  FileText,
  Info,
  LayoutGrid,
  Lock,
  LogIn,
  Mail,
  Menu,
  MessageSquare,
  Mic,
  Pencil,
  Phone,
  Paperclip,
  Plus,
  Play,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Smile,
  Square,
  Smartphone,
  Trash2,
  User,
  UserPlus,
  Users,
  Workflow,
  X,
  Zap,
} from "lucide-react";

type AuthUser = {
  id: string;
  email: string;
  role: "admin" | "agent";
  name: string;
  avatarUrl?: string | null;
  permissions: PermissionMap;
};

type AuthResponse = {
  authenticated?: boolean;
  user?: AuthUser;
};

type TicketItem = {
  id: string;
  status: "open" | "pending" | "closed";
  customerId?: string | null;
  customerName: string;
  manualGroupName?: string | null;
  externalChatId: string;
  externalContactId?: string | null;
  customerAvatarUrl?: string | null;
  lastMessagePreview: string | null;
  lastMessageAt?: string;
  unreadCount: number;
  isGroup: boolean;
  updatedAt: string;
  currentAgent: { id: string; name: string } | null;
  currentQueue: { id: string; name: string; color?: string | null } | null;
  whatsappInstance: { id: string; name: string };
  latestNudge?: {
    createdAt: string;
    actorUserId?: string | null;
    actorName: string;
  } | null;
};

type TicketHistoryItem = {
  id: string;
  type: "created" | "accepted" | "transferred" | "nudged" | "closed" | "reopened";
  createdAt: string;
  actorName: string;
  summary: string;
  reason?: string | null;
  note?: string | null;
  fromAgent?: { id: string; name: string } | null;
  toAgent?: { id: string; name: string } | null;
  fromQueue?: { id: string; name: string; color?: string | null } | null;
  toQueue?: { id: string; name: string; color?: string | null } | null;
};

type MessageItem = {
  id: string;
  direction: "inbound" | "outbound" | "system";
  contentType: string;
  body: string | null;
  senderName: string | null;
  internalNote?: boolean;
  editedAt?: string | null;
  createdAt: string;
  replyToMessage?: ReplyMessageItem | null;
  reactions?: MessageReactionItem[];
  deleted?: MessageDeletedState | null;
  hiddenForMe?: boolean;
  attachments?: AttachmentItem[];
};

type MessageDeletedState = {
  isDeleted: boolean;
  deletedAt?: string | null;
  scope?: string | null;
};

type MessageReactionItem = {
  emoji: string;
  actorType: "agent" | "contact";
  actorId: string | null;
  actorName: string | null;
  createdAt: string;
};

type ReplyMessageItem = {
  id: string;
  direction: "inbound" | "outbound" | "system";
  contentType: string;
  body: string | null;
  senderName: string | null;
  createdAt: string;
  internalNote?: boolean;
  deleted?: MessageDeletedState | null;
  hiddenForMe?: boolean;
  attachments?: AttachmentItem[];
};

type AttachmentItem = {
  id: string;
  fileName: string | null;
  mimeType: string;
  sizeBytes: number | null;
  storage: string;
  storageKey: string;
  publicUrl: string | null;
  createdAt?: string;
};

type MessageMenuPosition = {
  top: number;
  left: number;
};

type ComposerAttachment = {
  kind: "image" | "audio" | "document";
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
};

type ScheduledMessageItem = {
  id: string;
  ticketId: string;
  body: string | null;
  contentType: string;
  internalNote: boolean;
  attachment?: ComposerAttachment | null;
  replyToMessageId?: string | null;
  sendAt: string;
  status: "pending" | "processing" | "failed" | "sent" | "canceled";
  errorMessage?: string | null;
  sentAt?: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
  };
  ticket?: {
    id: string;
    status: "open" | "pending" | "closed";
    customerName: string;
    manualGroupName?: string | null;
    isGroup: boolean;
    currentQueue: { id: string; name: string; color?: string | null } | null;
    currentAgent: { id: string; name: string } | null;
    whatsappInstance: { id: string; name: string };
  };
};

type InstanceItem = {
  id: string;
  publicId: number;
  name: string;
  evolutionInstanceName: string;
  baseUrl: string;
  defaultQueueId?: string | null;
  defaultQueue?: { id: string; name: string } | null;
  status: string;
  phoneNumber: string | null;
  createdAt: string;
};

type AgentItem = {
  id: string;
  publicId: number;
  name: string;
  email: string;
  role: "admin" | "agent";
  permissions: PermissionMap;
  status: "active" | "inactive";
  accessStartTime: string | null;
  accessEndTime: string | null;
  isBotAgent: boolean;
  presence: string;
  queues: Array<{ id: string; name: string }>;
  createdAt: string;
};

type QueueItem = {
  id: string;
  publicId: number;
  name: string;
  color: string | null;
  isActive: boolean;
  isBotQueue: boolean;
  openTicketCount: number;
  agents: Array<{ id: string; name: string }>;
};

type AutomationCondition = {
  field: string;
  operator: string;
  value?: unknown;
  valueLabel?: string;
};

type AutomationAction = {
  type: string;
  config?: Record<string, unknown>;
  summary?: string;
};

type AutomationScheduleConfig = {
  time?: string;
  daysOfWeek?: number[];
};

type AutomationItem = {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "active" | "inactive";
  triggerType: "message_received" | "ticket_created" | "ticket_inactive" | "scheduled_time";
  queueId?: string | null;
  whatsappInstanceId?: string | null;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  scheduleConfig?: AutomationScheduleConfig | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string } | null;
  updatedBy?: { id: string; name: string } | null;
  queue?: { id: string; name: string; color: string | null } | null;
  whatsappInstance?: { id: string; name: string } | null;
  executionCount: number;
  latestExecution?: {
    id: string;
    status: "success" | "skipped" | "failed";
    executedAt: string;
    message?: string | null;
  } | null;
};

type AutomationExecutionItem = {
  id: string;
  status: "success" | "skipped" | "failed";
  message?: string | null;
  triggerPayload?: unknown;
  resultPayload?: unknown;
  executedAt: string;
  automation: {
    id: string;
    name: string;
    status: "draft" | "active" | "inactive";
    triggerType: "message_received" | "ticket_created" | "ticket_inactive" | "scheduled_time";
  };
};

type CreateConversationResponse = {
  item: TicketItem;
  created: boolean;
};

type CustomerItem = {
  id: string;
  name: string;
  phone: string | null;
  avatarUrl?: string | null;
  email: string | null;
  companyName: string | null;
  notes: string | null;
  dashboardExcluded?: boolean;
  createdAt: string;
  updatedAt: string;
  lastTicket: {
    id: string;
    status: "open" | "pending" | "closed";
    updatedAt: string;
    queueName: string | null;
  } | null;
};

type CustomerTicketsViewerState = {
  customer: CustomerItem;
  tickets: TicketItem[];
  loading: boolean;
};

type ForwardDestination = {
  key: string;
  kind: "ticket" | "contact" | "manual";
  label: string;
  meta: string;
  avatarUrl?: string | null;
  ticketId?: string;
  customerId?: string;
  phone?: string | null;
  instanceId?: string | null;
};

type QuickReplyItem = {
  id: string;
  shortcut: string;
  content: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type AppDialogState = {
  kind: "alert" | "confirm";
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
};

type DashboardRangeKey = "today" | "7d" | "30d";

type DashboardOverview = {
  period: {
    key: DashboardRangeKey;
    label: string;
    from: string;
    to: string;
  };
  selectedAgentId: string | null;
  overview: {
    openTickets: number;
    pendingTickets: number;
    groupTickets: number;
    closedInPeriod: number;
    unassignedTickets: number;
    withoutQueueTickets: number;
    inboundMessages: number;
    outboundMessages: number;
    averageFirstResponseMinutes: number | null;
    averageHandleMinutes: number | null;
    averageAcceptanceMinutes: number | null;
  };
  queues: Array<{
    id: string;
    name: string;
    color: string | null;
    open: number;
    pending: number;
    closed: number;
  }>;
  agents: Array<{
    id: string;
    name: string;
    open: number;
    pending: number;
    closed: number;
  }>;
  dailySeries: Array<{
    date: string;
    created: number;
    closed: number;
    inbound: number;
    outbound: number;
  }>;
  alerts: {
    stalePending: Array<{
      id: string;
      customerName: string;
      waitingMinutes: number;
      queueName: string;
      agentName: string;
    }>;
    withoutQueue: Array<{
      id: string;
      customerName: string;
      status: string;
    }>;
    withoutAgent: Array<{
      id: string;
      customerName: string;
      status: string;
    }>;
  };
};

type ApiDocMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type ApiTesterAuthMode = "bearer" | "session" | "publica" | "sessao";

type ApiEndpointDoc = {
  key: string;
  method: ApiDocMethod;
  module: string;
  title: string;
  summary: string;
  publicPath: string;
  testerPath: string;
  auth: ApiTesterAuthMode;
  permission?: string;
  query?: Array<{ name: string; description: string }>;
  bodyExample?: string;
  successExample?: string;
  notes?: string[];
};

type ApiModuleDoc = {
  key: string;
  title: string;
  description: string;
  endpoints: ApiEndpointDoc[];
};

type ApiTesterResult = {
  method: ApiDocMethod;
  requestedPath: string;
  status: number;
  ok: boolean;
  durationMs: number;
  contentType: string | null;
  headers: Array<{ key: string; value: string }>;
  body: string;
};

type DynamicFieldSuggestion = {
  token: string;
  label: string;
  description: string;
};

type SearchScopeKey =
  | "tickets"
  | "channels"
  | "quickReplies"
  | "apiReference"
  | "teamAgents"
  | "teamQueues"
  | "contacts"
  | "calendar"
  | "automationsRules"
  | "automationsExecutions"
  | "settingsInstances"
  | "settingsAgents"
  | "settingsQueues";

type ApiAccessTokenItem = {
  id: string;
  name: string;
  tokenPrefix: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  createdBy: { id: string; name: string } | null;
};

type ApiAccessTokenCreateResponse = {
  item: ApiAccessTokenItem;
  token: string;
  message: string;
};

type BrowserPushConfigResponse = {
  enabled: boolean;
  publicKey: string | null;
};

const permissionDefinitions = [
  { key: "dashboard.view", group: "Painel geral", label: "Visualizar painel geral" },
  { key: "tickets.view", group: "Atendimento", label: "Visualizar atendimento" },
  { key: "tickets.viewAll", group: "Atendimento", label: "Visualizar todos os tickets" },
  { key: "tickets.viewOthers", group: "Atendimento", label: "Visualizar tickets de outros usuários" },
  { key: "tickets.viewUnassigned", group: "Atendimento", label: "Visualizar tickets sem fila" },
  { key: "tickets.accept", group: "Atendimento", label: "Aceitar atendimentos" },
  { key: "tickets.reply", group: "Atendimento", label: "Responder mensagens" },
  { key: "tickets.replyUnassigned", group: "Atendimento", label: "Responder tickets não atribuídos ao usuário" },
  { key: "tickets.nudge", group: "Atendimento", label: "Chamar atenção do responsável" },
  { key: "tickets.transfer", group: "Atendimento", label: "Transferir atendimentos" },
  { key: "tickets.transferOthers", group: "Atendimento", label: "Transferir tickets de outros usuários" },
  { key: "tickets.close", group: "Atendimento", label: "Encerrar atendimentos" },
  { key: "tickets.closeWithoutAccept", group: "Atendimento", label: "Encerrar tickets sem aceitar atendimento" },
  { key: "tickets.closedView", group: "Atendimento", label: "Visualizar módulo de tickets fechados" },
  { key: "tickets.bulkDelete", group: "Atendimento", label: "Apagar tickets em lote" },
  { key: "messages.bulkDelete", group: "Atendimento", label: "Apagar mensagens em lote" },
  { key: "tickets.groups", group: "Atendimento", label: "Visualizar grupos" },
  { key: "channels.view", group: "Canais e instâncias", label: "Visualizar canais e instâncias" },
  { key: "channels.manage", group: "Canais e instâncias", label: "Cadastrar e editar instâncias" },
  { key: "quickReplies.view", group: "Respostas rápidas", label: "Visualizar respostas rápidas" },
  { key: "quickReplies.manage", group: "Respostas rápidas", label: "Cadastrar e editar respostas rápidas" },
  { key: "team.view", group: "Equipe e filas", label: "Visualizar equipe e filas" },
  { key: "agents.manage", group: "Equipe e filas", label: "Cadastrar e editar usuários" },
  { key: "agents.delete", group: "Equipe e filas", label: "Excluir usuários" },
  { key: "agents.password.manage", group: "Equipe e filas", label: "Alterar senhas de usuários" },
  { key: "agents.viewBot", group: "Equipe e filas", label: "Visualizar agentes de automação (bot)" },
  { key: "queues.manage", group: "Equipe e filas", label: "Cadastrar e editar filas" },
  { key: "queues.assign", group: "Equipe e filas", label: "Associar agentes às filas" },
  { key: "queues.viewBot", group: "Equipe e filas", label: "Visualizar filas de automação (bot)" },
  { key: "api.view", group: "API", label: "Visualizar módulo de API" },
  { key: "api.manage", group: "API", label: "Gerenciar tokens da API" },
  { key: "contacts.view", group: "Contatos", label: "Visualizar contatos" },
  { key: "contacts.manage", group: "Contatos", label: "Cadastrar e editar contatos" },
  { key: "profile.view", group: "Perfil", label: "Visualizar perfil" },
  { key: "activity.view", group: "Atividade", label: "Visualizar atividade operacional" },
  { key: "calendar.view", group: "Agenda", label: "Visualizar agenda operacional" },
  { key: "automations.view", group: "Automações", label: "Visualizar automações" },
  { key: "automations.manage", group: "Automações", label: "Criar e editar automações" },
  { key: "settings.view", group: "Configurações", label: "Visualizar configurações" },
] as const;

type PermissionKey = (typeof permissionDefinitions)[number]["key"];
type PermissionMap = Record<PermissionKey, boolean>;
type WorkspaceKey = "dashboard" | "tickets" | "closedTickets" | "channels" | "quickReplies" | "team" | "api" | "contacts" | "profile" | "calendar" | "automations" | "settings";

const permissionKeys = permissionDefinitions.map((item) => item.key) as PermissionKey[];

const workspacePermissions: Record<WorkspaceKey, PermissionKey> = {
  dashboard: "dashboard.view",
  tickets: "tickets.view",
  closedTickets: "tickets.closedView",
  channels: "channels.view",
  quickReplies: "quickReplies.view",
  team: "team.view",
  api: "api.view",
  contacts: "contacts.view",
  profile: "profile.view",
  calendar: "calendar.view",
  automations: "automations.view",
  settings: "settings.view",
};

function defaultPermissionsForRole(role: "admin" | "agent"): PermissionMap {
  if (role === "admin") {
    return permissionKeys.reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {} as PermissionMap);
  }

  return {
    "dashboard.view": true,
    "tickets.view": true,
    "tickets.viewAll": false,
    "tickets.viewOthers": false,
    "tickets.viewUnassigned": true,
    "tickets.accept": true,
    "tickets.reply": true,
    "tickets.replyUnassigned": false,
    "tickets.nudge": false,
    "tickets.transfer": true,
    "tickets.transferOthers": false,
    "tickets.close": true,
    "tickets.closeWithoutAccept": false,
    "tickets.closedView": false,
    "tickets.bulkDelete": false,
    "messages.bulkDelete": false,
    "tickets.groups": true,
    "channels.view": true,
    "channels.manage": false,
    "quickReplies.view": true,
    "quickReplies.manage": false,
    "team.view": false,
    "agents.manage": false,
    "agents.delete": false,
    "agents.password.manage": false,
    "agents.viewBot": false,
    "queues.manage": false,
    "queues.assign": false,
    "queues.viewBot": false,
    "api.view": false,
    "api.manage": false,
    "contacts.view": true,
    "contacts.manage": false,
    "profile.view": true,
    "activity.view": true,
    "calendar.view": true,
    "automations.view": false,
    "automations.manage": false,
    "settings.view": false,
  };
}

function normalizePermissions(role: "admin" | "agent", raw?: Partial<Record<PermissionKey, boolean>> | null): PermissionMap {
  const defaults = defaultPermissionsForRole(role);
  if (!raw) return defaults;

  const normalized = { ...defaults };
  for (const key of permissionKeys) {
    if (typeof raw[key] === "boolean") {
      normalized[key] = raw[key] as boolean;
    }
  }
  return normalized;
}

const API_URL = "/api-proxy";
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? null;
const BRAND_LOGO_STORAGE_KEY = "chatflow.brand.logo";
const BRAND_MODE_STORAGE_KEY = "chatflow.brand.mode";
const BRAND_TEXT_STORAGE_KEY = "chatflow.brand.text";
const TICKET_NUDGE_SEEN_STORAGE_KEY_PREFIX = "chatflow.ticket-nudges.seen";
const CONFIGURED_PUBLIC_WEB_BASE_URL = process.env.NEXT_PUBLIC_WEB_BASE_URL ?? null;
const CONFIGURED_PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? null;
const EMOJI_LIBRARY = ["😀", "😂", "😊", "😍", "🙏", "👍", "👏", "🎉", "❤️", "🔥", "👀", "✅", "😉", "🤝", "😅", "🙌", "🤔", "😎", "📎", "📞"];
const MESSAGE_REACTION_LIBRARY = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function deriveApiBaseUrlFromWebOrigin(origin: string) {
  try {
    const url = new URL(origin);
    const hostname = url.hostname;

    if (hostname.startsWith("chatflow.")) {
      url.hostname = `apiflow.${hostname.slice("chatflow.".length)}`;
      return url.origin;
    }

    if (hostname.startsWith("web.")) {
      url.hostname = `api.${hostname.slice("web.".length)}`;
      return url.origin;
    }

    if (hostname.includes("-web.")) {
      url.hostname = hostname.replace("-web.", "-api.");
      return url.origin;
    }

    return origin;
  } catch {
    return origin;
  }
}

function resolvePublicUrls() {
  const detectedWebBaseUrl =
    CONFIGURED_PUBLIC_WEB_BASE_URL
    ?? (typeof window !== "undefined" ? window.location.origin : "https://chatflow.local");

  const detectedApiBaseUrl =
    CONFIGURED_PUBLIC_API_BASE_URL
    ?? deriveApiBaseUrlFromWebOrigin(detectedWebBaseUrl);

  return {
    webBaseUrl: detectedWebBaseUrl,
    apiBaseUrl: detectedApiBaseUrl,
    webhookUrl: `${detectedApiBaseUrl}/api/webhooks/evolution`,
  };
}

const COMPOSER_DYNAMIC_FIELDS: DynamicFieldSuggestion[] = [
  { token: "customerName", label: "Nome do contato", description: "Nome completo do contato ou grupo." },
  { token: "firstName", label: "Primeiro nome", description: "Primeiro nome do contato." },
  { token: "phone", label: "Telefone", description: "Telefone atual do ticket." },
  { token: "agentName", label: "Nome do agente", description: "Nome do agente responsável ou remetente." },
  { token: "queueName", label: "Fila", description: "Nome da fila atual do atendimento." },
  { token: "instanceName", label: "Instância", description: "Nome da instância conectada ao ticket." },
  { token: "ticketId", label: "ID do ticket", description: "Identificador interno do atendimento." },
  { token: "ticketStatus", label: "Status do ticket", description: "Status atual do atendimento." },
];

function getDynamicFieldCommandFromText(value: string) {
  const match = value.match(/\{\{?([a-z0-9_]*)$/i);
  if (!match) return null;
  return match[1]?.toLowerCase() ?? "";
}

function getDynamicFieldCommandFromCursor(value: string, cursorPosition: number | null | undefined) {
  const safeCursor = typeof cursorPosition === "number" ? Math.max(0, Math.min(cursorPosition, value.length)) : value.length;
  return getDynamicFieldCommandFromText(value.slice(0, safeCursor));
}

function getDynamicFieldMatchesFromText(value: string) {
  const command = getDynamicFieldCommandFromText(value);
  if (command === null) {
    return [];
  }

  return COMPOSER_DYNAMIC_FIELDS
    .filter((item) =>
      item.token.toLowerCase().includes(command)
      || item.label.toLowerCase().includes(command)
      || item.description.toLowerCase().includes(command),
    )
    .slice(0, 6);
}

function getDynamicFieldMatchesFromCursor(value: string, cursorPosition: number | null | undefined) {
  const command = getDynamicFieldCommandFromCursor(value, cursorPosition);
  if (command === null) {
    return [];
  }

  return COMPOSER_DYNAMIC_FIELDS
    .filter((item) =>
      item.token.toLowerCase().includes(command)
      || item.label.toLowerCase().includes(command)
      || item.description.toLowerCase().includes(command),
    )
    .slice(0, 6);
}

function insertDynamicFieldToken(value: string, token: string) {
  return value.replace(/\{\{?([a-z0-9_]*)$/i, `{{${token}}}`);
}

function insertDynamicFieldTokenAtCursor(value: string, token: string, cursorPosition: number | null | undefined) {
  const safeCursor = typeof cursorPosition === "number" ? Math.max(0, Math.min(cursorPosition, value.length)) : value.length;
  const beforeCursor = value.slice(0, safeCursor);
  const afterCursor = value.slice(safeCursor);
  const replacedBeforeCursor = beforeCursor.replace(/\{\{?([a-z0-9_]*)$/i, `{{${token}}}`);
  return `${replacedBeforeCursor}${afterCursor}`;
}

const API_REFERENCE_MODULES: ApiModuleDoc[] = [
  {
    key: "auth",
    title: "Autenticação",
    description: "Sessão do painel, bootstrap inicial e perfil do usuário autenticado.",
    endpoints: [
      {
        key: "auth-bootstrap",
        method: "POST",
        module: "Autenticação",
        title: "Bootstrap inicial",
        summary: "Cria o primeiro administrador do sistema quando o ambiente ainda não foi inicializado.",
        publicPath: "/api/auth/bootstrap",
        testerPath: "/auth/bootstrap",
        auth: "publica",
        bodyExample: JSON.stringify({ name: "Administrador", email: "admin@empresa.com", password: "Senha@123" }, null, 2),
      },
      {
        key: "auth-login",
        method: "POST",
        module: "Autenticação",
        title: "Login",
        summary: "Inicia a sessão do usuário usando cookie autenticado.",
        publicPath: "/api/auth/login",
        testerPath: "/auth/login",
        auth: "publica",
        bodyExample: JSON.stringify({ email: "admin@empresa.com", password: "Senha@123" }, null, 2),
      },
      {
        key: "auth-me",
        method: "GET",
        module: "Autenticação",
        title: "Sessão atual",
        summary: "Retorna o usuário autenticado e suas permissões.",
        publicPath: "/api/auth/me",
        testerPath: "/auth/me",
        auth: "sessao",
      },
      {
        key: "auth-profile",
        method: "PATCH",
        module: "Autenticação",
        title: "Atualizar perfil",
        summary: "Atualiza nome, avatar e senha do próprio usuário.",
        publicPath: "/api/auth/me/profile",
        testerPath: "/auth/me/profile",
        auth: "sessao",
        bodyExample: JSON.stringify({ name: "Novo nome" }, null, 2),
      },
      {
        key: "auth-logout",
        method: "POST",
        module: "Autenticação",
        title: "Logout",
        summary: "Encerra a sessão atual do painel.",
        publicPath: "/api/auth/logout",
        testerPath: "/auth/logout",
        auth: "sessao",
      },
    ],
  },
  {
    key: "dashboard",
    title: "Painel Geral",
    description: "Indicadores operacionais, séries históricas e alertas consolidados.",
    endpoints: [
      {
        key: "dashboard-overview",
        method: "GET",
        module: "Painel Geral",
        title: "Resumo do dashboard",
        summary: "Entrega cards, distribuição por fila/agente, série diária e alertas.",
        publicPath: "/api/dashboard/overview",
        testerPath: "/dashboard/overview?range=7d",
        auth: "sessao",
        query: [
          { name: "range", description: "today, 7d ou 30d." },
          { name: "agentId", description: "all, me ou um ID numérico específico de agente." },
        ],
      },
    ],
  },
  {
    key: "tickets",
    title: "Tickets",
    description: "Caixa de entrada, abertura, aceite, transferência, encerramento e fusão.",
    endpoints: [
      {
        key: "tickets-list",
        method: "GET",
        module: "Tickets",
        title: "Listar tickets",
        summary: "Base do módulo de Atendimento, com filtros por status e tipo de conversa.",
        publicPath: "/api/tickets",
        testerPath: "/tickets?status=open&isGroup=false",
        auth: "sessao",
        query: [
          { name: "status", description: "open, pending ou closed." },
          { name: "isGroup", description: "true para grupos, false para contatos individuais." },
          { name: "queueId", description: "Filtra por ID numérico de fila." },
        ],
      },
      {
        key: "tickets-get",
        method: "GET",
        module: "Tickets",
        title: "Detalhar ticket",
        summary: "Retorna um ticket específico com os metadados principais.",
        publicPath: "/api/tickets/:ticketId",
        testerPath: "/tickets/SEU_TICKET_ID",
        auth: "sessao",
        notes: ["Substitua SEU_TICKET_ID antes de rodar o teste."],
      },
      {
        key: "tickets-create",
        method: "POST",
        module: "Tickets",
        title: "Abrir ticket",
        summary: "Cria um atendimento manual para um telefone ou cliente existente.",
        publicPath: "/api/tickets",
        testerPath: "/tickets",
        auth: "sessao",
        permission: "tickets.manage",
        bodyExample: JSON.stringify({ phone: "5511999999999", whatsappInstanceId: 12 }, null, 2),
      },
      {
        key: "tickets-accept",
        method: "POST",
        module: "Tickets",
        title: "Aceitar atendimento",
        summary: "Assume o ticket e marca o atendimento como em andamento.",
        publicPath: "/api/tickets/:ticketId/accept",
        testerPath: "/tickets/SEU_TICKET_ID/accept",
        auth: "sessao",
      },
      {
        key: "tickets-close",
        method: "POST",
        module: "Tickets",
        title: "Fechar atendimento",
        summary: "Encerra um ticket ativo ou pendente.",
        publicPath: "/api/tickets/:ticketId/close",
        testerPath: "/tickets/SEU_TICKET_ID/close",
        auth: "sessao",
      },
      {
        key: "tickets-reopen",
        method: "POST",
        module: "Tickets",
        title: "Reabrir atendimento",
        summary: "Move um ticket fechado de volta para a operação.",
        publicPath: "/api/tickets/:ticketId/reopen",
        testerPath: "/tickets/SEU_TICKET_ID/reopen",
        auth: "sessao",
      },
      {
        key: "tickets-transfer",
        method: "POST",
        module: "Tickets",
        title: "Transferir ticket",
        summary: "Altera fila e/ou responsável do atendimento.",
        publicPath: "/api/tickets/:ticketId/transfer",
        testerPath: "/tickets/SEU_TICKET_ID/transfer",
        auth: "sessao",
        bodyExample: JSON.stringify({ queueId: 7, agentId: 14, note: "Mudança de responsável" }, null, 2),
      },
      {
        key: "tickets-group-name",
        method: "PATCH",
        module: "Tickets",
        title: "Nome manual de grupo",
        summary: "Define ou altera o nome manual de um grupo no atendimento.",
        publicPath: "/api/tickets/:ticketId/group-name",
        testerPath: "/tickets/SEU_TICKET_ID/group-name",
        auth: "sessao",
        bodyExample: JSON.stringify({ name: "Grupo Financeiro" }, null, 2),
      },
      {
        key: "tickets-duplicates",
        method: "GET",
        module: "Tickets",
        title: "Duplicidades",
        summary: "Lista tickets duplicados para revisão e fusão.",
        publicPath: "/api/tickets/duplicates",
        testerPath: "/tickets/duplicates",
        auth: "sessao",
      },
    ],
  },
  {
    key: "messages",
    title: "Mensagens",
    description: "Histórico, envio, reações, edição e exclusão de mensagens do ticket.",
    endpoints: [
      {
        key: "messages-list",
        method: "GET",
        module: "Mensagens",
        title: "Listar mensagens",
        summary: "Retorna o histórico completo de um ticket.",
        publicPath: "/api/tickets/:ticketId/messages",
        testerPath: "/tickets/SEU_TICKET_ID/messages",
        auth: "sessao",
      },
      {
        key: "messages-send",
        method: "POST",
        module: "Mensagens",
        title: "Enviar mensagem",
        summary: "Envia texto, nota interna ou mídia para o ticket.",
        publicPath: "/api/tickets/:ticketId/messages",
        testerPath: "/tickets/SEU_TICKET_ID/messages",
        auth: "sessao",
        bodyExample: JSON.stringify({ body: "Mensagem de teste" }, null, 2),
        notes: ["Para anexos, o endpoint aceita multipart/form-data no fluxo normal da aplicação."],
      },
      {
        key: "messages-edit",
        method: "PATCH",
        module: "Mensagens",
        title: "Editar mensagem",
        summary: "Edita o conteúdo de uma mensagem enviada.",
        publicPath: "/api/tickets/:ticketId/messages/:messageId",
        testerPath: "/tickets/SEU_TICKET_ID/messages/SUA_MENSAGEM_ID",
        auth: "sessao",
        bodyExample: JSON.stringify({ body: "Texto atualizado" }, null, 2),
      },
      {
        key: "messages-reaction",
        method: "POST",
        module: "Mensagens",
        title: "Reagir a mensagem",
        summary: "Adiciona ou substitui reação em uma mensagem.",
        publicPath: "/api/tickets/:ticketId/messages/:messageId/reactions",
        testerPath: "/tickets/SEU_TICKET_ID/messages/SUA_MENSAGEM_ID/reactions",
        auth: "sessao",
        bodyExample: JSON.stringify({ emoji: "👍" }, null, 2),
      },
      {
        key: "messages-delete",
        method: "POST",
        module: "Mensagens",
        title: "Excluir mensagem",
        summary: "Solicita exclusão da mensagem na integração.",
        publicPath: "/api/tickets/:ticketId/messages/:messageId/delete",
        testerPath: "/tickets/SEU_TICKET_ID/messages/SUA_MENSAGEM_ID/delete",
        auth: "sessao",
      },
      {
        key: "messages-attachment",
        method: "GET",
        module: "Mensagens",
        title: "Baixar anexo",
        summary: "Entrega o conteúdo binário de um anexo já vinculado ao ticket.",
        publicPath: "/api/tickets/:ticketId/attachments/:attachmentId/content",
        testerPath: "/tickets/SEU_TICKET_ID/attachments/SEU_ANEXO_ID/content",
        auth: "sessao",
      },
    ],
  },
  {
    key: "customers",
    title: "Contatos",
    description: "Cadastro operacional de contatos e leitura dos tickets vinculados.",
    endpoints: [
      {
        key: "customers-list",
        method: "GET",
        module: "Contatos",
        title: "Listar contatos",
        summary: "Carrega os contatos da operação para consulta e manutenção.",
        publicPath: "/api/customers",
        testerPath: "/customers",
        auth: "sessao",
      },
      {
        key: "customers-create",
        method: "POST",
        module: "Contatos",
        title: "Criar contato",
        summary: "Cadastra um contato manualmente.",
        publicPath: "/api/customers",
        testerPath: "/customers",
        auth: "sessao",
        permission: "customers.manage",
        bodyExample: JSON.stringify({ name: "Contato teste", phone: "5511999999999" }, null, 2),
      },
      {
        key: "customers-update",
        method: "PUT",
        module: "Contatos",
        title: "Atualizar contato",
        summary: "Atualiza nome, telefone, empresa, notas e flags do contato.",
        publicPath: "/api/customers/:customerId",
        testerPath: "/customers/SEU_CONTATO_ID",
        auth: "sessao",
        permission: "customers.manage",
        bodyExample: JSON.stringify({ name: "Contato atualizado", dashboardExcluded: false }, null, 2),
      },
      {
        key: "customers-dashboard-visibility",
        method: "PATCH",
        module: "Contatos",
        title: "Ignorar no dashboard",
        summary: "Marca um contato para ser ignorado apenas nos cálculos do Painel Geral.",
        publicPath: "/api/customers/:customerId/dashboard-visibility",
        testerPath: "/customers/SEU_CONTATO_ID/dashboard-visibility",
        auth: "sessao",
        permission: "customers.manage",
        bodyExample: JSON.stringify({ excluded: true }, null, 2),
      },
      {
        key: "customers-tickets",
        method: "GET",
        module: "Contatos",
        title: "Tickets do contato",
        summary: "Lista todos os tickets associados a um contato específico.",
        publicPath: "/api/customers/:customerId/tickets",
        testerPath: "/customers/SEU_CONTATO_ID/tickets",
        auth: "sessao",
      },
    ],
  },
  {
    key: "team",
    title: "Equipe e Filas",
    description: "Gestão de agentes, permissões, filas e respostas rápidas.",
    endpoints: [
      {
        key: "agents-list",
        method: "GET",
        module: "Equipe",
        title: "Listar agentes",
        summary: "Carrega usuários, perfil, presença, permissões e filas.",
        publicPath: "/api/agents",
        testerPath: "/agents",
        auth: "sessao",
      },
      {
        key: "agents-create",
        method: "POST",
        module: "Equipe",
        title: "Criar agente",
        summary: "Cadastra um novo usuário do painel.",
        publicPath: "/api/agents",
        testerPath: "/agents",
        auth: "sessao",
        permission: "agents.manage",
        bodyExample: JSON.stringify({ name: "Novo agente", email: "agente@empresa.com", password: "Senha@123", role: "agent" }, null, 2),
      },
      {
        key: "queues-list",
        method: "GET",
        module: "Filas",
        title: "Listar filas",
        summary: "Retorna as filas disponíveis e agentes vinculados.",
        publicPath: "/api/queues",
        testerPath: "/queues",
        auth: "sessao",
      },
      {
        key: "quick-replies-list",
        method: "GET",
        module: "Respostas rápidas",
        title: "Listar respostas rápidas",
        summary: "Entrega os atalhos cadastrados para o compositor.",
        publicPath: "/api/quick-replies",
        testerPath: "/quick-replies",
        auth: "sessao",
      },
    ],
  },
  {
    key: "scheduled",
    title: "Mensagens agendadas",
    description: "Cadastro, leitura e manutenção de envios programados.",
    endpoints: [
      {
        key: "scheduled-list",
        method: "GET",
        module: "Agendamentos",
        title: "Listar agendadas",
        summary: "Consulta a fila consolidada de mensagens agendadas.",
        publicPath: "/api/scheduled-messages",
        testerPath: "/scheduled-messages?status=pending,processing,failed,sent,canceled",
        auth: "sessao",
      },
      {
        key: "scheduled-ticket-list",
        method: "GET",
        module: "Agendamentos",
        title: "Agendadas por ticket",
        summary: "Lista as mensagens agendadas vinculadas a um ticket.",
        publicPath: "/api/tickets/:ticketId/scheduled-messages",
        testerPath: "/tickets/SEU_TICKET_ID/scheduled-messages",
        auth: "sessao",
      },
      {
        key: "scheduled-create",
        method: "POST",
        module: "Agendamentos",
        title: "Criar agendamento",
        summary: "Agenda um novo envio de mensagem para o ticket.",
        publicPath: "/api/tickets/:ticketId/scheduled-messages",
        testerPath: "/tickets/SEU_TICKET_ID/scheduled-messages",
        auth: "sessao",
        bodyExample: JSON.stringify({ body: "Mensagem agendada", sendAt: new Date().toISOString() }, null, 2),
      },
      {
        key: "scheduled-update",
        method: "PATCH",
        module: "Agendamentos",
        title: "Editar agendamento",
        summary: "Atualiza conteúdo e horário de uma mensagem agendada.",
        publicPath: "/api/scheduled-messages/:scheduledMessageId",
        testerPath: "/scheduled-messages/SUA_AGENDADA_ID",
        auth: "sessao",
        bodyExample: JSON.stringify({ body: "Texto atualizado" }, null, 2),
      },
      {
        key: "scheduled-delete",
        method: "DELETE",
        module: "Agendamentos",
        title: "Cancelar agendamento",
        summary: "Cancela uma mensagem agendada pelo identificador global.",
        publicPath: "/api/scheduled-messages/:scheduledMessageId",
        testerPath: "/scheduled-messages/SUA_AGENDADA_ID",
        auth: "sessao",
      },
    ],
  },
  {
    key: "whatsapp",
    title: "WhatsApp e Evolution",
    description: "Instâncias, webhook público e endpoints de integração com a Evolution.",
    endpoints: [
      {
        key: "health",
        method: "GET",
        module: "Infraestrutura",
        title: "Healthcheck",
        summary: "Verificação rápida do backend para monitoramento e deploy.",
        publicPath: "/api/health",
        testerPath: "/health",
        auth: "publica",
      },
      {
        key: "instances-list",
        method: "GET",
        module: "WhatsApp",
        title: "Listar instâncias",
        summary: "Retorna as conexões cadastradas com a Evolution.",
        publicPath: "/api/whatsapp/instances",
        testerPath: "/whatsapp/instances",
        auth: "sessao",
      },
      {
        key: "instances-create",
        method: "POST",
        module: "WhatsApp",
        title: "Criar instância",
        summary: "Cadastra uma nova instância Evolution no painel.",
        publicPath: "/api/whatsapp/instances",
        testerPath: "/whatsapp/instances",
        auth: "sessao",
        permission: "instances.manage",
        bodyExample: JSON.stringify({ name: "Instância teste", evolutionInstanceName: "chatflow-001", baseUrl: "https://apiflow.exemplo.com", apiKey: "SUA_CHAVE" }, null, 2),
      },
      {
        key: "webhook-evolution",
        method: "POST",
        module: "WhatsApp",
        title: "Webhook Evolution",
        summary: "Entrada pública para eventos enviados pela Evolution.",
        publicPath: "/api/webhooks/evolution",
        testerPath: "/webhooks/evolution",
        auth: "publica",
        notes: ["Use este endpoint no painel da Evolution. Para testes reais, envie um payload compatível com os eventos recebidos."],
      },
    ],
  },
];

const CHATFLOW_API_REFERENCE_MODULES: ApiModuleDoc[] = [
  {
    key: "external",
    title: "API Externa do ChatFlow",
    description: "A integração externa fala com o ChatFlow usando Bearer token. Evolution continua apenas como gateway interno de WhatsApp.",
    endpoints: [
      {
        key: "external-list-tickets",
        method: "GET",
        module: "Tickets externos",
        title: "Listar tickets",
        summary: "Busca tickets do ChatFlow pela API externa, com filtros por status, telefone, agente, fila, instância e texto.",
        publicPath: "/api/external/tickets",
        testerPath: "/external/tickets?status=open&limit=20",
        auth: "bearer",
        successExample: JSON.stringify(
          {
            items: [
              {
                id: "UUID_DO_TICKET",
                status: "open",
                customerName: "Contato da integração",
                externalContactId: "5511999999999",
                currentAgent: { id: "UUID_DO_AGENTE", name: "Bot" },
                currentQueue: { id: "UUID_DA_FILA", name: "Financeiro", color: "#22c55e" },
                whatsappInstance: { id: "UUID_DA_INSTANCIA", name: "Instância principal" },
              },
            ],
          },
          null,
          2,
        ),
        notes: [
          "Aceita filtros: status, phone, search, queueId, agentId, whatsappInstanceId e limit.",
          "queueId, agentId e whatsappInstanceId aceitam publicId numérico ou UUID.",
        ],
      },
      {
        key: "external-list-customers",
        method: "GET",
        module: "Contatos externos",
        title: "Listar contatos",
        summary: "Busca contatos do ChatFlow por telefone ou texto livre, retornando os dados principais do cadastro.",
        publicPath: "/api/external/customers",
        testerPath: "/external/customers?search=Felipe&limit=20",
        auth: "bearer",
        successExample: JSON.stringify(
          {
            items: [
              {
                id: "UUID_DO_CONTATO",
                name: "Felipe Sannino",
                phone: "5511945744352",
                email: "felipe@empresa.com.br",
                companyName: "SERMST",
              },
            ],
          },
          null,
          2,
        ),
        notes: [
          "Aceita filtros: search, phone e limit.",
        ],
      },
      {
        key: "external-list-users",
        method: "GET",
        module: "Usuários externos",
        title: "Listar usuários",
        summary: "Retorna os agentes/usuários do sistema para uso em integrações, inclusive bots quando existirem.",
        publicPath: "/api/external/users",
        testerPath: "/external/users?search=Felipe&limit=20",
        auth: "bearer",
        successExample: JSON.stringify(
          {
            items: [
              {
                id: "UUID_DO_AGENTE",
                publicId: 14,
                name: "Felipe Sannino",
                presence: "online",
                isBotAgent: false,
                user: {
                  id: "UUID_DO_USUARIO",
                  email: "felipe@sermst.com.br",
                  role: "admin",
                },
              },
            ],
          },
          null,
          2,
        ),
        notes: [
          "Aceita filtros: search e limit.",
          "Use publicId ou UUID ao montar chamadas que precisem apontar para um agente específico.",
        ],
      },
      {
        key: "external-list-queues",
        method: "GET",
        module: "Filas externas",
        title: "Listar filas",
        summary: "Retorna as filas disponíveis no ChatFlow para integrações, incluindo indicação de fila bot quando aplicável.",
        publicPath: "/api/external/queues",
        testerPath: "/external/queues?search=Financeiro&limit=20",
        auth: "bearer",
        successExample: JSON.stringify(
          {
            items: [
              {
                id: "UUID_DA_FILA",
                publicId: 7,
                name: "Financeiro",
                color: "#22c55e",
                isActive: true,
                isBotQueue: false,
              },
            ],
          },
          null,
          2,
        ),
        notes: [
          "Aceita filtros: search e limit.",
          "Use publicId ou UUID para referenciar a fila em mensagens e transferências.",
        ],
      },
      {
        key: "external-send-message",
        method: "POST",
        module: "Mensagens externas",
        title: "Enviar mensagem operacional",
        summary: "Envia mensagem por telefone. Quando já existir ticket open ou pending na mesma instância, a API reaproveita o ticket atual em vez de criar outro.",
        publicPath: "/api/external/messages/send",
        testerPath: "/external/messages/send",
        auth: "bearer",
        bodyExample: JSON.stringify(
          {
            phone: "5511999999999",
            body: "Mensagem enviada pela API do ChatFlow",
            whatsappInstanceId: 12,
            queueId: 7,
            agentId: 14,
            customerName: "Contato da integração",
          },
          null,
          2,
        ),
        successExample: JSON.stringify(
          {
            created: true,
            ticket: {
              id: "UUID_DO_TICKET",
              status: "open",
              customerName: "Contato da integração",
            },
            message: {
              id: "UUID_DA_MENSAGEM",
              body: "Mensagem enviada pela API do ChatFlow",
            },
          },
          null,
          2,
          ),
          notes: [
            "Use Authorization: Bearer SEU_TOKEN.",
            "Fila, agente e instância são definidos na própria chamada.",
            "Se já existir ticket aberto ou pendente, a API reutiliza o ticket atual.",
          ],
        },
      {
        key: "external-send-ticket-message",
        method: "POST",
        module: "Mensagens externas",
        title: "Enviar mensagem para ticket",
        summary: "Envia uma mensagem diretamente para um ticket específico já existente, sem depender de busca por telefone.",
        publicPath: "/api/external/tickets/:ticketId/messages",
        testerPath: "/external/tickets/UUID_DO_TICKET/messages",
        auth: "bearer",
        bodyExample: JSON.stringify(
          {
            body: "Mensagem enviada para um ticket específico",
            replyToMessageId: null,
            internalNote: false,
          },
          null,
          2,
        ),
        successExample: JSON.stringify(
          {
            item: {
              id: "UUID_DA_MENSAGEM",
              ticketId: "UUID_DO_TICKET",
              body: "Mensagem enviada para um ticket específico",
              createdAt: new Date().toISOString(),
              externalMessageId: "wamid.HBgLN...",
            },
          },
          null,
          2,
        ),
        notes: [
          "ticketId na rota deve ser o UUID interno do ticket.",
          "Se o token tiver um usuário vinculado, ele será usado como remetente; caso contrário, a API tenta usar o agente atual do ticket.",
          "Use internalNote=true para registrar observação interna em vez de mensagem operacional.",
        ],
      },
      {
        key: "external-list-ticket-messages",
        method: "GET",
        module: "Mensagens externas",
        title: "Listar mensagens do ticket",
        summary: "Retorna as mensagens de um ticket específico, incluindo anexos, resposta citada, reações e remetente.",
        publicPath: "/api/external/tickets/:ticketId/messages",
        testerPath: "/external/tickets/UUID_DO_TICKET/messages?limit=200",
        auth: "bearer",
        successExample: JSON.stringify(
          {
            items: [
              {
                id: "UUID_DA_MENSAGEM",
                ticketId: "UUID_DO_TICKET",
                direction: "inbound",
                contentType: "image",
                body: "Segue o comprovante.",
                senderName: "Felipe",
                externalMessageId: "3A5FAD64B1DA1057D1B3",
                internalNote: false,
                createdAt: new Date().toISOString(),
                reactions: [],
                deleted: {
                  isDeleted: false,
                  deletedAt: null,
                  deletedByAgentId: null,
                },
                senderAgent: null,
                replyToMessage: null,
                attachments: [
                  {
                    id: "UUID_DO_ANEXO",
                    fileName: "comprovante.jpg",
                    mimeType: "image/jpeg",
                    sizeBytes: 183245,
                    publicUrl: "https://chatflow.sermst.app.br/storage/comprovante.jpg",
                    storageKey: "tickets/UUID_DO_TICKET/comprovante.jpg",
                  },
                ],
              },
            ],
          },
          null,
          2,
        ),
        notes: [
          "ticketId na rota deve ser o UUID interno do ticket.",
          "Aceita o filtro limit, com padrao 200 e maximo 500.",
          "O retorno inclui mensagens inbound, outbound, observacoes internas e anexos relacionados ao ticket.",
        ],
      },
      {
        key: "external-transfer-ticket",
        method: "POST",
        module: "Tickets externos",
        title: "Transferir ticket",
        summary: "Transfere um ticket existente para agente, fila ou ambos, com observação interna opcional.",
        publicPath: "/api/external/tickets/:ticketId/transfer",
        testerPath: "/external/tickets/UUID_DO_TICKET/transfer",
        auth: "bearer",
        bodyExample: JSON.stringify(
          {
            queueId: 7,
            agentId: 14,
            note: "Transferido via integração externa",
          },
          null,
          2,
        ),
        successExample: JSON.stringify(
          {
            item: {
              id: "UUID_DO_TICKET",
              status: "open",
              customerName: "Contato da integração",
              currentAgent: { id: "UUID_DO_AGENTE", name: "Felipe Sannino" },
              currentQueue: { id: "UUID_DA_FILA", name: "Financeiro", color: "#22c55e" },
            },
          },
          null,
          2,
        ),
        notes: [
          "Informe queueId, agentId ou ambos.",
          "queueId e agentId aceitam publicId numérico ou UUID.",
          "ticketId na rota deve ser o UUID interno do ticket.",
        ],
      },
    ],
  },
  {
    key: "tokens",
    title: "Tokens de integração",
    description: "Gestão dos tokens usados pelas integrações externas.",
    endpoints: [
      {
        key: "api-access-list",
        method: "GET",
        module: "Tokens",
        title: "Listar tokens",
        summary: "Lista os tokens de API já criados. O valor bruto do token não é exibido novamente.",
        publicPath: "/api/api-access/tokens",
        testerPath: "/api-access/tokens",
        auth: "session",
        permission: "api.manage",
      },
      {
        key: "api-access-create",
        method: "POST",
        module: "Tokens",
        title: "Criar token",
        summary: "Cria um novo token e devolve o valor bruto apenas uma única vez.",
        publicPath: "/api/api-access/tokens",
        testerPath: "/api-access/tokens",
        auth: "session",
        permission: "api.manage",
        bodyExample: JSON.stringify({ name: "ERP Financeiro" }, null, 2),
        notes: ["Guarde o token retornado no momento da criação. Depois disso só o prefixo permanece visível."],
      },
      {
        key: "api-access-delete",
        method: "DELETE",
        module: "Tokens",
        title: "Revogar token",
        summary: "Remove um token existente e invalida futuras chamadas externas com ele.",
        publicPath: "/api/api-access/tokens/:tokenId",
        testerPath: "/api-access/tokens/SEU_TOKEN_ID",
        auth: "session",
        permission: "api.manage",
      },
    ],
  },
];

const API_REFERENCE_ENDPOINTS = CHATFLOW_API_REFERENCE_MODULES.flatMap((module) => module.endpoints);

function apiMethodTone(method: ApiDocMethod): "default" | "success" | "warning" | "danger" {
  if (method === "GET") return "success";
  if (method === "DELETE") return "danger";
  if (method === "PATCH") return "warning";
  return "default";
}

function normalizeApiTesterPath(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/api/")) return trimmed.slice(4);
  if (trimmed.startsWith("/")) return trimmed;
  return `/${trimmed}`;
}

function getTicketNudgeSeenStorageKey(userId: string) {
  return `${TICKET_NUDGE_SEEN_STORAGE_KEY_PREFIX}.${userId}`;
}

function readSeenTicketNudges(userId: string) {
  if (typeof window === "undefined") {
    return {} as Record<string, string>;
  }

  try {
    const raw = window.localStorage.getItem(getTicketNudgeSeenStorageKey(userId));
    if (!raw) {
      return {} as Record<string, string>;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {} as Record<string, string>;
    }

    return Object.entries(parsed).reduce<Record<string, string>>((accumulator, [ticketId, createdAt]) => {
      if (typeof createdAt === "string" && createdAt.trim()) {
        accumulator[ticketId] = createdAt;
      }
      return accumulator;
    }, {});
  } catch {
    return {} as Record<string, string>;
  }
}

function persistSeenTicketNudges(userId: string, value: Record<string, string>) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getTicketNudgeSeenStorageKey(userId), JSON.stringify(value));
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const normalized = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = typeof window !== "undefined" ? window.atob(normalized) : "";
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function applicationServerKeysMatch(
  expectedKey: Uint8Array,
  currentKey: ArrayBuffer | null | undefined,
) {
  if (!currentKey) return false;

  const currentKeyBytes = new Uint8Array(currentKey);
  if (currentKeyBytes.length !== expectedKey.length) return false;

  for (let index = 0; index < expectedKey.length; index += 1) {
    if (currentKeyBytes[index] !== expectedKey[index]) {
      return false;
    }
  }

  return true;
}

function serializePushSubscription(subscription: PushSubscription) {
  const json = subscription.toJSON();
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
    },
  };
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {});

  if (init?.body !== undefined && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers,
    cache: "no-store",
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const rawBody = await response.text();
  const payload = rawBody
    ? (() => {
        try {
          return JSON.parse(rawBody);
        } catch {
          return { message: rawBody };
        }
      })()
    : {};

  if (!response.ok) {
    throw new Error(normalizeNotificationMessage(payload?.message ?? "Falha na requisição."));
  }

  return payload as T;
}

function normalizeNotificationMessage(input: string | null | undefined) {
  const message = (input ?? "").trim();

  if (!message) {
    return "Não foi possível concluir a solicitação.";
  }

  const normalized = message.toLowerCase();

  if (normalized === "request body is too large" || /body.+too large/.test(normalized)) {
    return "O arquivo ou conteúdo enviado é grande demais para ser processado.";
  }

  if (normalized === "failed to fetch") {
    return "Não foi possível se comunicar com o servidor.";
  }

  if (normalized === "unauthorized") {
    return "Acesso não autorizado.";
  }

  if (normalized === "forbidden") {
    return "Você não possui permissão para executar esta ação.";
  }

  if (normalized === "not found") {
    return "Recurso não encontrado.";
  }

  if (normalized === "bad request") {
    return "A solicitação enviada é inválida.";
  }

  if (normalized === "internal server error") {
    return "Ocorreu um erro interno ao processar a solicitação.";
  }

  if (normalized === "unsupported media type") {
    return "Tipo de conteúdo não suportado para esta operação.";
  }

  if (normalized === "payload too large") {
    return "O arquivo ou conteúdo enviado é grande demais para ser processado.";
  }

  return message;
}

function formatDateTime(value: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatHour(value: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatScheduledMessagePreview(item: Pick<ScheduledMessageItem, "body" | "attachment">) {
  return item.body?.trim() || (item.attachment ? `[${item.attachment.kind}] ${item.attachment.fileName}` : "Mensagem agendada");
}

function toDateTimeLocalValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDurationMetric(minutes: number | null | undefined) {
  if (minutes == null || Number.isNaN(minutes)) return "Sem base";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
}

function translateAutomationTrigger(triggerType: AutomationItem["triggerType"]) {
  if (triggerType === "message_received") return "Nova mensagem recebida";
  if (triggerType === "ticket_created") return "Ticket criado";
  if (triggerType === "ticket_inactive") return "Ticket sem resposta";
  if (triggerType === "scheduled_time") return "Horário agendado";
  return triggerType;
}

function translateAutomationStatus(status: AutomationItem["status"]) {
  if (status === "active") return "Ativa";
  if (status === "inactive") return "Inativa";
  return "Rascunho";
}

function translateAutomationExecutionStatus(status: AutomationExecutionItem["status"]) {
  if (status === "success") return "Executada";
  if (status === "failed") return "Falhou";
  return "Ignorada";
}

function translateAutomationAction(type: AutomationAction["type"]) {
  if (type === "send_message") return "Enviar mensagem";
  if (type === "transfer_queue") return "Transferir para fila";
  if (type === "assign_agent") return "Atribuir agente";
  if (type === "close_ticket") return "Encerrar ticket";
  if (type === "nudge_ticket") return "Chamar atenção do responsável";
  if (type === "webhook") return "Chamar webhook";
  return type;
}

function formatAutomationCondition(condition: AutomationCondition) {
  if (condition.field === "message.keyword") {
    return `Mensagem contém "${condition.valueLabel ?? condition.value ?? ""}"`;
  }

  if (condition.field === "ticket.assignment") {
    if (condition.value === "unassigned") return "Ticket sem agente";
    if (condition.value === "assigned") return "Ticket com agente";
  }

  if (condition.field === "ticket.inactivityMinutes") {
    return `Sem resposta por ${condition.valueLabel ?? condition.value ?? ""} min`;
  }

  if (condition.field === "ticket.responsePendingFrom") {
    return condition.value === "agent" ? "Aguardando resposta do agente" : "Aguardando resposta do cliente";
  }

  return condition.valueLabel ?? String(condition.value ?? condition.field);
}

function formatAutomationActionSummary(action: AutomationAction) {
  if (action.summary?.trim()) {
    return action.summary.trim();
  }

  if (action.type === "send_message") {
    const message = typeof action.config?.message === "string" ? action.config.message : "";
    return message ? `Enviar: ${message}` : "Enviar mensagem automática";
  }

  if (action.type === "transfer_queue") {
    return action.config?.queueName ? `Transferir para ${action.config.queueName}` : "Transferir para fila";
  }

  if (action.type === "assign_agent") {
    return action.config?.agentName ? `Atribuir ${action.config.agentName}` : "Atribuir agente";
  }

  if (action.type === "close_ticket") {
    return action.config?.reason ? `Encerrar: ${action.config.reason}` : "Encerrar ticket";
  }

  if (action.type === "nudge_ticket") {
    return "Chamar atenção do responsável";
  }

  if (action.type === "webhook") {
    return action.config?.url ? `Webhook: ${action.config.url}` : "Chamar webhook";
  }

  return translateAutomationAction(action.type);
}

function formatShortDateLabel(value: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }).format(new Date(`${value}T00:00:00`));
  } catch {
    return value;
  }
}

function onlyPhoneDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 13);
}

function formatPhoneInput(value: string) {
  const digits = onlyPhoneDigits(value);

  if (!digits) return "";
  if (digits.length <= 2) return `+${digits}`;
  if (digits.length <= 4) return `+${digits.slice(0, 2)} (${digits.slice(2)}`;
  if (digits.length <= 9) return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4)}`;
  return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
}

function isReliablePhoneValue(value: string | null | undefined) {
  if (!value) return false;

  const digits = value.replace(/\D/g, "");
  if (!digits) return false;
  if (digits.length < 8 || digits.length > 15) return false;
  if (digits.startsWith("0")) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  return true;
}

function formatContactIdentity(value: string | null | undefined) {
  if (!value) return "Identificador indisponível";
  return isReliablePhoneValue(value) ? formatPhoneInput(value) : value;
}

function stripAgentSignature(body: string | null | undefined, agentName: string | null | undefined) {
  const rawBody = body ?? "";
  const normalizedAgentName = (agentName ?? "").trim();

  if (!normalizedAgentName) {
    return rawBody;
  }

  const signaturePrefix = `*${normalizedAgentName}*`;

  if (!rawBody.startsWith(signaturePrefix)) {
    return rawBody;
  }

  const withoutPrefix = rawBody.slice(signaturePrefix.length);
  return withoutPrefix.replace(/^\n\s*\n?/, "");
}

function parseMessageSignature(body: string | null | undefined) {
  const rawBody = body ?? "";
  const signatureMatch = rawBody.match(/^\*([^*\n]+)\*(?:\n\s*\n?|\s+)?([\s\S]*)$/);

  if (!signatureMatch) {
    return {
      signature: null as string | null,
      body: rawBody,
    };
  }

  return {
    signature: signatureMatch[1].trim() || null,
    body: signatureMatch[2].replace(/^\s+/, ""),
  };
}

function formatMessagePreview(body: string | null | undefined) {
  const parsed = parseMessageSignature(body);
  const normalizedBody = parsed.body.replace(/\s+/g, " ").trim();

  if (parsed.signature && normalizedBody) {
    return `${parsed.signature} ${normalizedBody}`;
  }

  if (parsed.signature) {
    return parsed.signature;
  }

  return (body ?? "").replace(/\s+/g, " ").trim();
}

function summarizeQuotedMessage(message: Pick<ReplyMessageItem, "body" | "contentType" | "attachments" | "senderName"> | null | undefined) {
  if (!message) {
    return "";
  }

  const cleanedBody = stripAgentSignature(message.body, message.senderName).trim();
  if (cleanedBody) {
    return cleanedBody;
  }

  const attachment = message.attachments?.[0];
  if (attachment?.mimeType?.startsWith("image/")) return "Imagem";
  if (attachment?.mimeType?.startsWith("audio/")) return "Áudio";
  if (attachment?.mimeType?.startsWith("video/")) return "Vídeo";
  if (attachment?.fileName) return attachment.fileName;
  if (message.contentType === "image") return "Imagem";
  if (message.contentType === "audio") return "Áudio";
  if (message.contentType === "video") return "Vídeo";
  if (message.contentType === "document") return "Documento";
  if (message.contentType === "contact") {
    const [contactName] = (message.body ?? "").split(/\r?\n/);
    return contactName?.trim() || "Contato";
  }
  return "Mensagem";
}

function parseSharedContactMessage(body: string | null | undefined) {
  const lines = (body ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      name: "Contato compartilhado",
      phone: null as string | null,
    };
  }

  return {
    name: lines[0] || "Contato compartilhado",
    phone: lines[1] || null,
  };
}

function resolveAttachmentUrl(ticketId: string, attachment: AttachmentItem) {
  if (attachment.publicUrl?.startsWith("data:")) {
    return attachment.publicUrl;
  }

  return `${API_URL}/tickets/${ticketId}/attachments/${attachment.id}/content`;
}

function initials(name: string) {
  const normalizedWords = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/[\p{L}\p{N}]+/gu) ?? [];

  const value = normalizedWords
    .slice(0, 2)
    .map((part) => Array.from(part)[0]?.toUpperCase() ?? "")
    .join("");

  return value || "C";
}

function SafeAvatar({
  src,
  name,
  alt,
  className,
  textClassName,
}: {
  src?: string | null;
  name: string;
  alt: string;
  className: string;
  textClassName?: string;
}) {
  const [imageFailed, setImageFailed] = React.useState(false);

  React.useEffect(() => {
    setImageFailed(false);
  }, [src]);

  const showImage = Boolean(src) && !imageFailed;

  return (
    <div className={className}>
      {showImage ? (
        <img
          src={src ?? undefined}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className={textClassName}>{initials(name)}</span>
      )}
    </div>
  );
}

function traduzirStatusTicket(status: "open" | "pending" | "closed") {
  if (status === "open") return "Atendendo";
  if (status === "pending") return "Aguardando";
  return "Fechado";
}

function traduzirPerfil(role: "admin" | "agent") {
  return role === "admin" ? "Administrador" : "Agente";
}

function traduzirStatusInstancia(status: string) {
  if (status === "connected") return "Conectada";
  if (status === "disconnected") return "Desconectada";
  if (status === "pairing") return "Em pareamento";
  if (status === "error") return "Com erro";
  return status;
}

export default function HomePage() {
  const [mode, setMode] = React.useState<"login" | "bootstrap">("login");
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loadingAuth, setLoadingAuth] = React.useState(true);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [panelMessage, setPanelMessage] = React.useState<string | null>(null);

  const [tickets, setTickets] = React.useState<TicketItem[]>([]);
  const [selectedTicketId, setSelectedTicketId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<MessageItem[]>([]);
  const [instances, setInstances] = React.useState<InstanceItem[]>([]);
  const [agents, setAgents] = React.useState<AgentItem[]>([]);
  const [queues, setQueues] = React.useState<QueueItem[]>([]);
  const [customers, setCustomers] = React.useState<CustomerItem[]>([]);
  const [quickReplies, setQuickReplies] = React.useState<QuickReplyItem[]>([]);
  const [automations, setAutomations] = React.useState<AutomationItem[]>([]);
  const [automationExecutions, setAutomationExecutions] = React.useState<AutomationExecutionItem[]>([]);
  const [dashboardOverview, setDashboardOverview] = React.useState<DashboardOverview | null>(null);
  const [dashboardRange, setDashboardRange] = React.useState<DashboardRangeKey>("7d");
  const [dashboardAgentId, setDashboardAgentId] = React.useState<string>("all");

  const [ticketLoading, setTicketLoading] = React.useState(false);
  const [messageLoading, setMessageLoading] = React.useState(false);
  const [sendLoading, setSendLoading] = React.useState(false);
  const [instanceLoading, setInstanceLoading] = React.useState(false);
  const [agentLoading, setAgentLoading] = React.useState(false);
  const [queueLoading, setQueueLoading] = React.useState(false);
  const [quickReplyLoading, setQuickReplyLoading] = React.useState(false);
  const [automationLoading, setAutomationLoading] = React.useState(false);
  const [automationExecutionLoading, setAutomationExecutionLoading] = React.useState(false);
  const [customerLoading, setCustomerLoading] = React.useState(false);
  const [conversationLoading, setConversationLoading] = React.useState(false);
  const [sharedContactLoadingKey, setSharedContactLoadingKey] = React.useState<string | null>(null);
  const [dashboardLoading, setDashboardLoading] = React.useState(false);
  const [selectedApiEndpointKey, setSelectedApiEndpointKey] = React.useState<string>(API_REFERENCE_ENDPOINTS[0]?.key ?? "");
  const [apiTesterMethod, setApiTesterMethod] = React.useState<ApiDocMethod>(API_REFERENCE_ENDPOINTS[0]?.method ?? "GET");
  const [apiTesterPath, setApiTesterPath] = React.useState<string>(API_REFERENCE_ENDPOINTS[0]?.testerPath ?? "/health");
  const [apiTesterBody, setApiTesterBody] = React.useState<string>(API_REFERENCE_ENDPOINTS[0]?.bodyExample ?? "");
  const [apiTesterLoading, setApiTesterLoading] = React.useState(false);
  const [apiTesterResult, setApiTesterResult] = React.useState<ApiTesterResult | null>(null);
  const [apiTesterError, setApiTesterError] = React.useState<string | null>(null);
  const [apiTokens, setApiTokens] = React.useState<ApiAccessTokenItem[]>([]);
  const [apiTokensLoading, setApiTokensLoading] = React.useState(false);
  const [apiTokenNameInput, setApiTokenNameInput] = React.useState("");
  const [apiNewTokenValue, setApiNewTokenValue] = React.useState<string | null>(null);
  const [apiSelectedAuthMode, setApiSelectedAuthMode] = React.useState<ApiTesterAuthMode>(
    API_REFERENCE_ENDPOINTS[0]?.auth === "bearer" ? "bearer" : "session",
  );
  const [apiBearerToken, setApiBearerToken] = React.useState("");
  const [groupNameSaving, setGroupNameSaving] = React.useState(false);
  const [assignmentLoading, setAssignmentLoading] = React.useState<string | null>(null);
  const [nudgeLoading, setNudgeLoading] = React.useState(false);
  const [editingInstanceId, setEditingInstanceId] = React.useState<string | null>(null);
  const [editingAgentId, setEditingAgentId] = React.useState<string | null>(null);
  const [duplicatingAgentName, setDuplicatingAgentName] = React.useState<string | null>(null);
  const [editingQueueId, setEditingQueueId] = React.useState<string | null>(null);
  const [editingQuickReplyId, setEditingQuickReplyId] = React.useState<string | null>(null);
  const [editingAutomationId, setEditingAutomationId] = React.useState<string | null>(null);
  const [editingCustomerId, setEditingCustomerId] = React.useState<string | null>(null);
  const [managementModal, setManagementModal] = React.useState<null | "instance" | "agent" | "queue" | "conversation" | "quickReply" | "customer" | "automation">(null);
  const [managementModalTab, setManagementModalTab] = React.useState<"general" | "permissions" | "access">("general");
  const [automationView, setAutomationView] = React.useState<"rules" | "executions">("rules");

  const [messageInput, setMessageInput] = React.useState("");
  const [messageCursorPosition, setMessageCursorPosition] = React.useState<number | null>(null);
  const [editingMessageId, setEditingMessageId] = React.useState<string | null>(null);
  const [replyToMessageId, setReplyToMessageId] = React.useState<string | null>(null);
  const [composerInternalNoteMode, setComposerInternalNoteMode] = React.useState(false);
  const [groupNameInput, setGroupNameInput] = React.useState("");
  const [moduleSearchQueries, setModuleSearchQueries] = React.useState<Record<SearchScopeKey, string>>({
    tickets: "",
    channels: "",
    quickReplies: "",
    apiReference: "",
    teamAgents: "",
    teamQueues: "",
    contacts: "",
    calendar: "",
    automationsRules: "",
    automationsExecutions: "",
    settingsInstances: "",
    settingsAgents: "",
    settingsQueues: "",
  });
  const [activeTab, setActiveTab] = React.useState<"atendendo" | "aguardando" | "grupos">("atendendo");
  const [activeWorkspace, setActiveWorkspace] = React.useState<"dashboard" | "tickets" | "closedTickets" | "channels" | "quickReplies" | "team" | "api" | "contacts" | "profile" | "calendar" | "automations" | "settings">("tickets");
  const [adminSection, setAdminSection] = React.useState<"branding" | "instances" | "agents" | "queues">("instances");
  const [showRail, setShowRail] = React.useState(false);
  const [mobileNavigationOpen, setMobileNavigationOpen] = React.useState(false);
  const [isMobileViewport, setIsMobileViewport] = React.useState(false);
  const [mobileTicketView, setMobileTicketView] = React.useState<"list" | "conversation">("list");
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [browserNotificationPermission, setBrowserNotificationPermission] = React.useState<NotificationPermission>(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default",
  );
  const [browserPushEnabled, setBrowserPushEnabled] = React.useState(false);
  const [showOnlyUnread, setShowOnlyUnread] = React.useState(false);
  const [showAllTickets, setShowAllTickets] = React.useState(false);
  const [showArchivedTickets, setShowArchivedTickets] = React.useState(false);
  const [selectedQueueFilter, setSelectedQueueFilter] = React.useState<string>("all");
  const [showTicketDetails, setShowTicketDetails] = React.useState(false);
  const [ticketHistoryViewer, setTicketHistoryViewer] = React.useState<null | {
    ticketId: string;
    customerName: string;
    loading: boolean;
    items: TicketHistoryItem[];
  }>(null);
  const [showTransferPanel, setShowTransferPanel] = React.useState(false);
  const [mobileTicketActionsOpen, setMobileTicketActionsOpen] = React.useState(false);
  const [showGroupNameModal, setShowGroupNameModal] = React.useState(false);
  const [showScheduleModal, setShowScheduleModal] = React.useState(false);
  const [showForwardModal, setShowForwardModal] = React.useState(false);
  const [appDialog, setAppDialog] = React.useState<AppDialogState | null>(null);
  const [profileName, setProfileName] = React.useState("");
  const [profileAvatarPreview, setProfileAvatarPreview] = React.useState<string | null>(null);
  const [brandLogoPreview, setBrandLogoPreview] = React.useState<string | null>(null);
  const [brandMode, setBrandMode] = React.useState<"default" | "image" | "text">("default");
  const [brandText, setBrandText] = React.useState("CHATFLOW");
  const [composerAttachments, setComposerAttachments] = React.useState<ComposerAttachment[]>([]);
  const [scheduledMessages, setScheduledMessages] = React.useState<ScheduledMessageItem[]>([]);
  const [scheduledMessageOverview, setScheduledMessageOverview] = React.useState<ScheduledMessageItem[]>([]);
  const [scheduleLoading, setScheduleLoading] = React.useState(false);
  const [scheduledMessageOverviewLoading, setScheduledMessageOverviewLoading] = React.useState(false);
  const [scheduledMessageStatusFilter, setScheduledMessageStatusFilter] = React.useState<"pending" | "processing" | "failed" | "sent" | "canceled" | "all">("pending");
  const [scheduledMessageViewer, setScheduledMessageViewer] = React.useState<ScheduledMessageItem | null>(null);
  const [scheduledMessageEditor, setScheduledMessageEditor] = React.useState<null | {
    id: string;
    ticketId: string;
    title: string;
    body: string;
    sendAt: string;
    attachmentLabel: string | null;
  }>(null);
  const [scheduledMessageDeleteTarget, setScheduledMessageDeleteTarget] = React.useState<ScheduledMessageItem | null>(null);
  const [forwardLoading, setForwardLoading] = React.useState(false);
  const [customerTicketsViewer, setCustomerTicketsViewer] = React.useState<CustomerTicketsViewerState | null>(null);
  const currentSearchScope = React.useMemo<SearchScopeKey>(() => {
    if (activeWorkspace === "tickets" || activeWorkspace === "closedTickets") {
      return "tickets";
    }

    if (activeWorkspace === "channels") {
      return "channels";
    }

    if (activeWorkspace === "quickReplies") {
      return "quickReplies";
    }

    if (activeWorkspace === "api") {
      return "apiReference";
    }

    if (activeWorkspace === "team") {
      return adminSection === "agents" ? "teamAgents" : "teamQueues";
    }

    if (activeWorkspace === "contacts") {
      return "contacts";
    }

    if (activeWorkspace === "calendar") {
      return "calendar";
    }

    if (activeWorkspace === "automations") {
      return automationView === "rules" ? "automationsRules" : "automationsExecutions";
    }

    if (activeWorkspace === "settings") {
      if (adminSection === "agents") return "settingsAgents";
      if (adminSection === "queues") return "settingsQueues";
      return "settingsInstances";
    }

    return "tickets";
  }, [activeWorkspace, adminSection, automationView]);
  const searchQuery = moduleSearchQueries[currentSearchScope] ?? "";
  const setSearchQuery = React.useCallback((value: string) => {
    setModuleSearchQueries((current) => (
      current[currentSearchScope] === value
        ? current
        : { ...current, [currentSearchScope]: value }
    ));
  }, [currentSearchScope]);
  const [forwardMessageId, setForwardMessageId] = React.useState<string | null>(null);
  const [forwardSearch, setForwardSearch] = React.useState("");
  const [selectedForwardDestinationKeys, setSelectedForwardDestinationKeys] = React.useState<string[]>([]);
  const [scheduleForm, setScheduleForm] = React.useState({
    sendAt: toDateTimeLocalValue(new Date(Date.now() + 60 * 60 * 1000)),
  });
  const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
  const [recordingAudio, setRecordingAudio] = React.useState(false);
  const [composerDragActive, setComposerDragActive] = React.useState(false);
  const [openMessageMenuId, setOpenMessageMenuId] = React.useState<string | null>(null);
  const [messageMenuPosition, setMessageMenuPosition] = React.useState<MessageMenuPosition | null>(null);
  const [publicUrls, setPublicUrls] = React.useState(resolvePublicUrls);
  const [profileSaving, setProfileSaving] = React.useState(false);
  const [transferLoading, setTransferLoading] = React.useState(false);
  const [ticketBulkSelectionMode, setTicketBulkSelectionMode] = React.useState(false);
  const [selectedTicketIdsForBulkDelete, setSelectedTicketIdsForBulkDelete] = React.useState<string[]>([]);
  const [messageBulkSelectionMode, setMessageBulkSelectionMode] = React.useState(false);
  const [selectedMessageIdsForBulkDelete, setSelectedMessageIdsForBulkDelete] = React.useState<string[]>([]);
  const [bulkDeleteLoading, setBulkDeleteLoading] = React.useState(false);

  const [loginForm, setLoginForm] = React.useState({ email: "", password: "" });
  const [bootstrapForm, setBootstrapForm] = React.useState({ name: "", email: "", password: "" });
  const [showLoginPassword, setShowLoginPassword] = React.useState(false);
  const [showBootstrapPassword, setShowBootstrapPassword] = React.useState(false);
  const [instanceForm, setInstanceForm] = React.useState({
    name: "",
    evolutionInstanceName: "",
    baseUrl: "",
    apiKey: "",
    webhookSecret: "",
    defaultQueueId: "",
  });
  const [agentForm, setAgentForm] = React.useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "agent" as "admin" | "agent",
    queueIds: [] as string[],
    permissions: defaultPermissionsForRole("agent"),
    isBotAgent: false,
    blocked: false,
    accessScheduleEnabled: false,
    accessStartTime: "08:00",
    accessEndTime: "18:00",
  });
  const [queueForm, setQueueForm] = React.useState({ name: "", color: "#1A1C32", isBotQueue: false });
  const [quickReplyForm, setQuickReplyForm] = React.useState({ shortcut: "", content: "", isActive: true });
  const [quickReplyCursorPosition, setQuickReplyCursorPosition] = React.useState<number | null>(null);
  const [automationForm, setAutomationForm] = React.useState({
    name: "",
    description: "",
    status: "draft" as "draft" | "active" | "inactive",
    triggerType: "message_received" as "message_received" | "ticket_created" | "ticket_inactive" | "scheduled_time",
    queueId: "",
    whatsappInstanceId: "",
    inactivityMinutes: "30",
    responsePendingFrom: "customer" as "customer" | "agent",
    keyword: "",
    assignmentScope: "any" as "any" | "unassigned" | "assigned",
    scheduleTime: "09:00",
    scheduleDaysOfWeek: [1, 2, 3, 4, 5] as number[],
    actionType: "send_message" as "send_message" | "transfer_queue" | "assign_agent" | "close_ticket" | "nudge_ticket" | "webhook",
    actionMessage: "",
    actionQueueId: "",
    actionAgentId: "",
    actionWebhookUrl: "",
    actionCloseReason: "",
  });
  const [automationMessageCursorPosition, setAutomationMessageCursorPosition] = React.useState<number | null>(null);
  const [conversationForm, setConversationForm] = React.useState({
    phone: "",
    whatsappInstanceId: "",
    queueId: "",
    customerSearch: "",
  });
  const [transferForm, setTransferForm] = React.useState({
    agentId: "",
    queueId: "",
    note: "",
  });
  const normalizedConversationPhone = onlyPhoneDigits(conversationForm.phone);
  const selectedTransferAgent = React.useMemo(
    () => agents.find((agent) => agent.id === transferForm.agentId) ?? null,
    [agents, transferForm.agentId],
  );
  const transferQueues = React.useMemo(() => {
    const visibleQueues = queues.filter((queue) => !queue.isBotQueue);
    if (!selectedTransferAgent) {
      return visibleQueues;
    }

    const agentQueueIds = new Set(selectedTransferAgent.queues.map((queue) => queue.id));
    return visibleQueues.filter((queue) => agentQueueIds.has(queue.id));
  }, [queues, selectedTransferAgent]);
  const matchingConversationCustomer = React.useMemo(
    () => customers.find((customer) => customer.phone && onlyPhoneDigits(customer.phone) === normalizedConversationPhone) ?? null,
    [customers, normalizedConversationPhone],
  );
  const existingOpenConversationTicket = React.useMemo(
    () =>
      tickets.find((ticket) => {
        if (ticket.status === "closed") return false;
        if (conversationForm.whatsappInstanceId && ticket.whatsappInstance.id !== conversationForm.whatsappInstanceId) return false;
        const ticketDigits = onlyPhoneDigits(ticket.externalContactId ?? ticket.externalChatId);
        return Boolean(normalizedConversationPhone && ticketDigits === normalizedConversationPhone);
      }) ?? null,
    [conversationForm.whatsappInstanceId, normalizedConversationPhone, tickets],
  );
  const filteredConversationCustomers = React.useMemo(() => {
    const query = conversationForm.customerSearch.trim().toLowerCase();
    if (!query) return [];

    const digitsQuery = onlyPhoneDigits(query);

    return customers
      .filter((customer) => {
        const haystack = [customer.name, customer.phone ?? "", customer.companyName ?? ""].join(" ").toLowerCase();
        const phoneDigits = onlyPhoneDigits(customer.phone ?? "");
        return haystack.includes(query) || (digitsQuery.length > 0 && phoneDigits.includes(digitsQuery));
      })
      .slice(0, 6);
  }, [conversationForm.customerSearch, customers]);
  const [customerForm, setCustomerForm] = React.useState({
    name: "",
    phone: "",
    email: "",
    companyName: "",
    notes: "",
    dashboardExcluded: false,
  });
  const socketRef = React.useRef<Socket | null>(null);
  const selectedTicketIdRef = React.useRef<string | null>(null);
  const activeWorkspaceRef = React.useRef(activeWorkspace);
  const ticketsRef = React.useRef<TicketItem[]>([]);
  const browserNotificationRegistrationRef = React.useRef<ServiceWorkerRegistration | null>(null);
  const appDialogResolverRef = React.useRef<((value: boolean) => void) | null>(null);
  const seenTicketNudgesRef = React.useRef<Record<string, string>>({});
  const ticketNudgesPrimedRef = React.useRef(false);
  const userMenuRef = React.useRef<HTMLDivElement | null>(null);
  const mobileTicketActionsRef = React.useRef<HTMLDivElement | null>(null);
  const messageMenuRef = React.useRef<HTMLDivElement | null>(null);
  const attachmentUploadRef = React.useRef<HTMLInputElement | null>(null);
  const messagesViewportRef = React.useRef<HTMLDivElement | null>(null);
  const composerDragDepthRef = React.useRef(0);
  const shouldStickMessagesToBottomRef = React.useRef(true);
  const audioRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioStreamRef = React.useRef<MediaStream | null>(null);
  const audioChunksRef = React.useRef<BlobPart[]>([]);

  const selectedApiEndpoint = React.useMemo(
    () => API_REFERENCE_ENDPOINTS.find((endpoint) => endpoint.key === selectedApiEndpointKey) ?? API_REFERENCE_ENDPOINTS[0] ?? null,
    [selectedApiEndpointKey],
  );

  const selectedTicket = React.useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? null,
    [tickets, selectedTicketId],
  );
  const selectedCustomer = React.useMemo(() => {
    if (!selectedTicket) return null;

    if (selectedTicket.customerId) {
      const customerById = customers.find((customer) => customer.id === selectedTicket.customerId);
      if (customerById) return customerById;
    }

    const selectedDigits = onlyPhoneDigits(selectedTicket.externalContactId ?? selectedTicket.externalChatId);
    return customers.find((customer) => onlyPhoneDigits(customer.phone ?? "") === selectedDigits) ?? null;
  }, [customers, selectedTicket]);
  const selectedTicketDisplayName = React.useMemo(() => {
    if (!selectedTicket) return "";
    const baseName = selectedTicket.isGroup ? selectedTicket.customerName : (selectedCustomer?.name ?? selectedTicket.customerName);
    return selectedTicket.isGroup ? baseName : (selectedCustomer?.companyName ? `${baseName} - ${selectedCustomer.companyName}` : baseName);
  }, [selectedCustomer?.companyName, selectedTicket]);
  const forwardSourceMessage = React.useMemo(
    () => messages.find((message) => message.id === forwardMessageId) ?? null,
    [forwardMessageId, messages],
  );
  const filteredForwardTickets = React.useMemo(() => {
    const query = forwardSearch.trim().toLowerCase();
    const digitsQuery = onlyPhoneDigits(forwardSearch);

    return tickets
      .filter((ticket) => ticket.status !== "closed" && ticket.id !== selectedTicketId)
      .filter((ticket) => {
        if (!query && !digitsQuery) return true;
        const haystack = [
          formatTicketDisplayName(ticket),
          ticket.customerName,
          ticket.externalContactId ?? "",
          ticket.externalChatId,
          ticket.currentQueue?.name ?? "",
        ].join(" ").toLowerCase();
        const ticketDigits = onlyPhoneDigits(ticket.externalContactId ?? ticket.externalChatId);
        return haystack.includes(query) || (digitsQuery.length > 0 && ticketDigits.includes(digitsQuery));
      })
      .slice(0, 8);
  }, [forwardSearch, selectedTicketId, tickets]);
  const filteredForwardCustomers = React.useMemo(() => {
    const query = forwardSearch.trim().toLowerCase();
    const digitsQuery = onlyPhoneDigits(forwardSearch);
    if (!query && !digitsQuery) return customers.slice(0, 8);

    return customers
      .filter((customer) => {
        const haystack = [customer.name, customer.phone ?? "", customer.companyName ?? ""].join(" ").toLowerCase();
        const customerDigits = onlyPhoneDigits(customer.phone ?? "");
        return haystack.includes(query) || (digitsQuery.length > 0 && customerDigits.includes(digitsQuery));
      })
      .slice(0, 8);
  }, [customers, forwardSearch]);
  const managementSearch = searchQuery.trim().toLowerCase();
  const filteredApiModules = React.useMemo(() => {
    return CHATFLOW_API_REFERENCE_MODULES
      .map((module) => {
        const endpoints = module.endpoints.filter((endpoint) => {
          if (!managementSearch) return true;
          return [
            endpoint.method,
            endpoint.title,
            endpoint.summary,
            endpoint.publicPath,
            endpoint.module,
            endpoint.permission ?? "",
            endpoint.auth,
            ...(endpoint.notes ?? []),
          ]
            .join(" ")
            .toLowerCase()
            .includes(managementSearch);
        });

        return {
          ...module,
          endpoints,
        };
      })
      .filter((module) => module.endpoints.length > 0);
  }, [managementSearch]);
  const filteredApiEndpointCount = React.useMemo(
    () => filteredApiModules.reduce((total, module) => total + module.endpoints.length, 0),
    [filteredApiModules],
  );
  const handleCopyApiValue = React.useCallback(async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setPanelMessage(successMessage);
    } catch {
      setPanelMessage("Nao foi possivel copiar o valor.");
    }
  }, []);
  const handleSelectApiEndpoint = React.useCallback((endpoint: ApiEndpointDoc) => {
    setSelectedApiEndpointKey(endpoint.key);
    setApiTesterMethod(endpoint.method);
    setApiTesterPath(endpoint.testerPath);
    setApiTesterBody(endpoint.bodyExample ?? "");
    setApiSelectedAuthMode(endpoint.auth === "bearer" ? "bearer" : "session");
    setApiTesterError(null);
    setApiTesterResult(null);
  }, []);
  const handleResetApiTester = React.useCallback(() => {
    if (!selectedApiEndpoint) return;
    setApiTesterMethod(selectedApiEndpoint.method);
    setApiTesterPath(selectedApiEndpoint.testerPath);
    setApiTesterBody(selectedApiEndpoint.bodyExample ?? "");
    setApiSelectedAuthMode(selectedApiEndpoint.auth === "bearer" ? "bearer" : "session");
    setApiTesterError(null);
    setApiTesterResult(null);
  }, [selectedApiEndpoint]);
  const canManageApiTokens = user?.permissions["api.manage"] ?? false;
  const handleRunApiTester = React.useCallback(async () => {
    const normalizedPath = normalizeApiTesterPath(apiTesterPath);
    if (!normalizedPath) {
      setApiTesterError("Informe uma rota valida para executar o teste.");
      setApiTesterResult(null);
      return;
    }

    setApiTesterLoading(true);
    setApiTesterError(null);
    setApiTesterResult(null);

    const startedAt = performance.now();

    try {
      const headers = new Headers();
      let body: string | undefined;

      if (apiSelectedAuthMode === "bearer") {
        if (!apiBearerToken.trim()) {
          setApiTesterError("Informe um Bearer token para executar esta rota.");
          setApiTesterResult(null);
          return;
        }

        headers.set("Authorization", `Bearer ${apiBearerToken.trim()}`);
      }

      if (apiTesterMethod !== "GET" && apiTesterMethod !== "DELETE" && apiTesterBody.trim()) {
        headers.set("Content-Type", "application/json");
        body = apiTesterBody;
      }

      const response = await fetch(`${API_URL}${normalizedPath}`, {
        method: apiTesterMethod,
        credentials: apiSelectedAuthMode === "session" ? "include" : "omit",
        cache: "no-store",
        headers,
        body,
      });

      const durationMs = Math.round(performance.now() - startedAt);
      const rawResponse = await response.text();
      let formattedBody = rawResponse;

      try {
        formattedBody = rawResponse ? JSON.stringify(JSON.parse(rawResponse), null, 2) : "";
      } catch {
        formattedBody = rawResponse;
      }

      setApiTesterResult({
        method: apiTesterMethod,
        requestedPath: normalizedPath,
        status: response.status,
        ok: response.ok,
        durationMs,
        contentType: response.headers.get("content-type"),
        headers: Array.from(response.headers.entries()).map(([key, value]) => ({ key, value })),
        body: formattedBody || "(sem corpo de resposta)",
      });
    } catch (error) {
      setApiTesterError(error instanceof Error ? error.message : "Falha ao executar o teste.");
    } finally {
      setApiTesterLoading(false);
    }
  }, [apiBearerToken, apiSelectedAuthMode, apiTesterBody, apiTesterMethod, apiTesterPath]);
  const refreshApiTokens = React.useCallback(async () => {
    if (!canManageApiTokens) return;
    setApiTokensLoading(true);
    try {
      const payload = await apiFetch<{ items: ApiAccessTokenItem[] }>("/api-access/tokens", { method: "GET" });
      setApiTokens(payload.items);
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Nao foi possivel carregar os tokens da API.");
    } finally {
      setApiTokensLoading(false);
    }
  }, [canManageApiTokens]);
  const handleCreateApiToken = React.useCallback(async () => {
    const name = apiTokenNameInput.trim();
    if (!name) {
      setPanelMessage("Informe um nome para a integracao.");
      return;
    }

    setApiTokensLoading(true);
    try {
      const payload = await apiFetch<ApiAccessTokenCreateResponse>("/api-access/tokens", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setApiTokens((current) => [payload.item, ...current]);
      setApiTokenNameInput("");
      setApiNewTokenValue(payload.token);
      setApiBearerToken(payload.token);
      setPanelMessage("Token criado. Copie o valor agora: ele nao sera exibido novamente.");
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Nao foi possivel criar o token.");
    } finally {
      setApiTokensLoading(false);
    }
  }, [apiTokenNameInput]);
  const handleDeleteApiToken = React.useCallback(async (tokenId: string) => {
    setApiTokensLoading(true);
    try {
      await apiFetch<{ message: string }>(`/api-access/tokens/${tokenId}`, { method: "DELETE" });
      setApiTokens((current) => current.filter((item) => item.id !== tokenId));
      setPanelMessage("Token removido.");
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Nao foi possivel remover o token.");
    } finally {
      setApiTokensLoading(false);
    }
  }, []);
  React.useEffect(() => {
    if (activeWorkspace !== "api") return;
    if (selectedApiEndpoint) return;
    if (API_REFERENCE_ENDPOINTS[0]) {
      handleSelectApiEndpoint(API_REFERENCE_ENDPOINTS[0]);
    }
  }, [activeWorkspace, handleSelectApiEndpoint, selectedApiEndpoint]);
  React.useEffect(() => {
    if (activeWorkspace !== "api" || !canManageApiTokens) return;
    void refreshApiTokens();
  }, [activeWorkspace, canManageApiTokens, refreshApiTokens]);
  const forwardDestinations = React.useMemo(() => {
    const items: ForwardDestination[] = [];
    const seen = new Set<string>();
    const digitsQuery = onlyPhoneDigits(forwardSearch);

    for (const ticket of filteredForwardTickets) {
      const key = `ticket:${ticket.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        key,
        kind: "ticket",
        label: formatTicketDisplayName(ticket),
        meta: `${formatContactIdentity(ticket.externalContactId ?? ticket.externalChatId)} • ${ticket.whatsappInstance.name}`,
        avatarUrl: ticket.customerAvatarUrl ?? null,
        ticketId: ticket.id,
        instanceId: ticket.whatsappInstance.id,
      });
    }

    for (const customer of filteredForwardCustomers) {
      const phone = onlyPhoneDigits(customer.phone ?? "");
      const key = `contact:${customer.id}`;
      if (seen.has(key) || !phone) continue;
      seen.add(key);
      items.push({
        key,
        kind: "contact",
        label: customer.name,
        meta: `${formatContactIdentity(customer.phone)}${customer.companyName ? ` • ${customer.companyName}` : ""}`,
        avatarUrl: customer.avatarUrl ?? null,
        customerId: customer.id,
        phone,
        instanceId: selectedTicket?.whatsappInstance.id ?? instances[0]?.id ?? null,
      });
    }

    if (digitsQuery.length >= 8) {
      const key = `manual:${digitsQuery}`;
      if (!seen.has(key)) {
        items.unshift({
          key,
          kind: "manual",
          label: formatPhoneInput(digitsQuery),
          meta: "Número digitado",
          phone: digitsQuery,
          instanceId: selectedTicket?.whatsappInstance.id ?? instances[0]?.id ?? null,
        });
      }
    }

    return items;
  }, [filteredForwardCustomers, filteredForwardTickets, forwardSearch, instances, selectedTicket?.whatsappInstance.id]);
  const selectedForwardDestinations = React.useMemo(
    () => forwardDestinations.filter((item) => selectedForwardDestinationKeys.includes(item.key)),
    [forwardDestinations, selectedForwardDestinationKeys],
  );
  const editingMessage = React.useMemo(
    () => messages.find((message) => message.id === editingMessageId) ?? null,
    [editingMessageId, messages],
  );
  const replyToMessage = React.useMemo(
    () => messages.find((message) => message.id === replyToMessageId) ?? null,
    [messages, replyToMessageId],
  );
  const botQueueIds = React.useMemo(
    () => queues.filter((queue) => queue.isBotQueue).map((queue) => queue.id),
    [queues],
  );
  const botQueueNames = React.useMemo(
    () => queues.filter((queue) => queue.isBotQueue).map((queue) => queue.name),
    [queues],
  );

  const currentUser: AuthUser = user ?? {
    id: "",
    email: "",
    role: "agent",
    name: "",
    avatarUrl: null,
    permissions: defaultPermissionsForRole("agent"),
  };

  function formatTicketDisplayName(ticket: TicketItem) {
    const matchedCustomer = ticket.customerId
      ? customers.find((customer) => customer.id === ticket.customerId)
      : customers.find((customer) => onlyPhoneDigits(customer.phone ?? "") === onlyPhoneDigits(ticket.externalContactId ?? ticket.externalChatId));

    const baseName = ticket.isGroup ? ticket.customerName : (matchedCustomer?.name ?? ticket.customerName);
    return ticket.isGroup ? baseName : (matchedCustomer?.companyName ? `${baseName} - ${matchedCustomer.companyName}` : baseName);
  }

  function formatCustomerDisplayName(customer: CustomerItem) {
    const baseName = customer.name.trim();
    const companyName = customer.companyName?.trim();
    return companyName ? `${baseName} - ${companyName}` : baseName;
  }

  function findCustomerForTicket(ticket: TicketItem) {
    return ticket.customerId
      ? customers.find((customer) => customer.id === ticket.customerId) ?? null
      : customers.find((customer) => onlyPhoneDigits(customer.phone ?? "") === onlyPhoneDigits(ticket.externalContactId ?? ticket.externalChatId)) ?? null;
  }

  const canViewGroups = currentUser.permissions["tickets.groups"];
  const canViewChannels = currentUser.permissions["channels.view"];
  const canViewQuickReplies = currentUser.permissions["quickReplies.view"];
  const canViewTeam = currentUser.permissions["team.view"];
  const canTransferTickets = currentUser.permissions["tickets.transfer"];
  const canTransferTicketsFromOthers = currentUser.permissions["tickets.transferOthers"];
  const canNudgeTickets = currentUser.permissions["tickets.nudge"];
  const canCloseTicketsWithoutAccept = currentUser.permissions["tickets.closeWithoutAccept"];
  const canManageInstances = currentUser.permissions["channels.manage"];
  const canManageQuickReplies = currentUser.permissions["quickReplies.manage"];
  const canManageAgents = currentUser.permissions["agents.manage"];
  const canDeleteAgents = currentUser.permissions["agents.delete"];
  const canManageAgentPasswords = currentUser.permissions["agents.password.manage"];
  const canManageUserAccess = currentUser.role === "admin";
  const canManageQueues = currentUser.permissions["queues.manage"];
  const canAssignQueues = currentUser.permissions["queues.assign"];
  const canViewAutomations = currentUser.permissions["automations.view"];
  const canManageAutomations = currentUser.permissions["automations.manage"];
  const canStartConversation = currentUser.permissions["tickets.reply"];
  const canViewOtherTickets = currentUser.permissions["tickets.viewOthers"] || currentUser.permissions["tickets.viewAll"];
  const canReplyUnassignedTickets = currentUser.permissions["tickets.replyUnassigned"];
  const canViewContacts = currentUser.permissions["contacts.view"];
  const canManageContacts = currentUser.permissions["contacts.manage"];
  const canBulkDeleteTickets = currentUser.permissions["tickets.bulkDelete"];
  const canBulkDeleteMessages = currentUser.permissions["messages.bulkDelete"];
  const canViewClosedTickets = currentUser.permissions["tickets.closedView"];
  const browserNotificationsSupported = typeof window !== "undefined" && "Notification" in window;
  const browserNotificationsEnabled = browserNotificationsSupported && browserNotificationPermission === "granted";
  const isClosedTicketsWorkspace = activeWorkspace === "closedTickets";
  const canDeleteSelectedTicket = Boolean(selectedTicket && canBulkDeleteTickets);
  const dashboardAgentOptions = React.useMemo(() => {
    const options = [{ id: "all", name: "Visão geral" }];
    const seen = new Set<string>(["all"]);

    if (currentUser.id) {
      options.push({ id: currentUser.id, name: `Meu desempenho (${currentUser.name || "Usuário atual"})` });
      seen.add(currentUser.id);
    }

    if (canViewTeam) {
      for (const agent of agents) {
        if (!seen.has(agent.id)) {
          options.push({ id: agent.id, name: agent.name });
          seen.add(agent.id);
        }
      }
    }

    return options;
  }, [agents, canViewTeam, currentUser.id, currentUser.name]);

  React.useEffect(() => {
    if (!dashboardAgentOptions.some((option) => option.id === dashboardAgentId)) {
      setDashboardAgentId("all");
    }
  }, [dashboardAgentId, dashboardAgentOptions]);

  const isSelectedTicketOwnedByCurrentUser = Boolean(selectedTicket && selectedTicket.currentAgent?.id === user?.id);
  const canAcceptSelectedTicket = Boolean(
    selectedTicket &&
    !selectedTicket.isGroup &&
    selectedTicket.status !== "closed" &&
    selectedTicket.currentAgent?.id !== user?.id &&
    currentUser.permissions["tickets.accept"] &&
    !selectedTicket.currentAgent,
  );
  const canCloseSelectedTicket = Boolean(
    selectedTicket &&
    !selectedTicket.isGroup &&
    selectedTicket.status !== "closed" &&
    (
      (currentUser.permissions["tickets.close"] && isSelectedTicketOwnedByCurrentUser)
      || (canCloseTicketsWithoutAccept && !isSelectedTicketOwnedByCurrentUser)
    ),
  );
  const canReopenSelectedTicket = Boolean(
    selectedTicket &&
    selectedTicket.status === "closed" &&
    currentUser.permissions["tickets.close"] &&
    (isSelectedTicketOwnedByCurrentUser || currentUser.role === "admin"),
  );
  const canSendToSelectedTicket = Boolean(
    selectedTicket &&
    selectedTicket.status !== "closed" &&
    currentUser.permissions["tickets.reply"] &&
    (selectedTicket.isGroup ? canViewGroups : (isSelectedTicketOwnedByCurrentUser || canReplyUnassignedTickets)),
  );
  const isSelectedTicketClosed = Boolean(selectedTicket?.status === "closed");
  const shouldDisableComposer = Boolean(!selectedTicket || !canSendToSelectedTicket);
  const isEditingMessage = Boolean(editingMessageId);
  const composerPlaceholder = !selectedTicket
      ? "Selecione um ticket para conversar"
      : isSelectedTicketClosed
        ? "Ticket fechado para envio"
        : composerInternalNoteMode
          ? "Digite uma observação interna"
        : isEditingMessage
          ? "Edite a mensagem"
          : "Aceite o atendimento para responder";
  const canTransferSelectedTicket = Boolean(
    selectedTicket &&
    !selectedTicket.isGroup &&
    selectedTicket.status !== "closed" &&
    (
      (canTransferTickets && (isSelectedTicketOwnedByCurrentUser || !selectedTicket.currentAgent))
      || (canTransferTicketsFromOthers && Boolean(selectedTicket.currentAgent) && !isSelectedTicketOwnedByCurrentUser)
    ),
  );
  const canNudgeSelectedTicket = Boolean(
    selectedTicket
    && !selectedTicket.isGroup
    && selectedTicket.status !== "closed"
    && selectedTicket.currentAgent
    && selectedTicket.currentAgent.id !== currentUser.id
    && canNudgeTickets,
  );
  const ticketDensity: "compact" = "compact";

  const quickReplyCommand = React.useMemo(() => {
    const match = messageInput.match(/(?:^|\s)\/([a-z0-9_-]*)$/i);
    if (!match) return null;
    return match[1]?.toLowerCase() ?? "";
  }, [messageInput]);

  const quickReplyMatches = React.useMemo(() => {
    if (quickReplyCommand === null || !canViewQuickReplies) return [];

    return quickReplies
      .filter((item) => item.isActive && item.shortcut.toLowerCase().includes(quickReplyCommand))
      .slice(0, 6);
  }, [canViewQuickReplies, quickReplies, quickReplyCommand]);

  const dynamicFieldCommand = React.useMemo(() => {
    return getDynamicFieldCommandFromCursor(messageInput, messageCursorPosition);
  }, [messageCursorPosition, messageInput]);

  const dynamicFieldMatches = React.useMemo(() => {
    if (dynamicFieldCommand === null) return [];
    return getDynamicFieldMatchesFromCursor(messageInput, messageCursorPosition);
  }, [dynamicFieldCommand, messageCursorPosition, messageInput]);

  const quickReplyDynamicFieldMatches = React.useMemo(
    () => getDynamicFieldMatchesFromCursor(quickReplyForm.content, quickReplyCursorPosition),
    [quickReplyCursorPosition, quickReplyForm.content],
  );

  const automationDynamicFieldMatches = React.useMemo(
    () => getDynamicFieldMatchesFromCursor(automationForm.actionMessage, automationMessageCursorPosition),
    [automationForm.actionMessage, automationMessageCursorPosition],
  );

  const scopedTickets = React.useMemo(() => {
    const search = searchQuery.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const matchedCustomer = findCustomerForTicket(ticket);

      if (
        !isClosedTicketsWorkspace
        && (!showAllTickets || !canViewOtherTickets)
        && ticket.currentAgent
        && ticket.currentAgent.id !== user?.id
      ) {
        return false;
      }

      if (showOnlyUnread && ticket.unreadCount === 0) {
        return false;
      }

      if (selectedQueueFilter === "without-queue") {
        if (ticket.currentQueue) {
          return false;
        }
      } else if (selectedQueueFilter !== "all" && ticket.currentQueue?.id !== selectedQueueFilter) {
        return false;
      }

      if (!search) {
        return true;
      }

      return [
        ticket.customerName,
        matchedCustomer?.name ?? "",
        matchedCustomer?.companyName ?? "",
        matchedCustomer?.email ?? "",
        matchedCustomer?.phone ?? "",
        ticket.externalChatId,
        ticket.externalContactId ?? "",
        ticket.lastMessagePreview ?? "",
        ticket.currentAgent?.name ?? "",
        ticket.currentQueue?.name ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [canViewOtherTickets, customers, isClosedTicketsWorkspace, searchQuery, selectedQueueFilter, showAllTickets, showOnlyUnread, tickets, user?.id]);

  const visibleTickets = React.useMemo(() => {
    return scopedTickets.filter((ticket) => {
      const matchesActiveTab = activeTab === "grupos"
        ? ticket.isGroup
        : activeTab === "aguardando"
          ? ticket.status === "pending" && !ticket.isGroup
          : ticket.status === "open" && !ticket.isGroup;
      const matchesArchivedAddon = !ticket.isGroup && ticket.status === "closed";

      if (isClosedTicketsWorkspace) {
        return matchesArchivedAddon;
      }

      return matchesActiveTab || (showArchivedTickets && matchesArchivedAddon);
    });
  }, [activeTab, isClosedTicketsWorkspace, scopedTickets, showArchivedTickets]);

  const counters = React.useMemo(() => {
    return {
      atendendo: scopedTickets.filter((ticket) => ticket.status === "open" && !ticket.isGroup).length,
      aguardando: scopedTickets.filter((ticket) => ticket.status === "pending" && !ticket.isGroup).length,
      fechados: scopedTickets.filter((ticket) => ticket.status === "closed" && !ticket.isGroup).length,
      grupos: scopedTickets.filter((ticket) => ticket.isGroup).length,
    };
  }, [scopedTickets]);

  React.useEffect(() => {
    if (!selectedTicketId) {
      return;
    }

    if (activeWorkspace !== "tickets" && activeWorkspace !== "closedTickets") {
      return;
    }

    if (visibleTickets.some((ticket) => ticket.id === selectedTicketId)) {
      return;
    }

    setSelectedTicketId(null);
  }, [activeWorkspace, selectedTicketId, visibleTickets]);
  const filteredInstances = React.useMemo(() => {
    if (!managementSearch) return instances;
    return instances.filter((instance) =>
      [instance.name, instance.evolutionInstanceName, instance.baseUrl, instance.phoneNumber ?? "", traduzirStatusInstancia(instance.status)]
        .join(" ")
        .toLowerCase()
        .includes(managementSearch),
    );
  }, [instances, managementSearch]);

  const filteredAgents = React.useMemo(() => {
    if (!managementSearch) return agents;
    return agents.filter((agent) =>
      [agent.name, agent.email, traduzirPerfil(agent.role), agent.queues.map((queue) => queue.name).join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(managementSearch),
    );
  }, [agents, managementSearch]);

  const filteredQueues = React.useMemo(() => {
    if (!managementSearch) return queues;
    return queues.filter((queue) =>
      [queue.name, queue.color ?? "", queue.agents.map((agent) => agent.name).join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(managementSearch),
    );
  }, [managementSearch, queues]);

  const filteredCustomers = React.useMemo(() => {
    if (!managementSearch) return customers;
    return customers.filter((customer) =>
      [customer.name, customer.phone ?? "", customer.email ?? "", customer.companyName ?? "", customer.notes ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(managementSearch),
    );
  }, [customers, managementSearch]);

  const filteredQuickReplies = React.useMemo(() => {
    if (!managementSearch) return quickReplies;
    return quickReplies.filter((item) =>
      [item.shortcut, item.content, item.isActive ? "ativa" : "inativa"]
        .join(" ")
        .toLowerCase()
        .includes(managementSearch),
    );
  }, [managementSearch, quickReplies]);

  const filteredAutomations = React.useMemo(() => {
    if (!managementSearch) return automations;
    return automations.filter((item) =>
      [
        item.name,
        item.description ?? "",
        translateAutomationTrigger(item.triggerType),
        translateAutomationStatus(item.status),
        item.queue?.name ?? "",
        item.whatsappInstance?.name ?? "",
        item.actions.map((action) => formatAutomationActionSummary(action)).join(" "),
        item.conditions.map((condition) => formatAutomationCondition(condition)).join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(managementSearch),
    );
  }, [automations, managementSearch]);

  const filteredAutomationExecutions = React.useMemo(() => {
    if (!managementSearch) return automationExecutions;
    return automationExecutions.filter((item) =>
      [
        item.automation.name,
        translateAutomationExecutionStatus(item.status),
        translateAutomationTrigger(item.automation.triggerType),
        item.message ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(managementSearch),
    );
  }, [automationExecutions, managementSearch]);

  const filteredScheduledMessageOverview = React.useMemo(() => {
    return scheduledMessageOverview.filter((item) => {
      if (scheduledMessageStatusFilter !== "all" && item.status !== scheduledMessageStatusFilter) {
        return false;
      }

      if (!managementSearch) {
        return true;
      }

      return [
        item.ticket?.customerName ?? "",
        item.ticket?.currentQueue?.name ?? "",
        item.ticket?.currentAgent?.name ?? "",
        item.createdBy.name,
        traduzirStatusMensagemAgendada(item.status),
        formatScheduledMessagePreview(item),
        item.ticket?.whatsappInstance?.name ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(managementSearch);
    });
  }, [managementSearch, scheduledMessageOverview, scheduledMessageStatusFilter]);

  React.useEffect(() => {
    if (tickets.length === 0) {
      setSelectedTicketId(null);
      return;
    }

    if (selectedTicketId && !tickets.some((ticket) => ticket.id === selectedTicketId)) {
      setSelectedTicketId(null);
    }
  }, [selectedTicketId, tickets]);

  React.useEffect(() => {
    ticketsRef.current = tickets;
  }, [tickets]);

  React.useEffect(() => {
    if (activeWorkspace !== "tickets" && activeWorkspace !== "closedTickets" && showTicketDetails) {
      setShowTicketDetails(false);
    }
  }, [activeWorkspace, showTicketDetails]);

  React.useEffect(() => {
    if (!userMenuOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!userMenuRef.current) return;
      if (!userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setUserMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [userMenuOpen]);

  React.useEffect(() => {
    if (!mobileTicketActionsOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!mobileTicketActionsRef.current) return;
      if (!mobileTicketActionsRef.current.contains(event.target as Node)) {
        setMobileTicketActionsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileTicketActionsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [mobileTicketActionsOpen]);

  React.useEffect(() => {
    if (!isMobileViewport) {
      setMobileTicketActionsOpen(false);
    }
  }, [isMobileViewport]);

  React.useEffect(() => {
    setMobileTicketActionsOpen(false);
  }, [selectedTicketId]);

  React.useEffect(() => {
    setProfileName(user?.name ?? "");
    setProfileAvatarPreview(user?.avatarUrl ?? null);
  }, [user?.name, user?.avatarUrl]);

  React.useEffect(() => {
    return () => {
      audioRecorderRef.current?.stop();
      audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const storedBrandMode = window.localStorage.getItem(BRAND_MODE_STORAGE_KEY);
    const storedLogo = window.localStorage.getItem(BRAND_LOGO_STORAGE_KEY);
    const storedBrandText = window.localStorage.getItem(BRAND_TEXT_STORAGE_KEY);

    if (storedBrandMode === "default" || storedBrandMode === "image" || storedBrandMode === "text") {
      setBrandMode(storedBrandMode);
    }

    if (storedBrandText) {
      setBrandText(storedBrandText);
    }

    if (storedLogo) {
      setBrandLogoPreview(storedLogo);
    }
  }, []);

  React.useEffect(() => {
    setPublicUrls(resolvePublicUrls());
  }, []);

  React.useEffect(() => {
    const preferredWorkspaces: WorkspaceKey[] = [
      "tickets",
      "closedTickets",
      "dashboard",
      "channels",
      "quickReplies",
      "team",
      "api",
      "contacts",
      "profile",
      "calendar",
      "automations",
      "settings",
    ];

    if (currentUser.id && !currentUser.permissions[workspacePermissions[activeWorkspace]]) {
      const fallback = preferredWorkspaces.find((workspace) => currentUser.permissions[workspacePermissions[workspace]]);
      if (fallback && fallback !== activeWorkspace) {
        setActiveWorkspace(fallback);
      }
    }
  }, [activeWorkspace, currentUser.id, currentUser.permissions]);

  React.useEffect(() => {
    setShowTicketDetails(false);
  }, [selectedTicketId]);

  React.useEffect(() => {
    setEditingMessageId(null);
    setReplyToMessageId(null);
    resetForwardState();
  }, [selectedTicketId]);

  React.useEffect(() => {
    if (editingMessageId && !messages.some((message) => message.id === editingMessageId)) {
      setEditingMessageId(null);
    }
  }, [editingMessageId, messages]);

  React.useEffect(() => {
    if (replyToMessageId && !messages.some((message) => message.id === replyToMessageId)) {
      setReplyToMessageId(null);
    }
  }, [messages, replyToMessageId]);

  React.useEffect(() => {
    if (editingMessageId && !canSendToSelectedTicket) {
      setEditingMessageId(null);
    }
  }, [canSendToSelectedTicket, editingMessageId]);

  React.useEffect(() => {
    if (replyToMessageId && !canSendToSelectedTicket) {
      setReplyToMessageId(null);
    }
  }, [canSendToSelectedTicket, replyToMessageId]);

  React.useEffect(() => {
    if (!openMessageMenuId) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!messageMenuRef.current) return;
      if (messageMenuRef.current.contains(event.target as Node)) {
        return;
      }

      setOpenMessageMenuId(null);
      setMessageMenuPosition(null);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [openMessageMenuId]);

  React.useEffect(() => {
    if (!openMessageMenuId) {
      setMessageMenuPosition(null);
    }
  }, [openMessageMenuId]);

  React.useEffect(() => {
    setShowTransferPanel(false);
    setTicketHistoryViewer(null);
    setTransferForm({
      agentId: "",
      queueId: "",
      note: "",
    });
  }, [selectedTicketId]);

  React.useEffect(() => {
    if (!showTransferPanel) {
      return;
    }

    setTransferForm((current) => {
      if (transferQueues.some((queue) => queue.id === current.queueId)) {
        return current;
      }

      return {
        ...current,
        queueId: transferQueues[0]?.id ?? "",
      };
    });
  }, [showTransferPanel, transferQueues]);

  React.useEffect(() => {
    if (activeTab === "grupos" && !canViewGroups) {
      setActiveTab("atendendo");
    }
  }, [activeTab, canViewGroups]);

  const refreshAuth = React.useCallback(async () => {
    setLoadingAuth(true);
    try {
      const payload = await apiFetch<AuthResponse>("/auth/me", { method: "GET" });
      setUser(payload.authenticated ? payload.user ?? null : null);
      setAuthError(null);
    } catch (error) {
      setUser(null);
      setAuthError(error instanceof Error ? error.message : "Falha ao consultar sessão.");
    } finally {
      setLoadingAuth(false);
    }
  }, []);

  const refreshTickets = React.useCallback(async () => {
    if (!user) return [] as TicketItem[];
    setTicketLoading(true);
    try {
      let items: TicketItem[] = [];

      if (activeWorkspace === "closedTickets") {
        const payload = await apiFetch<{ items: TicketItem[] }>("/tickets?status=closed", { method: "GET" });
        items = payload.items;
      } else {
        const requests: Array<Promise<{ items: TicketItem[] }>> = [
          apiFetch<{ items: TicketItem[] }>("/tickets?status=open&isGroup=false", { method: "GET" }),
          apiFetch<{ items: TicketItem[] }>("/tickets?status=pending&isGroup=false", { method: "GET" }),
          apiFetch<{ items: TicketItem[] }>("/tickets?isGroup=true", { method: "GET" }),
        ];

        if (showArchivedTickets) {
          requests.push(apiFetch<{ items: TicketItem[] }>("/tickets?status=closed&isGroup=false", { method: "GET" }));
        }

        const [openPayload, pendingPayload, groupsPayload, closedPayload] = await Promise.all(requests);

        const deduped = new Map<string, TicketItem>();
        [
          ...openPayload.items,
          ...pendingPayload.items,
          ...groupsPayload.items,
          ...(closedPayload?.items ?? []),
        ].forEach((ticket) => {
          deduped.set(ticket.id, ticket);
        });

        items = Array.from(deduped.values()).sort((a, b) => {
          const aTime = new Date(a.lastMessageAt ?? a.updatedAt).getTime();
          const bTime = new Date(b.lastMessageAt ?? b.updatedAt).getTime();
          return bTime - aTime;
        });
      }

      setTickets(items);
      setSelectedTicketId((current) => {
        if (current && items.some((ticket) => ticket.id === current)) {
          return current;
        }
        return null;
      });
      return items;
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao carregar tickets.");
      return [] as TicketItem[];
    } finally {
      setTicketLoading(false);
    }
  }, [activeWorkspace, showArchivedTickets, user]);

  const openTicketFromNotification = React.useCallback((ticket: TicketItem) => {
    setActiveWorkspace(ticket.status === "closed" ? "closedTickets" : "tickets");
    if (ticket.isGroup) {
      setActiveTab("grupos");
    } else if (ticket.status === "pending") {
      setActiveTab("aguardando");
    } else {
      setActiveTab("atendendo");
    }
    setShowTicketDetails(false);
    setSelectedTicketId(ticket.id);
    if (isMobileViewport) {
      setMobileTicketView("conversation");
    }
    if (typeof window !== "undefined") {
      window.focus();
    }
  }, [isMobileViewport]);

  const openNudgeDialogForTicket = React.useCallback((ticketId: string, actorName: string, customerName: string, createdAt?: string) => {
    const message = `${actorName} chamou sua atenção para o ticket de ${customerName}.`;
    const matchingTicket = tickets.find((ticket) => ticket.id === ticketId);
    const markNudgeAsSeen = () => {
      if (!user || !createdAt) {
        return;
      }

      const nextSeen = {
        ...seenTicketNudgesRef.current,
        [ticketId]: createdAt,
      };
      seenTicketNudgesRef.current = nextSeen;
      persistSeenTicketNudges(user.id, nextSeen);
    };

    const openNudgedTicket = () => {
      markNudgeAsSeen();
      if (matchingTicket) {
        openTicketFromNotification(matchingTicket);
        return;
      }

      setActiveWorkspace("tickets");
      setSelectedTicketId(ticketId);
      if (isMobileViewport) {
        setMobileTicketView("conversation");
      }
      if (typeof window !== "undefined") {
        window.focus();
      }
    };

    setPanelMessage(message);
    void openConfirmDialog({
      title: "Atenção solicitada",
      description: message,
      confirmLabel: "Ir para o ticket",
      cancelLabel: "Fechar",
    }).then((shouldOpenTicket) => {
      if (shouldOpenTicket) {
        openNudgedTicket();
        return;
      }

      markNudgeAsSeen();
    });

    return openNudgedTicket;
  }, [isMobileViewport, openTicketFromNotification, tickets, user]);

  const openTransferDialogForTicket = React.useCallback((ticketId: string, description: string) => {
    const matchingTicket = tickets.find((ticket) => ticket.id === ticketId);

    const openTransferredTicket = () => {
      if (matchingTicket) {
        openTicketFromNotification(matchingTicket);
        return;
      }

      setActiveWorkspace("tickets");
      setSelectedTicketId(ticketId);
      if (isMobileViewport) {
        setMobileTicketView("conversation");
      }
      if (typeof window !== "undefined") {
        window.focus();
      }
    };

    appDialogResolverRef.current = (confirmed) => {
      setAppDialog(null);
      if (confirmed) {
        openTransferredTicket();
      }
    };

    setAppDialog({
      kind: "confirm",
      tone: "default",
      title: "Conversa transferida",
      description,
      confirmLabel: "Ir para o ticket",
      cancelLabel: "Fechar",
    });

    return openTransferredTicket;
  }, [isMobileViewport, openTicketFromNotification, tickets]);

  const refreshMessages = React.useCallback(async (ticketId: string, options?: { silent?: boolean }) => {
    if (!user) return;
    if (!options?.silent) {
      setMessageLoading(true);
    }
    try {
      const payload = await apiFetch<{ items: MessageItem[] }>(`/tickets/${ticketId}/messages`, { method: "GET" });
      setMessages(payload.items);
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao carregar mensagens.");
    } finally {
      if (!options?.silent) {
        setMessageLoading(false);
      }
    }
  }, [user]);

  const refreshScheduledMessages = React.useCallback(async (ticketId: string) => {
    if (!user) return;

    try {
      const payload = await apiFetch<{ items: ScheduledMessageItem[] }>(`/tickets/${ticketId}/scheduled-messages`, { method: "GET" });
      setScheduledMessages(payload.items);
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao carregar mensagens agendadas.");
    }
  }, [user]);

  const refreshScheduledMessageOverview = React.useCallback(async () => {
    if (!user || !normalizePermissions(user.role, user.permissions)["calendar.view"]) return;

    setScheduledMessageOverviewLoading(true);
    try {
      const payload = await apiFetch<{ items: ScheduledMessageItem[] }>("/scheduled-messages?status=pending,processing,failed,sent,canceled", { method: "GET" });
      setScheduledMessageOverview(payload.items);
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao carregar o módulo de agendamentos.");
    } finally {
      setScheduledMessageOverviewLoading(false);
    }
  }, [user]);

  const refreshInstances = React.useCallback(async () => {
    if (!user || !normalizePermissions(user.role, user.permissions)["channels.view"]) return;
    try {
      const payload = await apiFetch<{ items: InstanceItem[] }>("/whatsapp/instances", { method: "GET" });
      setInstances(payload.items);
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao carregar instâncias.");
    }
  }, [user]);

  const refreshAgents = React.useCallback(async () => {
    const permissions = user ? normalizePermissions(user.role, user.permissions) : null;
    if (!user || !(permissions?.["team.view"] || permissions?.["tickets.transfer"] || permissions?.["tickets.transferOthers"])) return;
    try {
      const payload = await apiFetch<{ items: AgentItem[] }>("/agents", { method: "GET" });
      setAgents(payload.items);
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao carregar agentes.");
    }
  }, [user]);

  const refreshQueues = React.useCallback(async () => {
    const permissions = user ? normalizePermissions(user.role, user.permissions) : null;
    if (!user || !(permissions?.["team.view"] || permissions?.["tickets.transfer"] || permissions?.["tickets.transferOthers"])) return;
    try {
      const payload = await apiFetch<{ items: QueueItem[] }>("/queues", { method: "GET" });
      setQueues(payload.items);
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao carregar filas.");
    }
  }, [user]);

  const refreshCustomers = React.useCallback(async () => {
    if (!user || !normalizePermissions(user.role, user.permissions)["contacts.view"]) return;
    try {
      const payload = await apiFetch<{ items: CustomerItem[] }>("/customers", { method: "GET" });
      setCustomers(payload.items);
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao carregar contatos.");
    }
  }, [user]);

  const refreshQuickReplies = React.useCallback(async () => {
    if (!user || !normalizePermissions(user.role, user.permissions)["quickReplies.view"]) return;
    try {
      const payload = await apiFetch<{ items: QuickReplyItem[] }>("/quick-replies", { method: "GET" });
      setQuickReplies(payload.items);
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao carregar respostas rápidas.");
    }
  }, [user]);

  const refreshAutomations = React.useCallback(async () => {
    if (!user || !normalizePermissions(user.role, user.permissions)["automations.view"]) return;
    setAutomationLoading(true);
    try {
      const payload = await apiFetch<{ items: AutomationItem[] }>("/automations", { method: "GET" });
      setAutomations(payload.items);
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao carregar automações.");
    } finally {
      setAutomationLoading(false);
    }
  }, [user]);

  const refreshAutomationExecutions = React.useCallback(async () => {
    if (!user || !normalizePermissions(user.role, user.permissions)["automations.view"]) return;
    setAutomationExecutionLoading(true);
    try {
      const payload = await apiFetch<{ items: AutomationExecutionItem[] }>("/automations/executions", { method: "GET" });
      setAutomationExecutions(payload.items);
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao carregar execuções das automações.");
    } finally {
      setAutomationExecutionLoading(false);
    }
  }, [user]);

  const refreshDashboard = React.useCallback(async () => {
    if (!user || !normalizePermissions(user.role, user.permissions)["dashboard.view"]) return;
    setDashboardLoading(true);
    try {
      const query = new URLSearchParams({ range: dashboardRange });
      if (dashboardAgentId !== "all") {
        query.set("agentId", dashboardAgentId);
      }

      const payload = await apiFetch<DashboardOverview>(`/dashboard/overview?${query.toString()}`, { method: "GET" });
      setDashboardOverview(payload);
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao carregar o painel geral.");
    } finally {
      setDashboardLoading(false);
    }
  }, [dashboardAgentId, dashboardRange, user]);

  const refreshAll = React.useCallback(async () => {
    await refreshDashboard();
    await refreshTickets();
    if (selectedTicketId) {
      await refreshMessages(selectedTicketId);
      await refreshScheduledMessages(selectedTicketId);
    }
    await refreshScheduledMessageOverview();
    await refreshInstances();
    await refreshAgents();
    await refreshQueues();
    await refreshCustomers();
    await refreshQuickReplies();
    await refreshAutomations();
    await refreshAutomationExecutions();
  }, [refreshAgents, refreshAutomationExecutions, refreshAutomations, refreshCustomers, refreshDashboard, refreshInstances, refreshMessages, refreshQueues, refreshQuickReplies, refreshScheduledMessageOverview, refreshScheduledMessages, refreshTickets, selectedTicketId]);

  React.useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  React.useEffect(() => {
    if (!user) {
      setTickets([]);
      setMessages([]);
      setInstances([]);
      setAgents([]);
      setQueues([]);
      setCustomers([]);
      setQuickReplies([]);
      setAutomations([]);
      setAutomationExecutions([]);
      setScheduledMessageOverview([]);
      setDashboardOverview(null);
      setSelectedTicketId(null);
      return;
    }

    void refreshDashboard();
    void refreshTickets();
    if (canViewChannels) {
      void refreshInstances();
    }
    if (canViewTeam || canTransferTickets) {
      void refreshAgents();
      void refreshQueues();
    }
    if (canViewContacts) {
      void refreshCustomers();
    }
    if (canViewQuickReplies) {
      void refreshQuickReplies();
    }
    if (canViewAutomations) {
      void refreshAutomations();
      void refreshAutomationExecutions();
    }
    if (normalizePermissions(user.role, user.permissions)["calendar.view"]) {
      void refreshScheduledMessageOverview();
    }
  }, [canTransferTickets, canViewAutomations, canViewChannels, canViewContacts, canViewQuickReplies, canViewTeam, refreshAgents, refreshAutomationExecutions, refreshAutomations, refreshCustomers, refreshDashboard, refreshInstances, refreshQueues, refreshQuickReplies, refreshScheduledMessageOverview, refreshTickets, user]);

  React.useEffect(() => {
    if (!selectedTicketId || !user) {
      setMessages([]);
      return;
    }

    shouldStickMessagesToBottomRef.current = true;
    void refreshMessages(selectedTicketId);
  }, [refreshMessages, selectedTicketId, user]);

  React.useEffect(() => {
    if (!selectedTicketId || !user) {
      setScheduledMessages([]);
      return;
    }

    void refreshScheduledMessages(selectedTicketId);
  }, [refreshScheduledMessages, selectedTicketId, user]);

  React.useEffect(() => {
    setGroupNameInput(selectedTicket?.manualGroupName ?? selectedTicket?.customerName ?? "");
  }, [selectedTicket?.customerName, selectedTicket?.id, selectedTicket?.manualGroupName]);

  React.useEffect(() => {
    setShowGroupNameModal(false);
  }, [selectedTicket?.id]);

  React.useEffect(() => {
    setShowScheduleModal(false);
    setScheduleForm({
      sendAt: toDateTimeLocalValue(new Date(Date.now() + 60 * 60 * 1000)),
    });
  }, [selectedTicket?.id]);

  function resolveAppDialog(value: boolean) {
    const resolver = appDialogResolverRef.current;
    appDialogResolverRef.current = null;
    setAppDialog(null);
    resolver?.(value);
  }

  function openConfirmDialog(config: Omit<AppDialogState, "kind">) {
    return new Promise<boolean>((resolve) => {
      appDialogResolverRef.current = resolve;
      setAppDialog({ ...config, kind: "confirm" });
    });
  }

  function openAlertDialog(config: Omit<AppDialogState, "kind" | "cancelLabel">) {
    return new Promise<boolean>((resolve) => {
      appDialogResolverRef.current = resolve;
      setAppDialog({ ...config, kind: "alert" });
    });
  }

  React.useEffect(() => {
    setSelectedTicketIdsForBulkDelete((current) => current.filter((ticketId) => tickets.some((ticket) => ticket.id === ticketId)));
  }, [tickets]);

  React.useEffect(() => {
    setSelectedMessageIdsForBulkDelete((current) => current.filter((messageId) => messages.some((message) => message.id === messageId)));
  }, [messages]);

  React.useEffect(() => {
    if (!user) {
      seenTicketNudgesRef.current = {};
      ticketNudgesPrimedRef.current = false;
      return;
    }

    if (!ticketNudgesPrimedRef.current) {
      const initialSeen = readSeenTicketNudges(user.id);
      tickets.forEach((ticket) => {
        if (ticket.latestNudge?.createdAt && !initialSeen[ticket.id]) {
          initialSeen[ticket.id] = ticket.latestNudge.createdAt;
        }
      });
      seenTicketNudgesRef.current = initialSeen;
      persistSeenTicketNudges(user.id, initialSeen);
      ticketNudgesPrimedRef.current = true;
      return;
    }

    const nextSeen = { ...seenTicketNudgesRef.current };
    const pendingNudge = tickets.find((ticket) => {
      const latestNudge = ticket.latestNudge;
      if (!latestNudge?.createdAt) {
        return false;
      }

      if (ticket.currentAgent?.id !== user.id || latestNudge.actorUserId === user.id) {
        nextSeen[ticket.id] = latestNudge.createdAt;
        return false;
      }

      if (nextSeen[ticket.id] === latestNudge.createdAt) {
        return false;
      }

      return true;
    });

    seenTicketNudgesRef.current = nextSeen;

    if (!pendingNudge?.latestNudge) {
      return;
    }

    seenTicketNudgesRef.current[pendingNudge.id] = pendingNudge.latestNudge.createdAt;
    openNudgeDialogForTicket(
      pendingNudge.id,
      pendingNudge.latestNudge.actorName || "Supervisão",
      pendingNudge.customerName || "um atendimento",
      pendingNudge.latestNudge.createdAt,
    );
  }, [openNudgeDialogForTicket, tickets, user]);

  React.useEffect(() => {
    setMessageBulkSelectionMode(false);
    setSelectedMessageIdsForBulkDelete([]);
  }, [selectedTicketId]);

  React.useEffect(() => {
    if (activeWorkspace !== "tickets" && activeWorkspace !== "closedTickets") {
      setTicketBulkSelectionMode(false);
      setSelectedTicketIdsForBulkDelete([]);
      setMessageBulkSelectionMode(false);
      setSelectedMessageIdsForBulkDelete([]);
      setShowArchivedTickets(false);
    }
  }, [activeWorkspace]);

  React.useEffect(() => {
    if (isClosedTicketsWorkspace) {
      setShowAllTickets(false);
    }
  }, [isClosedTicketsWorkspace]);

  React.useEffect(() => {
    if (!user || !SOCKET_URL) return;

    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    const refreshForTicket = (payload?: { ticketId?: string }) => {
      void refreshTickets();
      const ticketIdToRefresh = payload?.ticketId ?? selectedTicketId;
      if (ticketIdToRefresh) {
        void refreshMessages(ticketIdToRefresh, { silent: true });
        void refreshScheduledMessages(ticketIdToRefresh);
      }
    };
      socket.on("connect", () => {
        void refreshDashboard();
        void refreshTickets();
        void refreshScheduledMessageOverview();
        if (selectedTicketId) {
          void refreshMessages(selectedTicketId, { silent: true });
          void refreshScheduledMessages(selectedTicketId);
        }
      });
    socket.on("connect_error", () => {
      setPanelMessage("Conexão em tempo real indisponível. O painel continua funcionando por atualização periódica.");
    });
    socket.on("ticket.updated", async (payload?: {
      ticketId?: string;
      currentAgentId?: string | null;
    }) => {
      const previousTickets = ticketsRef.current;
      const previousTicket = payload?.ticketId
        ? previousTickets.find((ticket) => ticket.id === payload.ticketId) ?? null
        : null;

      const refreshedTickets = await refreshTickets();
      const ticketIdToRefresh = payload?.ticketId ?? selectedTicketId;
      if (ticketIdToRefresh) {
        void refreshMessages(ticketIdToRefresh, { silent: true });
        void refreshScheduledMessages(ticketIdToRefresh);
      }

      if (!payload?.ticketId) {
        return;
      }

      const nextTicket = refreshedTickets.find((ticket) => ticket.id === payload.ticketId);
      if (!nextTicket) {
        return;
      }
    });
    socket.on("ticket.transferred", async (payload?: {
      ticketId?: string;
      targetUserId?: string | null;
      actorUserId?: string | null;
      actorName?: string | null;
      customerName?: string | null;
    }) => {
      if (!payload?.ticketId) {
        return;
      }

      const refreshedTickets = await refreshTickets();
      const ticketIdToRefresh = payload.ticketId ?? selectedTicketId;
      if (ticketIdToRefresh) {
        void refreshMessages(ticketIdToRefresh, { silent: true });
        void refreshScheduledMessages(ticketIdToRefresh);
      }

      if (!user || payload.targetUserId !== user.id || payload.actorUserId === user.id) {
        return;
      }

      const nextTicket = refreshedTickets.find((ticket) => ticket.id === payload.ticketId);
      const customerName = payload.customerName?.trim() || (nextTicket ? formatTicketDisplayName(nextTicket) : "um atendimento");
      const actorName = payload.actorName?.trim() || "Alguém";
      const openTransferredTicket = openTransferDialogForTicket(
        payload.ticketId,
        `${actorName} transferiu ${customerName} para você.`,
      );

      if (!browserNotificationsEnabled) {
        return;
      }

      const ticketAlreadyVisible =
        selectedTicketIdRef.current === payload.ticketId
        && activeWorkspaceRef.current === "tickets"
        && typeof document !== "undefined"
        && document.visibilityState === "visible";

      if (ticketAlreadyVisible) {
        return;
      }

      const notificationTitle = "Conversa transferida";
      const notificationBody = `${actorName} transferiu ${customerName} para voce.`;
      const notificationTag = `ticket-transfer:${payload.ticketId}`;
      const notificationIcon = nextTicket?.customerAvatarUrl || "/favicon.ico";

      if (typeof document !== "undefined" && document.visibilityState === "hidden" && browserNotificationRegistrationRef.current) {
        void browserNotificationRegistrationRef.current.showNotification(notificationTitle, {
          body: notificationBody,
          icon: notificationIcon,
          badge: "/favicon.ico",
          tag: notificationTag,
          data: {
            ticketId: payload.ticketId,
          },
        }).catch(() => {
          const fallbackNotification = new Notification(notificationTitle, {
            body: notificationBody,
            icon: notificationIcon,
            tag: notificationTag,
          });
          fallbackNotification.onclick = () => {
            openTransferredTicket();
            fallbackNotification.close();
          };
        });
        return;
      }

      const notification = new Notification(notificationTitle, {
        body: notificationBody,
        icon: notificationIcon,
        tag: notificationTag,
      });
      notification.onclick = () => {
        openTransferredTicket();
        notification.close();
      };
    });
    socket.on("ticket.closed", refreshForTicket);
    socket.on("ticket.nudged", async (payload?: {
      ticketId?: string;
      targetUserId?: string | null;
      actorUserId?: string;
      actorName?: string | null;
      customerName?: string | null;
      createdAt?: string;
      note?: string | null;
    }) => {
      if (!payload?.ticketId) {
        return;
      }

      await refreshTickets();

      if (!user || payload.targetUserId !== user.id || payload.actorUserId === user.id) {
        return;
      }

      const actorName = payload.actorName?.trim() || "Supervisão";
      const customerName = payload.customerName?.trim() || "um atendimento";
      seenTicketNudgesRef.current[payload.ticketId] = payload.createdAt ?? new Date().toISOString();
      const openNudgedTicket = openNudgeDialogForTicket(payload.ticketId, actorName, customerName, payload.createdAt);

      if (!browserNotificationsEnabled || typeof document === "undefined" || document.visibilityState !== "hidden") {
        return;
      }

      const title = "Atenção solicitada";
      const notificationBody = `${actorName} chamou sua atenção para o ticket de ${customerName}.`;
      const notificationTag = `ticket-nudge:${payload.ticketId}`;

      if (browserNotificationRegistrationRef.current) {
        void browserNotificationRegistrationRef.current.showNotification(title, {
          body: notificationBody,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          tag: notificationTag,
          data: {
            ticketId: payload.ticketId,
          },
        }).catch(() => {
          const fallbackNotification = new Notification(title, {
          body: notificationBody,
          icon: "/favicon.ico",
          tag: notificationTag,
        });
          fallbackNotification.onclick = () => {
            openNudgedTicket();
            fallbackNotification.close();
          };
        });
        return;
      }

      const notification = new Notification(title, {
        body: notificationBody,
        icon: "/favicon.ico",
        tag: notificationTag,
      });
      notification.onclick = () => {
        openNudgedTicket();
        notification.close();
      };
    });
    socket.on("message.created", async (payload?: { ticketId?: string; direction?: "inbound" | "outbound" | "system" }) => {
      const refreshedTickets = await refreshTickets();
      const ticketIdToRefresh = payload?.ticketId ?? selectedTicketIdRef.current;

      if (ticketIdToRefresh) {
        void refreshMessages(ticketIdToRefresh, { silent: true });
        void refreshScheduledMessages(ticketIdToRefresh);
      }

        if (
          payload?.direction !== "inbound"
          || !ticketIdToRefresh
          || !browserNotificationsEnabled
        ) {
        return;
      }

      const matchingTicket = refreshedTickets.find((ticket) => ticket.id === ticketIdToRefresh);
      if (!matchingTicket) {
        return;
      }

      const ticketOwnedByCurrentUser = matchingTicket.currentAgent?.id === user?.id;
      if (!ticketOwnedByCurrentUser) {
        return;
      }

      const ticketAlreadyVisible =
        selectedTicketIdRef.current === matchingTicket.id
        && activeWorkspaceRef.current === "tickets"
        && typeof document !== "undefined"
        && document.visibilityState === "visible";

      if (ticketAlreadyVisible) {
        return;
      }

      const notificationTitle = formatTicketDisplayName(matchingTicket);
      const notificationBody = matchingTicket.lastMessagePreview
        ? formatMessagePreview(matchingTicket.lastMessagePreview)
        : "Nova mensagem recebida.";
      const notificationUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/?ticketId=${encodeURIComponent(matchingTicket.id)}`
          : `/?ticketId=${encodeURIComponent(matchingTicket.id)}`;

        const openMatchingTicket = () => {
          openTicketFromNotification(matchingTicket);
        };

          const notificationData = {
            ticketId: matchingTicket.id,
            url: notificationUrl,
            customerName: matchingTicket.customerName,
          };
          const notificationIcon = matchingTicket.customerAvatarUrl || "/favicon.ico";

          if (typeof document !== "undefined" && document.visibilityState === "hidden" && browserNotificationRegistrationRef.current) {
            void browserNotificationRegistrationRef.current.showNotification(notificationTitle, {
              body: notificationBody,
              icon: notificationIcon,
              badge: "/favicon.ico",
              tag: `ticket:${matchingTicket.id}`,
              data: notificationData,
            }).catch(() => {
              const fallbackNotification = new Notification(notificationTitle, {
                body: notificationBody,
                icon: notificationIcon,
                tag: `ticket:${matchingTicket.id}`,
              });

            fallbackNotification.onclick = () => {
              openMatchingTicket();
              fallbackNotification.close();
            };
          });
          return;
        }

          const notification = new Notification(notificationTitle, {
            body: notificationBody,
            icon: notificationIcon,
            tag: `ticket:${matchingTicket.id}`,
          });

        notification.onclick = () => {
          openMatchingTicket();
          notification.close();
        };
    });
    socket.on("message.updated", refreshForTicket);
    socket.on("instance.updated", () => void refreshInstances());
    socket.on("agent.updated", () => void refreshAgents());
    socket.on("queue.updated", () => void refreshQueues());

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    }, [browserNotificationsEnabled, browserPushEnabled, openNudgeDialogForTicket, openTicketFromNotification, openTransferDialogForTicket, refreshAgents, refreshDashboard, refreshInstances, refreshMessages, refreshQueues, refreshScheduledMessageOverview, refreshScheduledMessages, refreshTickets, selectedTicketId, user]);

  React.useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

        void refreshDashboard();
        void refreshTickets();
        void refreshScheduledMessageOverview();
        if (selectedTicketId) {
          void refreshMessages(selectedTicketId, { silent: true });
          void refreshScheduledMessages(selectedTicketId);
        }

      if (user.role === "admin") {
        void refreshInstances();
        void refreshAgents();
        void refreshQueues();
      }
    }, 5000);

    return () => clearInterval(interval);
    }, [refreshAgents, refreshDashboard, refreshInstances, refreshMessages, refreshQueues, refreshScheduledMessageOverview, refreshScheduledMessages, refreshTickets, selectedTicketId, user]);

  React.useEffect(() => {
    if (!user) return;

      const handleVisibilityOrFocus = () => {
        void refreshDashboard();
        void refreshTickets();
        void refreshScheduledMessageOverview();
        if (selectedTicketId) {
          void refreshMessages(selectedTicketId, { silent: true });
          void refreshScheduledMessages(selectedTicketId);
        }
      };

    if (typeof window !== "undefined") {
      window.addEventListener("focus", handleVisibilityOrFocus);
    }

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", handleVisibilityOrFocus);
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      }
    };
    }, [refreshDashboard, refreshMessages, refreshScheduledMessageOverview, refreshScheduledMessages, refreshTickets, selectedTicketId, user]);

  React.useEffect(() => {
    if (!messagesViewportRef.current || !shouldStickMessagesToBottomRef.current) {
      return;
    }

    messagesViewportRef.current.scrollTo({
      top: messagesViewportRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function handleBootstrap(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError(null);
    try {
      await apiFetch("/auth/bootstrap", {
        method: "POST",
        body: JSON.stringify(bootstrapForm),
      });
      setMode("login");
      setLoginForm({ email: bootstrapForm.email, password: bootstrapForm.password });
      setPanelMessage("Administrador inicial criado. Faça login para continuar.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Falha ao criar administrador inicial.");
    }
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError(null);
    try {
      await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify(loginForm),
      });
      await refreshAuth();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Falha ao fazer login.");
    }
  }

  async function handleLogout() {
    if (typeof window !== "undefined") {
      try {
        await fetch("/logout", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
        });
      } finally {
        window.location.replace("/");
      }
      return;
    }

    setUser(null);
    setMode("login");
  }

  async function handleProfileAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setPanelMessage("Selecione um arquivo de imagem válido para o avatar.");
      return;
    }

    if (file.size > 1_500_000) {
      setPanelMessage("O avatar deve ter no máximo 1,5 MB.");
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Falha ao ler o arquivo do avatar."));
      reader.readAsDataURL(file);
    });

    setProfileAvatarPreview(dataUrl);
    setPanelMessage("Avatar pronto para salvar.");
  }

  async function handleBrandLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setPanelMessage("Selecione um arquivo de imagem válido para o logo.");
      return;
    }

    if (file.size > 2_000_000) {
      setPanelMessage("O logo deve ter no máximo 2 MB.");
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Falha ao ler o arquivo do logo."));
      reader.readAsDataURL(file);
    });

    setBrandLogoPreview(dataUrl);
    setBrandMode("image");

    if (typeof window !== "undefined") {
      window.localStorage.setItem(BRAND_MODE_STORAGE_KEY, "image");
      window.localStorage.setItem(BRAND_LOGO_STORAGE_KEY, dataUrl);
    }

    setPanelMessage("Logo atualizado no painel.");
  }

  function handleRemoveBrandLogo() {
    setBrandLogoPreview(null);

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(BRAND_LOGO_STORAGE_KEY);
    }

    if (brandMode === "image") {
      setBrandMode("default");

      if (typeof window !== "undefined") {
        window.localStorage.setItem(BRAND_MODE_STORAGE_KEY, "default");
      }
    }

    setPanelMessage("Logo removido. O painel voltou para a marca padrão.");
  }

  function handleBrandModeChange(nextMode: "default" | "image" | "text") {
    setBrandMode(nextMode);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(BRAND_MODE_STORAGE_KEY, nextMode);
    }
  }

  function handleBrandTextChange(value: string) {
    const normalizedValue = value.slice(0, 36);
    setBrandText(normalizedValue);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(BRAND_TEXT_STORAGE_KEY, normalizedValue);
    }
  }

  async function readFileAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error(`Falha ao ler o arquivo ${file.name}.`));
      reader.readAsDataURL(file);
    });
  }

  async function buildComposerAttachmentFromFile(file: File) {
    const kind: ComposerAttachment["kind"] =
      file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("audio/")
          ? "audio"
          : "document";

    const dataUrl = await readFileAsDataUrl(file);
    const normalizedMimeType = (file.type.split(";")[0] || "").trim();

    return {
      kind,
      fileName: file.name,
      mimeType: normalizedMimeType || (kind === "image" ? "image/jpeg" : kind === "audio" ? "audio/ogg" : "application/octet-stream"),
      sizeBytes: file.size,
      dataUrl,
    } satisfies ComposerAttachment;
  }

  function serializeComposerAttachment(attachment: ComposerAttachment) {
    return {
      kind: attachment.kind,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      dataUrl: attachment.dataUrl,
    };
  }

  async function applyComposerFiles(fileList: File[], sourceLabel = "Arquivo") {
    if (fileList.length === 0) {
      return false;
    }

    if (isEditingMessage) {
      setPanelMessage("Finalize a edição atual antes de anexar arquivos.");
      return false;
    }

    if (composerInternalNoteMode) {
      setPanelMessage("Observações internas não aceitam anexos.");
      return false;
    }

    const oversizedFile = fileList.find((file) => file.size > 12_000_000);
    if (oversizedFile) {
      setPanelMessage(`O arquivo ${oversizedFile.name} deve ter no máximo 12 MB.`);
      return false;
    }

    const attachments = await Promise.all(fileList.map((file) => buildComposerAttachmentFromFile(file)));
    setComposerAttachments((current) => [...current, ...attachments]);
    setShowEmojiPicker(false);
    setReplyToMessageId(null);

    const totalAttachments = composerAttachments.length + attachments.length;
    const pluralLabel = attachments.length > 1 || totalAttachments > 1 ? "arquivos" : "arquivo";
    setPanelMessage(
      sourceLabel === "Área de transferência"
        ? `${attachments.length} ${pluralLabel} colado(s) e pronto(s) para envio.`
        : sourceLabel === "Arrastar e soltar"
          ? `${attachments.length} ${pluralLabel} solto(s) e pronto(s) para envio.`
          : `${attachments.length} ${pluralLabel} pronto(s) para envio.`,
    );

    return true;
  }

  async function applyComposerFile(file: File, sourceLabel = "Arquivo") {
    return applyComposerFiles([file], sourceLabel);
  }

  function resetForwardState() {
    setShowForwardModal(false);
    setForwardLoading(false);
    setForwardMessageId(null);
    setForwardSearch("");
    setSelectedForwardDestinationKeys([]);
  }

  async function handleComposerAttachmentChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.currentTarget.value = "";

    if (files.length === 0) return;
    await applyComposerFiles(files, "Seletor de arquivos");
  }

  function clearComposerAttachment(index?: number) {
    if (typeof index !== "number") {
      setComposerAttachments([]);
      return;
    }

    setComposerAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function toggleComposerInternalNoteMode() {
    if (isEditingMessage) {
      return;
    }

    setComposerInternalNoteMode((current) => {
      const next = !current;
      if (next) {
        setComposerAttachments([]);
        setReplyToMessageId(null);
        setShowEmojiPicker(false);
      }
      return next;
    });
  }

  function handleStartEditingMessage(message: MessageItem) {
    if (!canSendToSelectedTicket) {
      return;
    }

    setReplyToMessageId(null);
    setEditingMessageId(message.id);
    setComposerAttachments([]);
    setComposerInternalNoteMode(Boolean(message.internalNote));
    setShowEmojiPicker(false);
    setMessageInput(stripAgentSignature((message.body ?? "").trim(), currentUser.name).trim());
    setPanelMessage("Modo de edição ativado.");
  }

  function handleStartReplyingToMessage(message: MessageItem) {
    if (!canSendToSelectedTicket || message.direction === "system" || message.internalNote) {
      return;
    }

    setEditingMessageId(null);
    setReplyToMessageId(message.id);
    setComposerInternalNoteMode(false);
    setShowEmojiPicker(false);
    setPanelMessage("Respondendo mensagem.");
  }

  function cancelEditingMessage() {
    setEditingMessageId(null);
    setComposerInternalNoteMode(false);
    setMessageInput("");
    setPanelMessage("Edição cancelada.");
  }

  function cancelReplyToMessage() {
    setReplyToMessageId(null);
    setPanelMessage("Resposta cancelada.");
  }

  function handleOpenForwardModal(message: MessageItem) {
    if (message.direction === "system" || message.internalNote || message.deleted?.isDeleted) {
      return;
    }

    setOpenMessageMenuId(null);
    setMessageMenuPosition(null);
    setForwardMessageId(message.id);
    setForwardSearch("");
    setSelectedForwardDestinationKeys([]);
    setShowForwardModal(true);
  }

  function toggleForwardDestinationSelection(key: string) {
    setSelectedForwardDestinationKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  function openMessageMenuForButton(params: {
    event: React.MouseEvent<HTMLButtonElement>;
    messageId: string;
    outgoing: boolean;
    estimatedHeight: number;
  }) {
    if (messageBulkSelectionMode) {
      return;
    }

    params.event.stopPropagation();

    if (openMessageMenuId === params.messageId) {
      setOpenMessageMenuId(null);
      setMessageMenuPosition(null);
      return;
    }

    const rect = params.event.currentTarget.getBoundingClientRect();
    const viewportPadding = 16;
    const menuWidth = 224;
    const fitsBelow = rect.bottom + 8 + params.estimatedHeight + viewportPadding <= window.innerHeight;
    const top = fitsBelow
      ? rect.bottom + 8
      : Math.max(viewportPadding, rect.top - params.estimatedHeight - 8);
    const left = params.outgoing
      ? Math.max(viewportPadding, rect.right - menuWidth)
      : Math.min(window.innerWidth - menuWidth - viewportPadding, rect.left);

    setMessageMenuPosition({ top, left });
    setOpenMessageMenuId(params.messageId);
  }

  function toggleTicketBulkSelection(ticketId: string) {
    setSelectedTicketIdsForBulkDelete((current) =>
      current.includes(ticketId)
        ? current.filter((id) => id !== ticketId)
        : [...current, ticketId],
    );
  }

  function toggleAllVisibleTicketBulkSelection() {
    const visibleTicketIds = visibleTickets.map((ticket) => ticket.id);

    if (visibleTicketIds.length === 0) {
      return;
    }

    setSelectedTicketIdsForBulkDelete((current) => {
      const allVisibleSelected = visibleTicketIds.every((ticketId) => current.includes(ticketId));

      if (allVisibleSelected) {
        return current.filter((ticketId) => !visibleTicketIds.includes(ticketId));
      }

      return Array.from(new Set([...current, ...visibleTicketIds]));
    });
  }

  function toggleMessageBulkSelection(messageId: string) {
    setSelectedMessageIdsForBulkDelete((current) =>
      current.includes(messageId)
        ? current.filter((id) => id !== messageId)
        : [...current, messageId],
    );
  }

  async function handleToggleAudioRecording() {
    if (!canSendToSelectedTicket || sendLoading || isEditingMessage) return;

    if (recordingAudio) {
      audioRecorderRef.current?.stop();
      return;
    }

    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setPanelMessage("Gravação de áudio não é suportada neste navegador.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
          ? "audio/ogg;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "";
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      audioChunksRef.current = [];
      audioStreamRef.current = stream;
      audioRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setRecordingAudio(false);
        audioStreamRef.current?.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
        audioRecorderRef.current = null;
        audioChunksRef.current = [];
        setPanelMessage("Falha ao gravar áudio.");
      };

      recorder.onstop = async () => {
        const recordedMimeType = recorder.mimeType || "audio/webm";
        const extension = recordedMimeType.includes("ogg") ? "ogg" : recordedMimeType.includes("mp4") ? "m4a" : "webm";
        const blob = new Blob(audioChunksRef.current, { type: recordedMimeType });

        audioStreamRef.current?.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
        audioRecorderRef.current = null;
        audioChunksRef.current = [];
        setRecordingAudio(false);

        if (!blob.size) {
          setPanelMessage("Nenhum áudio foi capturado.");
          return;
        }

        if (blob.size > 12_000_000) {
          setPanelMessage("O áudio gravado deve ter no máximo 12 MB.");
          return;
        }

        const normalizedRecordedMimeType = recordedMimeType.split(";")[0] || recordedMimeType;
        const file = new File([blob], `audio-${Date.now()}.${extension}`, { type: normalizedRecordedMimeType });
        const attachment = await buildComposerAttachmentFromFile(file);
        setComposerAttachments([attachment]);
        setPanelMessage("Áudio gravado e pronto para envio.");
      };

      recorder.start();
      setRecordingAudio(true);
      setShowEmojiPicker(false);
      setPanelMessage("Gravação iniciada.");
    } catch (error) {
      setRecordingAudio(false);
      audioStreamRef.current?.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
      audioRecorderRef.current = null;
      audioChunksRef.current = [];
      setPanelMessage(error instanceof Error ? error.message : "Não foi possível acessar o microfone.");
    }
  }

  async function handleSaveProfile() {
    if (!user) return;

    setProfileSaving(true);
    try {
      const payload = await apiFetch<{ message: string; user: AuthUser }>("/auth/me/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name: profileName.trim(),
          avatarUrl: profileAvatarPreview,
        }),
      });

      setUser(payload.user);
      setProfileName(payload.user.name);
      setProfileAvatarPreview(payload.user.avatarUrl ?? null);
      setPanelMessage(payload.message);
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao atualizar o perfil.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleSendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTicketId) return;

    const trimmedInput = messageInput.trim();
    if (!trimmedInput && composerAttachments.length === 0) return;
    const shortcutMatch = trimmedInput.match(/^\/([a-z0-9_-]+)$/i);
    const resolvedBody =
      shortcutMatch
        ? quickReplies.find((item) => item.isActive && item.shortcut.toLowerCase() === shortcutMatch[1].toLowerCase())?.content ?? trimmedInput
        : trimmedInput;

    setSendLoading(true);
    try {
      if (editingMessageId) {
        await apiFetch(`/tickets/${selectedTicketId}/messages/${editingMessageId}`, {
          method: "PATCH",
          body: JSON.stringify({
            body: resolvedBody,
          }),
        });
        setPanelMessage("Mensagem editada.");
      } else {
        if (composerAttachments.length <= 1) {
          await apiFetch(`/tickets/${selectedTicketId}/messages`, {
            method: "POST",
            body: JSON.stringify({
              body: resolvedBody,
              internalNote: composerInternalNoteMode,
              replyToMessageId: replyToMessageId ?? undefined,
              attachment: composerAttachments[0] ? serializeComposerAttachment(composerAttachments[0]) : undefined,
            }),
          });
        } else {
          for (const [index, attachment] of composerAttachments.entries()) {
            await apiFetch(`/tickets/${selectedTicketId}/messages`, {
              method: "POST",
              body: JSON.stringify({
                body: index === 0 ? resolvedBody : "",
                internalNote: composerInternalNoteMode,
                replyToMessageId: index === 0 ? (replyToMessageId ?? undefined) : undefined,
                attachment: serializeComposerAttachment(attachment),
              }),
            });
          }
        }
      }

      setEditingMessageId(null);
      setReplyToMessageId(null);
      setComposerInternalNoteMode(false);
      setMessageInput("");
      setComposerAttachments([]);
      await refreshMessages(selectedTicketId);
      await refreshTickets();
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : editingMessageId ? "Falha ao editar mensagem." : "Falha ao enviar mensagem.");
    } finally {
      setSendLoading(false);
    }
  }

  async function handleScheduleMessage() {
    if (!selectedTicketId) return;

    const trimmedInput = messageInput.trim();
    if (!trimmedInput && composerAttachments.length === 0) {
      setPanelMessage("Escreva uma mensagem ou anexe um arquivo antes de agendar.");
      return;
    }

    if (composerAttachments.length > 1) {
      setPanelMessage("O agendamento ainda aceita apenas um anexo por mensagem.");
      return;
    }

    const shortcutMatch = trimmedInput.match(/^\/([a-z0-9_-]+)$/i);
    const resolvedBody =
      shortcutMatch
        ? quickReplies.find((item) => item.isActive && item.shortcut.toLowerCase() === shortcutMatch[1].toLowerCase())?.content ?? trimmedInput
        : trimmedInput;

    setScheduleLoading(true);
    try {
      await apiFetch(`/tickets/${selectedTicketId}/scheduled-messages`, {
        method: "POST",
        body: JSON.stringify({
          body: resolvedBody,
          internalNote: composerInternalNoteMode,
          replyToMessageId: replyToMessageId ?? undefined,
          sendAt: new Date(scheduleForm.sendAt).toISOString(),
          attachment: composerAttachments[0] ? serializeComposerAttachment(composerAttachments[0]) : undefined,
        }),
      });

      setEditingMessageId(null);
      setReplyToMessageId(null);
      setComposerInternalNoteMode(false);
      setMessageInput("");
      setComposerAttachments([]);
      setShowScheduleModal(false);
      await refreshScheduledMessages(selectedTicketId);
      await refreshScheduledMessageOverview();
      setPanelMessage("Mensagem agendada com sucesso.");
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao agendar mensagem.");
    } finally {
      setScheduleLoading(false);
    }
  }

  async function handleCancelScheduledMessage(scheduledMessageId: string) {
    if (!selectedTicketId) return;

    const confirmed = await openConfirmDialog({
      title: "Cancelar mensagem agendada",
      description: "Essa mensagem não será mais enviada automaticamente.",
      confirmLabel: "Cancelar agendamento",
      cancelLabel: "Voltar",
      tone: "danger",
    });

    if (!confirmed) {
      return;
    }

    setScheduleLoading(true);
    try {
      await apiFetch(`/tickets/${selectedTicketId}/scheduled-messages/${scheduledMessageId}`, {
        method: "DELETE",
      });
      await refreshScheduledMessages(selectedTicketId);
      await refreshScheduledMessageOverview();
      setPanelMessage("Mensagem agendada cancelada.");
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao cancelar mensagem agendada.");
    } finally {
      setScheduleLoading(false);
    }
  }

  function handleOpenScheduledMessageEditor(item: ScheduledMessageItem) {
    setScheduledMessageEditor({
      id: item.id,
      ticketId: item.ticketId,
      title: item.ticket?.customerName ?? "Mensagem agendada",
      body: item.body ?? "",
      sendAt: toDateTimeLocalValue(new Date(item.sendAt)),
      attachmentLabel: item.attachment ? `[${item.attachment.kind}] ${item.attachment.fileName}` : null,
    });
  }

  async function handleSaveScheduledMessageEdit() {
    if (!scheduledMessageEditor) return;

    setScheduleLoading(true);
    try {
      await apiFetch(`/scheduled-messages/${scheduledMessageEditor.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          body: scheduledMessageEditor.body,
          sendAt: new Date(scheduledMessageEditor.sendAt).toISOString(),
        }),
      });

      if (selectedTicketId === scheduledMessageEditor.ticketId) {
        await refreshScheduledMessages(scheduledMessageEditor.ticketId);
      }
      await refreshScheduledMessageOverview();
      setScheduledMessageEditor(null);
      setPanelMessage("Mensagem agendada atualizada.");
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao atualizar mensagem agendada.");
    } finally {
      setScheduleLoading(false);
    }
  }

  async function handleDeleteScheduledMessageFromAgenda(item: ScheduledMessageItem) {
    setScheduleLoading(true);
    try {
      await apiFetch(`/scheduled-messages/${item.id}`, {
        method: "DELETE",
      });

      if (selectedTicketId === item.ticketId) {
        await refreshScheduledMessages(item.ticketId);
      }
      await refreshScheduledMessageOverview();
      setScheduledMessageDeleteTarget(null);
      setPanelMessage("Mensagem agendada excluída.");
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao excluir mensagem agendada.");
    } finally {
      setScheduleLoading(false);
    }
  }

  function buildForwardBodyFromMessage(message: MessageItem) {
    const rawBody = (message.body ?? "").trim();
    if (!rawBody) return "";

    const normalizedBody = message.direction === "outbound" && !message.internalNote
      ? parseMessageSignature(rawBody).body.trim()
      : rawBody;

    if (!message.attachments?.length) {
      return normalizedBody;
    }

    if (
      /^imagem recebida$/i.test(normalizedBody)
      || /^audio recebido$/i.test(normalizedBody)
      || /^video recebido$/i.test(normalizedBody)
      || /^documento recebido$/i.test(normalizedBody)
      || /^sticker recebido$/i.test(normalizedBody)
      || /^\[(image|audio|document|video)\]\s/i.test(normalizedBody)
    ) {
      return "";
    }

    return normalizedBody;
  }

  async function resolveForwardDestinationTicketId(destination: ForwardDestination) {
    if (destination.ticketId) {
      return destination.ticketId;
    }

    const resolvedPhone = onlyPhoneDigits(destination.phone ?? "");
    if (!resolvedPhone) {
      throw new Error("Selecione um destino válido para encaminhar.");
    }

    const instanceId = destination.instanceId ?? selectedTicket?.whatsappInstance.id ?? instances[0]?.id ?? "";
    if (!instanceId) {
      throw new Error("Nenhuma instância disponível para encaminhar a mensagem.");
    }

    const existingTicket = tickets.find((ticket) => {
      if (ticket.status === "closed") return false;
      if (ticket.whatsappInstance.id !== instanceId) return false;
      const ticketDigits = onlyPhoneDigits(ticket.externalContactId ?? ticket.externalChatId);
      return ticketDigits === resolvedPhone;
    });

    if (existingTicket) {
      return existingTicket.id;
    }

    const customer = destination.customerId
      ? customers.find((item) => item.id === destination.customerId) ?? null
      : null;

    const payload = await apiFetch<CreateConversationResponse>("/tickets", {
      method: "POST",
      body: JSON.stringify({
        customerName: customer?.name ?? destination.label,
        phone: resolvedPhone,
        whatsappInstanceId: instanceId,
        queueId: null,
      }),
    });

    await refreshTickets();
    return payload.item.id;
  }

  async function handleConfirmForwardMessage() {
    if (!forwardSourceMessage || !selectedTicketId) return;

    setForwardLoading(true);
    try {
      if ((forwardSourceMessage.attachments?.length ?? 0) > 1) {
        throw new Error("O encaminhamento ainda aceita apenas uma anexo por mensagem.");
      }
      if (selectedForwardDestinations.length === 0) {
        throw new Error("Selecione ao menos um destino para encaminhar.");
      }

      for (const destination of selectedForwardDestinations) {
        const targetTicketId = await resolveForwardDestinationTicketId(destination);

        await apiFetch(`/tickets/${selectedTicketId}/messages/${forwardSourceMessage.id}/forward`, {
          method: "POST",
          body: JSON.stringify({
            targetTicketId,
          }),
        });
      }

      resetForwardState();
      setPanelMessage(`Mensagem encaminhada para ${selectedForwardDestinations.length} destino(s).`);
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao encaminhar mensagem.");
    } finally {
      setForwardLoading(false);
    }
  }

  async function handleComposerPaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.files ?? []);
    const fallbackFile = Array.from(event.clipboardData.items ?? [])
      .find((item) => item.kind === "file")
      ?.getAsFile()
      ?? null;
    const normalizedFiles = files.length > 0 ? files : (fallbackFile ? [fallbackFile] : []);

    if (normalizedFiles.length === 0) {
      return;
    }

    event.preventDefault();
    await applyComposerFiles(normalizedFiles, "Área de transferência");
  }

  function handleComposerDragEnter(event: React.DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    composerDragDepthRef.current += 1;
    setComposerDragActive(true);
  }

  function handleComposerDragOver(event: React.DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    if (!composerDragActive) {
      setComposerDragActive(true);
    }
  }

  function handleComposerDragLeave(event: React.DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    composerDragDepthRef.current = Math.max(0, composerDragDepthRef.current - 1);
    if (composerDragDepthRef.current === 0) {
      setComposerDragActive(false);
    }
  }

  async function handleComposerDrop(event: React.DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    composerDragDepthRef.current = 0;
    setComposerDragActive(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length === 0) return;
    await applyComposerFiles(files, "Arrastar e soltar");
  }

  async function handleAcceptTicket() {
    if (!selectedTicketId) return;

    try {
      const acceptedTicketId = selectedTicketId;
      const acceptedTicket = tickets.find((ticket) => ticket.id === acceptedTicketId) ?? null;
      await apiFetch(`/tickets/${selectedTicketId}/accept`, { method: "POST" });
      await refreshTickets();
      await refreshMessages(acceptedTicketId);
      setSelectedTicketId(acceptedTicketId);
      setActiveWorkspace("tickets");
      setShowAllTickets(false);
      setActiveTab(acceptedTicket?.isGroup ? "grupos" : "atendendo");
      setPanelMessage("Atendimento assumido com sucesso.");
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao assumir ticket.");
    }
  }

  async function handleCloseTicket() {
    if (!selectedTicketId) return;

    try {
      await apiFetch(`/tickets/${selectedTicketId}/close`, { method: "POST" });
      await refreshTickets();
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao encerrar ticket.");
    }
  }

  async function handleReopenTicket() {
    if (!selectedTicketId) return;

    try {
      await apiFetch(`/tickets/${selectedTicketId}/reopen`, { method: "POST" });
      await refreshTickets();
      await refreshMessages(selectedTicketId);
      setPanelMessage("Ticket reaberto com sucesso.");
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao reabrir ticket.");
    }
  }

  async function handleTransferTicket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTicketId) return;

    setTransferLoading(true);
    try {
        await apiFetch(`/tickets/${selectedTicketId}/transfer`, {
          method: "POST",
          body: JSON.stringify({
            agentId: transferForm.agentId || null,
            queueId: transferForm.queueId || null,
            note: transferForm.note,
          }),
        });

        await refreshTickets();
        setShowTransferPanel(false);
        setTransferForm({
          agentId: "",
          queueId: "",
          note: "",
        });
        setPanelMessage("Ticket transferido com sucesso.");
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao transferir ticket.");
    } finally {
      setTransferLoading(false);
    }
  }

  async function handleNudgeTicket() {
    if (!selectedTicketId || !selectedTicket || !canNudgeSelectedTicket) return;

    setNudgeLoading(true);
    try {
      await apiFetch(`/tickets/${selectedTicketId}/nudge`, {
        method: "POST",
        body: JSON.stringify({
          note: "",
        }),
      });
      setPanelMessage(`Alerta enviado para ${selectedTicket.currentAgent?.name ?? "o responsável"}.`);
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao chamar a atenção do responsável.");
    } finally {
      setNudgeLoading(false);
    }
  }

  async function openTicketHistoryViewer(ticket: TicketItem) {
    setTicketHistoryViewer({
      ticketId: ticket.id,
      customerName: ticket.customerName,
      loading: true,
      items: [],
    });

    try {
      const data = await apiFetch<{
        item?: { customerName?: string | null };
        items?: TicketHistoryItem[];
      }>(`/tickets/${ticket.id}/history`);

      setTicketHistoryViewer({
        ticketId: ticket.id,
        customerName: data?.item?.customerName ?? ticket.customerName,
        loading: false,
        items: Array.isArray(data?.items) ? data.items : [],
      });
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao carregar o histórico do ticket.");
      setTicketHistoryViewer(null);
    }
  }

  function applyQuickReply(item: QuickReplyItem) {
    setMessageInput((current) => current.replace(/(?:^|\s)\/([a-z0-9_-]*)$/i, (match) => match.replace(/\/([a-z0-9_-]*)$/i, item.content)));
  }

  function applyDynamicField(item: DynamicFieldSuggestion) {
    setMessageInput((current) => {
      const nextMessage = insertDynamicFieldTokenAtCursor(current, item.token, messageCursorPosition);
      const nextCursorPosition = nextMessage.lastIndexOf(`{{${item.token}}}`) + item.token.length + 4;
      setMessageCursorPosition(nextCursorPosition);
      return nextMessage;
    });
  }

  function applyQuickReplyDynamicField(item: DynamicFieldSuggestion) {
    setQuickReplyForm((current) => {
      const nextContent = insertDynamicFieldTokenAtCursor(current.content, item.token, quickReplyCursorPosition);
      const nextCursorPosition = nextContent.lastIndexOf(`{{${item.token}}}`) + item.token.length + 4;
      setQuickReplyCursorPosition(nextCursorPosition);
      return {
        ...current,
        content: nextContent,
      };
    });
  }

  function applyAutomationDynamicField(item: DynamicFieldSuggestion) {
    setAutomationForm((current) => {
      const nextMessage = insertDynamicFieldTokenAtCursor(current.actionMessage, item.token, automationMessageCursorPosition);
      const nextCursorPosition = nextMessage.lastIndexOf(`{{${item.token}}}`) + item.token.length + 4;
      setAutomationMessageCursorPosition(nextCursorPosition);
      return {
        ...current,
        actionMessage: nextMessage,
      };
    });
  }

  async function handleReactToMessage(messageId: string, emoji: string) {
    if (!selectedTicketId || !canSendToSelectedTicket) {
      return;
    }

    try {
      await apiFetch(`/tickets/${selectedTicketId}/messages/${messageId}/reactions`, {
        method: "POST",
        body: JSON.stringify({ emoji }),
      });
      await refreshMessages(selectedTicketId);
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao reagir à mensagem.");
    }
  }

  async function handleDeleteMessage(messageId: string) {
    if (!selectedTicketId || !canSendToSelectedTicket) {
      return;
    }

    if (!(await openConfirmDialog({
      title: "Apagar mensagem para todos",
      description: "Essa ação tenta remover a mensagem para todos os participantes da conversa.",
      confirmLabel: "Apagar para todos",
      cancelLabel: "Cancelar",
      tone: "danger",
    }))) {
      return;
    }

    try {
      await apiFetch(`/tickets/${selectedTicketId}/messages/${messageId}/delete`, {
        method: "POST",
      });
      await refreshMessages(selectedTicketId);
      await refreshTickets();
      setPanelMessage("Mensagem apagada para todos.");
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao apagar a mensagem.");
    }
  }

  async function handleDeleteMessageForMe(messageId: string) {
    if (!selectedTicketId) {
      return;
    }

    if (!(await openConfirmDialog({
      title: "Apagar mensagem para você",
      description: "A mensagem será removida apenas da sua visualização no painel.",
      confirmLabel: "Apagar para mim",
      cancelLabel: "Cancelar",
      tone: "danger",
    }))) {
      return;
    }

    try {
      await apiFetch(`/tickets/${selectedTicketId}/messages/${messageId}/delete-local`, {
        method: "POST",
      });
      await refreshMessages(selectedTicketId);
      setPanelMessage("Mensagem apagada para você.");
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao apagar a mensagem para você.");
    }
  }

  function startTicketBulkSelectionMode() {
    setTicketBulkSelectionMode(true);
    setSelectedTicketIdsForBulkDelete([]);
    setPanelMessage("Selecione os tickets que deseja apagar em lote.");
  }

  function cancelTicketBulkSelectionMode() {
    setTicketBulkSelectionMode(false);
    setSelectedTicketIdsForBulkDelete([]);
  }

  function startMessageBulkSelectionMode() {
    if (!selectedTicketId) {
      return;
    }

    setMessageBulkSelectionMode(true);
    setSelectedMessageIdsForBulkDelete([]);
    setOpenMessageMenuId(null);
    setMessageMenuPosition(null);
    setPanelMessage("Selecione as mensagens que deseja apagar em lote.");
  }

  function cancelMessageBulkSelectionMode() {
    setMessageBulkSelectionMode(false);
    setSelectedMessageIdsForBulkDelete([]);
  }

  async function handleBulkDeleteTickets() {
    if (!canBulkDeleteTickets || selectedTicketIdsForBulkDelete.length === 0) {
      return;
    }

    const confirmed = await openConfirmDialog({
      title: "Apagar tickets em lote",
      description: `Apagar ${selectedTicketIdsForBulkDelete.length} ticket(s) selecionado(s)? Esta ação remove o histórico desses tickets no painel.`,
      confirmLabel: "Apagar tickets",
      cancelLabel: "Cancelar",
      tone: "danger",
    });

    if (!confirmed) {
      return;
    }

    setBulkDeleteLoading(true);
    try {
      await apiFetch("/tickets/bulk-delete", {
        method: "POST",
        body: JSON.stringify({
          ticketIds: selectedTicketIdsForBulkDelete,
        }),
      });
      cancelTicketBulkSelectionMode();
      await refreshTickets();
      setPanelMessage("Tickets apagados em lote.");
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao apagar tickets em lote.");
    } finally {
      setBulkDeleteLoading(false);
    }
  }

  async function handleBulkDeleteMessages() {
    if (!selectedTicketId || !canBulkDeleteMessages || selectedMessageIdsForBulkDelete.length === 0) {
      return;
    }

    const confirmed = await openConfirmDialog({
      title: "Apagar mensagens em lote",
      description: `Apagar ${selectedMessageIdsForBulkDelete.length} mensagem(ns) selecionada(s)? Esta ação remove essas mensagens do ticket no painel.`,
      confirmLabel: "Apagar mensagens",
      cancelLabel: "Cancelar",
      tone: "danger",
    });

    if (!confirmed) {
      return;
    }

    setBulkDeleteLoading(true);
    try {
      await apiFetch(`/tickets/${selectedTicketId}/messages/bulk-delete`, {
        method: "POST",
        body: JSON.stringify({
          messageIds: selectedMessageIdsForBulkDelete,
        }),
      });
      cancelMessageBulkSelectionMode();
      await refreshMessages(selectedTicketId);
      await refreshTickets();
      setPanelMessage("Mensagens apagadas em lote.");
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao apagar mensagens em lote.");
    } finally {
      setBulkDeleteLoading(false);
    }
  }

  async function handleDeleteSelectedTicket() {
    if (!selectedTicketId || !canDeleteSelectedTicket) {
      return;
    }

    const confirmed = await openConfirmDialog({
      title: "Apagar ticket",
      description: `Apagar o ticket de ${selectedTicket?.customerName ?? "contato"}? Esta ação remove o histórico deste ticket no painel.`,
      confirmLabel: "Apagar ticket",
      cancelLabel: "Cancelar",
      tone: "danger",
    });

    if (!confirmed) {
      return;
    }

    setBulkDeleteLoading(true);
    try {
      await apiFetch(`/tickets/${selectedTicketId}/delete`, {
        method: "POST",
      });
      setSelectedTicketId(null);
      setMessages([]);
      setShowTicketDetails(false);
      await refreshTickets();
      setPanelMessage("Ticket apagado.");
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao apagar ticket.");
    } finally {
      setBulkDeleteLoading(false);
    }
  }

  async function handleSaveSelectedGroupName() {
    if (!selectedTicket || !selectedTicket.isGroup || groupNameSaving) {
      return;
    }

    setGroupNameSaving(true);
    try {
      await apiFetch(`/tickets/${selectedTicket.id}/group-name`, {
        method: "PATCH",
        body: JSON.stringify({
          name: groupNameInput.trim() || null,
        }),
      });
      await refreshTickets();
      setShowGroupNameModal(false);
      setPanelMessage("Nome manual do grupo atualizado.");
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao salvar o nome manual do grupo.");
    } finally {
      setGroupNameSaving(false);
    }
  }

  function insertEmoji(emoji: string) {
    setMessageInput((current) => `${current}${emoji}`);
    setShowEmojiPicker(false);
  }

  function handleMessagesScroll(event: React.UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    shouldStickMessagesToBottomRef.current = distanceToBottom < 80;
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!sendLoading && canSendToSelectedTicket && (messageInput.trim() || composerAttachments.length > 0)) {
        void handleSendMessage(event as unknown as React.FormEvent<HTMLFormElement>);
      }
    }
  }

  React.useEffect(() => {
    setComposerInternalNoteMode(false);
    setComposerAttachments([]);
    setReplyToMessageId(null);
    setEditingMessageId(null);
    setMessageInput("");
  }, [selectedTicketId]);

  function resetInstanceForm() {
    setEditingInstanceId(null);
    setInstanceForm({
      name: "",
      evolutionInstanceName: "",
      baseUrl: "",
      apiKey: "",
      webhookSecret: "",
      defaultQueueId: "",
    });
  }

  function resetAgentForm() {
    setEditingAgentId(null);
    setDuplicatingAgentName(null);
    setAgentForm({
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: "agent",
      queueIds: [],
      permissions: defaultPermissionsForRole("agent"),
      isBotAgent: false,
      blocked: false,
      accessScheduleEnabled: false,
      accessStartTime: "08:00",
      accessEndTime: "18:00",
    });
    setManagementModalTab("general");
  }

  function resetQueueForm() {
    setEditingQueueId(null);
    setQueueForm({ name: "", color: "#1A1C32", isBotQueue: false });
  }

  function resetQuickReplyForm() {
    setEditingQuickReplyId(null);
    setQuickReplyForm({ shortcut: "", content: "", isActive: true });
  }

  function resetAutomationForm() {
    setEditingAutomationId(null);
    setAutomationForm({
      name: "",
      description: "",
      status: "draft",
      triggerType: "message_received",
      queueId: "",
      whatsappInstanceId: "",
      inactivityMinutes: "30",
      responsePendingFrom: "customer",
      keyword: "",
      assignmentScope: "any",
      scheduleTime: "09:00",
      scheduleDaysOfWeek: [1, 2, 3, 4, 5],
      actionType: "send_message",
      actionMessage: "",
      actionQueueId: "",
      actionAgentId: "",
      actionWebhookUrl: "",
      actionCloseReason: "",
    });
  }

  function resetCustomerForm() {
    setEditingCustomerId(null);
    setCustomerForm({
      name: "",
      phone: "",
      email: "",
      companyName: "",
      notes: "",
      dashboardExcluded: false,
    });
  }

  function resetConversationForm() {
    const firstInstance = instances[0] ?? null;
    setConversationForm({
      phone: "",
      whatsappInstanceId: firstInstance?.id ?? "",
      queueId: firstInstance?.defaultQueueId ?? "",
      customerSearch: "",
    });
  }

  function getConversationDefaultQueue(instanceId: string) {
    const instance = instances.find((item) => item.id === instanceId) ?? null;
    if (!instance?.defaultQueueId) {
      return {
        id: "",
        name: "Instância sem fila padrão",
      };
    }

    const queue = queues.find((item) => item.id === instance.defaultQueueId) ?? null;
    return {
      id: instance.defaultQueueId,
      name: queue?.name ?? instance.defaultQueue?.name ?? "Fila padrão da instância",
    };
  }

  function startEditInstance(instance: InstanceItem) {
    setEditingInstanceId(instance.id);
    setInstanceForm({
      name: instance.name,
      evolutionInstanceName: instance.evolutionInstanceName,
      baseUrl: instance.baseUrl,
      apiKey: "",
      webhookSecret: "",
      defaultQueueId: instance.defaultQueueId ?? "",
    });
    setActiveWorkspace("settings");
    setAdminSection("instances");
    setManagementModal("instance");
  }

  function startEditAgent(agent: AgentItem) {
    setEditingAgentId(agent.id);
    setDuplicatingAgentName(null);
    setAgentForm({
      name: agent.name,
      email: agent.email,
      password: "",
      confirmPassword: "",
      role: agent.role,
      queueIds: agent.queues.map((queue) => queue.id),
      permissions: normalizePermissions(agent.role, agent.permissions),
      isBotAgent: agent.isBotAgent,
      blocked: agent.status === "inactive",
      accessScheduleEnabled: Boolean(agent.accessStartTime && agent.accessEndTime),
      accessStartTime: agent.accessStartTime ?? "08:00",
      accessEndTime: agent.accessEndTime ?? "18:00",
    });
    setActiveWorkspace("settings");
    setAdminSection("agents");
    setManagementModalTab("general");
    setManagementModal("agent");
  }

  function startDuplicateAgent(agent: AgentItem) {
    setEditingAgentId(null);
    setDuplicatingAgentName(agent.name);
    setAgentForm({
      name: `${agent.name} (cópia)`,
      email: "",
      password: "",
      confirmPassword: "",
      role: agent.role,
      queueIds: agent.queues.map((queue) => queue.id),
      permissions: normalizePermissions(agent.role, agent.permissions),
      isBotAgent: agent.isBotAgent,
      blocked: false,
      accessScheduleEnabled: Boolean(agent.accessStartTime && agent.accessEndTime),
      accessStartTime: agent.accessStartTime ?? "08:00",
      accessEndTime: agent.accessEndTime ?? "18:00",
    });
    setActiveWorkspace("settings");
    setAdminSection("agents");
    setManagementModalTab("general");
    setManagementModal("agent");
  }

  function startEditQueue(queue: QueueItem) {
    setEditingQueueId(queue.id);
    setQueueForm({
      name: queue.name,
      color: queue.color ?? "#1A1C32",
      isBotQueue: queue.isBotQueue,
    });
    setActiveWorkspace("settings");
    setAdminSection("queues");
    setManagementModal("queue");
  }

  function startEditQuickReply(item: QuickReplyItem) {
    setEditingQuickReplyId(item.id);
    setQuickReplyForm({
      shortcut: item.shortcut,
      content: item.content,
      isActive: item.isActive,
    });
    setActiveWorkspace("quickReplies");
    setManagementModal("quickReply");
  }

  function startEditCustomer(customer: CustomerItem, options?: { preserveWorkspace?: boolean }) {
    setEditingCustomerId(customer.id);
    setCustomerForm({
      name: customer.name,
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      companyName: customer.companyName ?? "",
      notes: customer.notes ?? "",
      dashboardExcluded: Boolean(customer.dashboardExcluded),
    });
    if (!options?.preserveWorkspace) {
      setActiveWorkspace("contacts");
    }
    setManagementModal("customer");
  }

  function startEditAutomation(item: AutomationItem) {
    const keywordCondition = item.conditions.find((condition) => condition.field === "message.keyword");
    const inactivityCondition = item.conditions.find((condition) => condition.field === "ticket.inactivityMinutes");
    const assignmentCondition = item.conditions.find((condition) => condition.field === "ticket.assignment");
    const responsePendingFromCondition = item.conditions.find((condition) => condition.field === "ticket.responsePendingFrom");
    const primaryAction = item.actions[0];

    setEditingAutomationId(item.id);
    setAutomationForm({
      name: item.name,
      description: item.description ?? "",
      status: item.status,
      triggerType: item.triggerType,
      queueId: item.queueId ?? "",
      whatsappInstanceId: item.whatsappInstanceId ?? "",
      inactivityMinutes: String(inactivityCondition?.value ?? 30),
      responsePendingFrom:
        responsePendingFromCondition?.value === "agent"
          ? "agent"
          : primaryAction?.type === "nudge_ticket"
            ? "agent"
            : "customer",
      keyword: typeof keywordCondition?.value === "string" ? keywordCondition.value : "",
      assignmentScope:
        assignmentCondition?.value === "assigned" || assignmentCondition?.value === "unassigned"
          ? assignmentCondition.value
          : "any",
      scheduleTime: item.scheduleConfig?.time ?? "09:00",
      scheduleDaysOfWeek:
        Array.isArray(item.scheduleConfig?.daysOfWeek) && item.scheduleConfig.daysOfWeek.length > 0
          ? item.scheduleConfig.daysOfWeek
          : [1, 2, 3, 4, 5],
      actionType:
        primaryAction?.type === "send_message"
        || primaryAction?.type === "transfer_queue"
        || primaryAction?.type === "assign_agent"
        || primaryAction?.type === "close_ticket"
        || primaryAction?.type === "nudge_ticket"
        || primaryAction?.type === "webhook"
          ? primaryAction.type
          : "send_message",
      actionMessage: typeof primaryAction?.config?.message === "string" ? primaryAction.config.message : "",
      actionQueueId: typeof primaryAction?.config?.queueId === "string" ? primaryAction.config.queueId : "",
      actionAgentId: typeof primaryAction?.config?.agentId === "string" ? primaryAction.config.agentId : "",
      actionWebhookUrl: typeof primaryAction?.config?.url === "string" ? primaryAction.config.url : "",
      actionCloseReason: typeof primaryAction?.config?.reason === "string" ? primaryAction.config.reason : "",
    });
    setManagementModal("automation");
    setActiveWorkspace("automations");
  }

  function openCreateInstanceModal() {
    resetInstanceForm();
    setManagementModalTab("general");
    setManagementModal("instance");
    setActiveWorkspace("settings");
    setAdminSection("instances");
  }

  function openCreateAgentModal() {
    resetAgentForm();
    setManagementModalTab("general");
    setManagementModal("agent");
    setActiveWorkspace("settings");
    setAdminSection("agents");
  }

  function openCreateQueueModal() {
    resetQueueForm();
    setManagementModalTab("general");
    setManagementModal("queue");
    setActiveWorkspace("settings");
    setAdminSection("queues");
  }

  function openCreateQuickReplyModal() {
    resetQuickReplyForm();
    setManagementModalTab("general");
    setManagementModal("quickReply");
    setActiveWorkspace("quickReplies");
  }

  function openCreateAutomationModal() {
    resetAutomationForm();
    setManagementModalTab("general");
    setManagementModal("automation");
    setActiveWorkspace("automations");
  }

  function openCreateCustomerModal() {
    resetCustomerForm();
    setManagementModalTab("general");
    setManagementModal("customer");
    setActiveWorkspace("contacts");
  }

  function openCreateConversationModal() {
    if (!canStartConversation) {
      return;
    }

    if (instances.length === 0) {
      setPanelMessage("Cadastre uma instância antes de iniciar uma nova conversa.");
      return;
    }

    resetConversationForm();
    setManagementModal("conversation");
    setActiveWorkspace("tickets");
  }

  function closeManagementModal() {
    setManagementModal(null);
    setManagementModalTab("general");
    setEditingInstanceId(null);
    setEditingAgentId(null);
    setDuplicatingAgentName(null);
    setEditingQueueId(null);
    setEditingQuickReplyId(null);
    setEditingAutomationId(null);
    setEditingCustomerId(null);
    setInstanceForm({
      name: "",
      evolutionInstanceName: "",
      baseUrl: "",
      apiKey: "",
      webhookSecret: "",
      defaultQueueId: "",
    });
    setAgentForm({
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: "agent",
      queueIds: [],
      permissions: defaultPermissionsForRole("agent"),
      isBotAgent: false,
      blocked: false,
      accessScheduleEnabled: false,
      accessStartTime: "08:00",
      accessEndTime: "18:00",
    });
    setQueueForm({ name: "", color: "#1A1C32", isBotQueue: false });
    setQuickReplyForm({ shortcut: "", content: "", isActive: true });
    setAutomationForm({
      name: "",
      description: "",
      status: "draft",
      triggerType: "message_received",
      queueId: "",
      whatsappInstanceId: "",
      inactivityMinutes: "30",
      responsePendingFrom: "customer",
      keyword: "",
      assignmentScope: "any",
      scheduleTime: "09:00",
      scheduleDaysOfWeek: [1, 2, 3, 4, 5],
      actionType: "send_message",
      actionMessage: "",
      actionQueueId: "",
      actionAgentId: "",
      actionWebhookUrl: "",
      actionCloseReason: "",
    });
    setCustomerForm({
      name: "",
      phone: "",
      email: "",
      companyName: "",
      notes: "",
      dashboardExcluded: false,
    });
    setConversationForm({
      phone: "",
      whatsappInstanceId: instances[0]?.id ?? "",
      queueId: instances[0]?.defaultQueueId ?? "",
      customerSearch: "",
    });
  }

  function updateAgentRole(role: "admin" | "agent") {
    setAgentForm((current) => ({
      ...current,
      role,
      queueIds: role === "admin" ? queues.map((queue) => queue.id) : current.queueIds,
      permissions: defaultPermissionsForRole(role),
    }));
  }

  function updateBotAgentMode(enabled: boolean) {
    if (enabled) {
      setManagementModalTab("general");
    }

    setAgentForm((current) => ({
      ...current,
      isBotAgent: enabled,
      role: enabled ? "agent" : current.role,
      queueIds: enabled ? botQueueIds : current.queueIds,
      permissions: enabled ? defaultPermissionsForRole("agent") : current.permissions,
      blocked: enabled ? false : current.blocked,
      accessScheduleEnabled: enabled ? false : current.accessScheduleEnabled,
      accessStartTime: enabled ? "08:00" : current.accessStartTime,
      accessEndTime: enabled ? "18:00" : current.accessEndTime,
    }));
  }

  function toggleAgentPermission(permission: PermissionKey) {
    setAgentForm((current) => ({
      ...current,
      permissions: {
        ...current.permissions,
        [permission]: !current.permissions[permission],
      },
    }));
  }

  function toggleAgentQueue(queueId: string) {
    setAgentForm((current) => ({
      ...current,
      queueIds: current.queueIds.includes(queueId)
        ? current.queueIds.filter((item) => item !== queueId)
        : [...current.queueIds, queueId],
    }));
  }

  async function handleCreateInstance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInstanceLoading(true);
    try {
      const payload = {
        ...instanceForm,
        defaultQueueId: instanceForm.defaultQueueId || null,
      };

      await apiFetch(editingInstanceId ? `/whatsapp/instances/${editingInstanceId}` : "/whatsapp/instances", {
        method: editingInstanceId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      resetInstanceForm();
      closeManagementModal();
      setPanelMessage(editingInstanceId ? "Instância Evolution atualizada." : "Instância Evolution cadastrada.");
      await refreshInstances();
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao salvar instância.");
    } finally {
      setInstanceLoading(false);
    }
  }

  async function handleCreateAgent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedPassword = agentForm.password.trim();
    const requiresCredentials = !agentForm.isBotAgent;

    if (!editingAgentId && requiresCredentials && trimmedPassword.length < 8) {
      setPanelMessage("Informe uma senha com ao menos 8 caracteres.");
      return;
    }

    if (requiresCredentials && trimmedPassword && trimmedPassword !== agentForm.confirmPassword) {
      setPanelMessage("A confirmação da senha não confere.");
      return;
    }

    if (requiresCredentials && editingAgentId && trimmedPassword && !canManageAgentPasswords) {
      setPanelMessage("Você não possui permissão para alterar senhas de usuários.");
      return;
    }

    if (agentForm.accessScheduleEnabled && (!agentForm.accessStartTime || !agentForm.accessEndTime)) {
      setPanelMessage("Defina o horário inicial e final para limitar o acesso do usuário.");
      return;
    }

    if (agentForm.accessScheduleEnabled && agentForm.accessStartTime === agentForm.accessEndTime) {
      setPanelMessage("O horário final precisa ser diferente do horário inicial.");
      return;
    }

    setAgentLoading(true);
    try {
      const payload = {
        name: agentForm.name,
        email: agentForm.isBotAgent ? "" : agentForm.email,
        password: agentForm.isBotAgent ? "" : trimmedPassword,
        role: agentForm.isBotAgent ? "agent" : agentForm.role,
        queueIds: agentForm.isBotAgent
          ? botQueueIds
          : agentForm.role === "admin"
            ? queues.map((queue) => queue.id)
            : agentForm.queueIds,
        permissions: agentForm.permissions,
        ...(currentUser.role === "admin" ? { isBotAgent: agentForm.isBotAgent } : {}),
        ...(canManageUserAccess
          ? {
              blocked: agentForm.blocked,
              accessStartTime: agentForm.accessScheduleEnabled ? agentForm.accessStartTime : null,
              accessEndTime: agentForm.accessScheduleEnabled ? agentForm.accessEndTime : null,
            }
          : {}),
      };

      await apiFetch(editingAgentId ? `/agents/${editingAgentId}` : "/agents", {
        method: editingAgentId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      resetAgentForm();
      closeManagementModal();
      setPanelMessage(editingAgentId ? (trimmedPassword ? "Agente e senha atualizados." : "Agente atualizado.") : "Agente criado.");
      await refreshAgents();
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao criar agente.");
    } finally {
      setAgentLoading(false);
    }
  }

  async function handleCreateQueue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQueueLoading(true);
    try {
      await apiFetch(editingQueueId ? `/queues/${editingQueueId}` : "/queues", {
        method: editingQueueId ? "PUT" : "POST",
        body: JSON.stringify(queueForm),
      });
      resetQueueForm();
      closeManagementModal();
      setPanelMessage(editingQueueId ? "Fila atualizada." : "Fila criada.");
      await refreshQueues();
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao criar fila.");
    } finally {
      setQueueLoading(false);
    }
  }

  async function handleDeleteAgent(agentId: string, agentName: string) {
    if (!canDeleteAgents) return;
    if (agentId === currentUser.id) {
      await openAlertDialog({
        title: "Exclusão não permitida",
        description: "Você não pode excluir o próprio usuário enquanto estiver autenticado.",
        confirmLabel: "Entendi",
        tone: "default",
      });
      return;
    }

    const confirmed = await openConfirmDialog({
      title: "Excluir usuário",
      description: `Deseja realmente excluir ${agentName}? Esta ação não poderá ser desfeita.`,
      confirmLabel: "Excluir usuário",
      cancelLabel: "Cancelar",
      tone: "danger",
    });

    if (!confirmed) {
      return;
    }

    setAgentLoading(true);
    try {
      await apiFetch(`/agents/${agentId}`, {
        method: "DELETE",
      });

      if (editingAgentId === agentId) {
        resetAgentForm();
        closeManagementModal();
      }

      setPanelMessage("Usuário excluído.");
      await refreshAgents();
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao excluir usuário.");
    } finally {
      setAgentLoading(false);
    }
  }

  async function handleCreateQuickReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuickReplyLoading(true);
    try {
      await apiFetch(editingQuickReplyId ? `/quick-replies/${editingQuickReplyId}` : "/quick-replies", {
        method: editingQuickReplyId ? "PUT" : "POST",
        body: JSON.stringify(quickReplyForm),
      });
      resetQuickReplyForm();
      closeManagementModal();
      setPanelMessage(editingQuickReplyId ? "Resposta rápida atualizada." : "Resposta rápida criada.");
      await refreshQuickReplies();
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao salvar resposta rápida.");
    } finally {
      setQuickReplyLoading(false);
    }
  }

  async function handleCreateAutomation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const conditions: AutomationCondition[] = [];

    if (automationForm.keyword.trim()) {
      conditions.push({
        field: "message.keyword",
        operator: "contains",
        value: automationForm.keyword.trim(),
        valueLabel: automationForm.keyword.trim(),
      });
    }

    if (automationForm.assignmentScope !== "any") {
      conditions.push({
        field: "ticket.assignment",
        operator: "equals",
        value: automationForm.assignmentScope,
        valueLabel: automationForm.assignmentScope === "unassigned" ? "Sem agente" : "Com agente",
      });
    }

    if (automationForm.triggerType === "ticket_inactive") {
      const inactivityMinutes = Number.parseInt(automationForm.inactivityMinutes, 10);
      if (!Number.isFinite(inactivityMinutes) || inactivityMinutes <= 0) {
        setPanelMessage("Informe um tempo válido em minutos para aguardar a resposta pendente.");
        return;
      }

      conditions.push({
        field: "ticket.responsePendingFrom",
        operator: "equals",
        value: automationForm.responsePendingFrom,
        valueLabel: automationForm.responsePendingFrom === "agent" ? "Agente" : "Cliente",
      });

      conditions.push({
        field: "ticket.inactivityMinutes",
        operator: "gte",
        value: inactivityMinutes,
        valueLabel: String(inactivityMinutes),
      });
    }

    const actions: AutomationAction[] = [];

    if (automationForm.actionType === "send_message") {
      if (!automationForm.actionMessage.trim()) {
        setPanelMessage("Escreva a mensagem que a automação deve enviar.");
        return;
      }

      actions.push({
        type: "send_message",
        config: {
          message: automationForm.actionMessage.trim(),
        },
        summary: `Enviar: ${automationForm.actionMessage.trim()}`,
      });
    }

    if (automationForm.actionType === "transfer_queue") {
      const queue = queues.find((item) => item.id === automationForm.actionQueueId);
      if (!queue) {
        setPanelMessage("Selecione a fila para a transferência automática.");
        return;
      }

      actions.push({
        type: "transfer_queue",
        config: {
          queueId: queue.id,
          queueName: queue.name,
        },
        summary: `Transferir para ${queue.name}`,
      });
    }

    if (automationForm.actionType === "assign_agent") {
      const agent = agents.find((item) => item.id === automationForm.actionAgentId);
      if (!agent) {
        setPanelMessage("Selecione o agente para a atribuição automática.");
        return;
      }

      actions.push({
        type: "assign_agent",
        config: {
          agentId: agent.id,
          agentName: agent.name,
        },
        summary: `Atribuir ${agent.name}`,
      });
    }

    if (automationForm.actionType === "close_ticket") {
      actions.push({
        type: "close_ticket",
        config: {
          reason: automationForm.actionCloseReason.trim() || null,
        },
        summary: automationForm.actionCloseReason.trim()
          ? `Encerrar: ${automationForm.actionCloseReason.trim()}`
          : "Encerrar ticket automaticamente",
      });
    }

    if (automationForm.actionType === "nudge_ticket") {
      actions.push({
        type: "nudge_ticket",
        config: {},
        summary: "Chamar atenção do responsável",
      });
    }

    if (automationForm.actionType === "webhook") {
      if (!automationForm.actionWebhookUrl.trim()) {
        setPanelMessage("Informe a URL do webhook.");
        return;
      }

      actions.push({
        type: "webhook",
        config: {
          url: automationForm.actionWebhookUrl.trim(),
        },
        summary: `Webhook: ${automationForm.actionWebhookUrl.trim()}`,
      });
    }

    const scheduleConfig =
      automationForm.triggerType === "scheduled_time"
        ? {
            time: automationForm.scheduleTime,
            daysOfWeek: automationForm.scheduleDaysOfWeek,
          }
        : null;

    setAutomationLoading(true);
    try {
      await apiFetch(editingAutomationId ? `/automations/${editingAutomationId}` : "/automations", {
        method: editingAutomationId ? "PUT" : "POST",
        body: JSON.stringify({
          name: automationForm.name,
          description: automationForm.description.trim() || null,
          status: automationForm.status,
          triggerType: automationForm.triggerType,
          queueId: automationForm.queueId || null,
          whatsappInstanceId: automationForm.whatsappInstanceId || null,
          conditions,
          actions,
          scheduleConfig,
        }),
      });
      resetAutomationForm();
      closeManagementModal();
      setPanelMessage(editingAutomationId ? "Automação atualizada." : "Automação criada.");
      await Promise.all([refreshAutomations(), refreshAutomationExecutions()]);
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao salvar automação.");
    } finally {
      setAutomationLoading(false);
    }
  }

  async function handleCreateCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCustomerLoading(true);
    try {
      await apiFetch(editingCustomerId ? `/customers/${editingCustomerId}` : "/customers", {
        method: editingCustomerId ? "PUT" : "POST",
        body: JSON.stringify({
          ...customerForm,
          phone: onlyPhoneDigits(customerForm.phone),
        }),
      });
      resetCustomerForm();
      closeManagementModal();
      setPanelMessage(editingCustomerId ? "Contato atualizado." : "Contato criado.");
      await refreshCustomers();
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao salvar contato.");
    } finally {
      setCustomerLoading(false);
    }
  }

  async function handleDeleteCustomer(customerId: string) {
    if (!canManageContacts) return;

    const confirmed = await openConfirmDialog({
      title: "Excluir contato",
      description: "Os tickets continuarão no histórico, mas o vínculo com o contato será removido.",
      confirmLabel: "Excluir contato",
      cancelLabel: "Cancelar",
      tone: "danger",
    });

    if (!confirmed) {
      return;
    }

    setCustomerLoading(true);
    try {
      await apiFetch(`/customers/${customerId}`, {
        method: "DELETE",
      });

      if (editingCustomerId === customerId) {
        resetCustomerForm();
        closeManagementModal();
      }

      setPanelMessage("Contato excluído.");
      await refreshCustomers();
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao excluir contato.");
    } finally {
      setCustomerLoading(false);
    }
  }

  async function handleOpenCustomerTickets(customer: CustomerItem) {
    setCustomerTicketsViewer({
      customer,
      tickets: [],
      loading: true,
    });

    try {
      const payload = await apiFetch<{ item: { id: string; name: string }; tickets: TicketItem[] }>(`/customers/${customer.id}/tickets`, { method: "GET" });
      setCustomerTicketsViewer({
        customer: {
          ...customer,
          name: payload.item.name,
        },
        tickets: payload.tickets,
        loading: false,
      });
    } catch (error) {
      setCustomerTicketsViewer({
        customer,
        tickets: [],
        loading: false,
      });
      setPanelMessage(error instanceof Error ? error.message : "Falha ao carregar tickets do contato.");
    }
  }

  async function handleToggleCustomerDashboardVisibility(customer: CustomerItem, ignored: boolean) {
    if (!canManageContacts) return;

    try {
      setCustomerLoading(true);
      await apiFetch(`/customers/${customer.id}/dashboard-visibility`, {
        method: "PATCH",
        body: JSON.stringify({ ignored }),
      });
      setPanelMessage(ignored ? "Contato ignorado no Painel Geral." : "Contato voltou a ser contabilizado no Painel Geral.");
      await refreshCustomers();
      await refreshDashboard();
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao atualizar a visibilidade do contato no dashboard.");
    } finally {
      setCustomerLoading(false);
    }
  }

  async function handleDeleteQuickReply(quickReplyId: string) {
    if (!canManageQuickReplies) return;

    try {
      await apiFetch(`/quick-replies/${quickReplyId}`, {
        method: "DELETE",
      });
      setPanelMessage("Resposta rápida excluída.");
      await refreshQuickReplies();
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao excluir resposta rápida.");
    }
  }

  async function handleDeleteAutomation(automationId: string, automationName: string) {
    if (!canManageAutomations) return;

    const confirmed = await openConfirmDialog({
      title: "Excluir automação",
      description: `Deseja realmente excluir a automação ${automationName}?`,
      confirmLabel: "Excluir automação",
      cancelLabel: "Cancelar",
      tone: "danger",
    });

    if (!confirmed) {
      return;
    }

    try {
      setAutomationLoading(true);
      await apiFetch(`/automations/${automationId}`, {
        method: "DELETE",
      });

      if (editingAutomationId === automationId) {
        resetAutomationForm();
        closeManagementModal();
      }

      setPanelMessage("Automação excluída.");
      await Promise.all([refreshAutomations(), refreshAutomationExecutions()]);
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao excluir automação.");
    } finally {
      setAutomationLoading(false);
    }
  }

  async function handleCreateConversation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConversationLoading(true);
    try {
      const normalizedPhone = onlyPhoneDigits(conversationForm.phone);
      const defaultConversationQueue = getConversationDefaultQueue(conversationForm.whatsappInstanceId);
      const matchedCustomer = customers.find((customer) => customer.phone && onlyPhoneDigits(customer.phone) === normalizedPhone) ?? null;

      if (existingOpenConversationTicket) {
        await openAlertDialog({
          title: "Ticket já existente",
          description: `Já existe um ticket aberto para este número com ${existingOpenConversationTicket.currentAgent?.name ?? "outro usuário"}.`,
          confirmLabel: "Abrir ticket",
          tone: "default",
        });
        closeManagementModal();
        setSelectedTicketId(existingOpenConversationTicket.id);
        setActiveWorkspace("tickets");
        setPanelMessage("Ticket existente aberto para evitar duplicidade.");
        return;
      }

      const payload = await apiFetch<CreateConversationResponse>("/tickets", {
        method: "POST",
        body: JSON.stringify({
          customerName: matchedCustomer?.name,
          phone: normalizedPhone,
          whatsappInstanceId: conversationForm.whatsappInstanceId,
          queueId: defaultConversationQueue.id || null,
        }),
      });

      closeManagementModal();
      await refreshTickets();
      setSelectedTicketId(payload.item.id);
      setActiveWorkspace("tickets");
      if (!payload.created) {
        await openAlertDialog({
          title: "Ticket já existente",
          description: `Já existe um ticket aberto para este número com ${payload.item.currentAgent?.name ?? "outro usuário"}.`,
          confirmLabel: "Abrir ticket",
          tone: "default",
        });
      }
      setPanelMessage(payload.created ? "Nova conversa iniciada." : "Conversa existente aberta.");
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao iniciar conversa.");
    } finally {
      setConversationLoading(false);
    }
  }

  async function handleStartConversationFromSharedContact(contactName: string, contactPhone: string | null, messageId: string) {
    const normalizedPhone = onlyPhoneDigits(contactPhone ?? "");
    if (!normalizedPhone) {
      setPanelMessage("Esse contato compartilhado não possui telefone utilizável.");
      return;
    }

    const instanceId = selectedTicket?.whatsappInstance.id ?? instances[0]?.id ?? "";
    if (!instanceId) {
      setPanelMessage("Nenhuma instância disponível para iniciar a conversa.");
      return;
    }

    try {
      setSharedContactLoadingKey(messageId);

      const existingTicket = tickets.find((ticket) => {
        if (ticket.status === "closed") return false;
        if (ticket.whatsappInstance.id !== instanceId) return false;
        return onlyPhoneDigits(ticket.externalContactId ?? ticket.externalChatId) === normalizedPhone;
      });

      if (existingTicket) {
        setSelectedTicketId(existingTicket.id);
        setActiveWorkspace("tickets");
        setPanelMessage("Ticket existente aberto para o contato compartilhado.");
        return;
      }

      const matchedCustomer = customers.find((customer) => customer.phone && onlyPhoneDigits(customer.phone) === normalizedPhone) ?? null;
      const payload = await apiFetch<CreateConversationResponse>("/tickets", {
        method: "POST",
        body: JSON.stringify({
          customerName: matchedCustomer?.name ?? contactName,
          phone: normalizedPhone,
          whatsappInstanceId: instanceId,
          queueId: selectedTicket?.currentQueue?.id ?? null,
        }),
      });

      await refreshTickets();
      setSelectedTicketId(payload.item.id);
      setActiveWorkspace("tickets");
      setPanelMessage(payload.created ? "Nova conversa criada a partir do contato compartilhado." : "Conversa existente aberta.");
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao abrir conversa do contato compartilhado.");
    } finally {
      setSharedContactLoadingKey(null);
    }
  }

  async function handleAssignQueueAgents(queueId: string, agentIds: string[]) {
    setAssignmentLoading(queueId);
    try {
      await apiFetch(`/queues/${queueId}/agents`, {
        method: "POST",
        body: JSON.stringify({ agentIds }),
      });
      setPanelMessage("Membros da fila atualizados.");
      await refreshQueues();
      await refreshAgents();
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao atualizar fila.");
    } finally {
      setAssignmentLoading(null);
    }
  }

  const ticketWorkspaceAtivo = activeWorkspace === "tickets" || activeWorkspace === "closedTickets";
  const shouldShowTicketListPane = !isMobileViewport || !ticketWorkspaceAtivo || mobileTicketView === "list";
  const shouldShowWorkspacePane = !isMobileViewport || !ticketWorkspaceAtivo || mobileTicketView === "conversation";

  React.useEffect(() => {
    const syncViewport = () => {
      setIsMobileViewport(window.innerWidth < 768);
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  React.useEffect(() => {
    if (!isMobileViewport) {
      setMobileNavigationOpen(false);
      return;
    }

    if (!ticketWorkspaceAtivo) {
      setMobileTicketView("list");
      return;
    }

    if (selectedTicketId) {
      setMobileTicketView("conversation");
    }
  }, [isMobileViewport, selectedTicketId, ticketWorkspaceAtivo]);

  React.useEffect(() => {
    if (!isMobileViewport) {
      return;
    }

    setMobileNavigationOpen(false);
  }, [activeWorkspace, isMobileViewport]);

  React.useEffect(() => {
    if (!isMobileViewport || selectedTicketId || mobileTicketView !== "conversation") {
      return;
    }

    setMobileTicketView("list");
  }, [isMobileViewport, mobileTicketView, selectedTicketId]);

  React.useEffect(() => {
    selectedTicketIdRef.current = selectedTicketId;
  }, [selectedTicketId]);

  React.useEffect(() => {
    activeWorkspaceRef.current = activeWorkspace;
  }, [activeWorkspace]);

  React.useEffect(() => {
    if (!browserNotificationsSupported) {
      return;
    }

    const syncPermission = () => setBrowserNotificationPermission(Notification.permission);
    syncPermission();
    window.addEventListener("focus", syncPermission);
    return () => window.removeEventListener("focus", syncPermission);
  }, [browserNotificationsSupported]);

  React.useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let disposed = false;

    void navigator.serviceWorker.register("/chatflow-sw.js").then((registration) => {
      if (!disposed) {
        browserNotificationRegistrationRef.current = registration;
      }
    }).catch(() => {
      browserNotificationRegistrationRef.current = null;
    });

    return () => {
      disposed = true;
    };
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      const payload = event.data as { type?: string; url?: string } | undefined;
      if (payload?.type !== "chatflow-notification-open-ticket" || !payload.url) {
        return;
      }

      const targetUrl = new URL(payload.url, window.location.origin);
      const ticketId = targetUrl.searchParams.get("ticketId");
      if (!ticketId) {
        return;
      }

      const matchingTicket = tickets.find((ticket) => ticket.id === ticketId);
      if (matchingTicket) {
        openTicketFromNotification(matchingTicket);
        return;
      }

      setActiveWorkspace("tickets");
      setSelectedTicketId(ticketId);
      if (isMobileViewport) {
        setMobileTicketView("conversation");
      }
    };

    navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", handleServiceWorkerMessage);
    };
  }, [isMobileViewport, openTicketFromNotification, tickets]);

  React.useEffect(() => {
    if (
      typeof window === "undefined"
      || !user
      || !("serviceWorker" in navigator)
      || !("PushManager" in window)
    ) {
      setBrowserPushEnabled(false);
      return;
    }

    let disposed = false;

    const syncBrowserPush = async () => {
      try {
        const config = await apiFetch<BrowserPushConfigResponse>("/browser-notifications/config", { method: "GET" });
        if (disposed) return;

        if (!config.enabled || !config.publicKey) {
          setBrowserPushEnabled(false);
          return;
        }

        const registration = browserNotificationRegistrationRef.current ?? await navigator.serviceWorker.ready;
        if (disposed) return;

        browserNotificationRegistrationRef.current = registration;
        const expectedApplicationServerKey = urlBase64ToUint8Array(config.publicKey);
        let existingSubscription = await registration.pushManager.getSubscription();

        if (browserNotificationPermission !== "granted") {
          setBrowserPushEnabled(false);
          if (existingSubscription) {
            await apiFetch("/browser-notifications/subscriptions", {
              method: "DELETE",
              body: JSON.stringify({ endpoint: existingSubscription.endpoint }),
            }).catch(() => undefined);
            await existingSubscription.unsubscribe().catch(() => false);
          }
          return;
        }

        const currentApplicationServerKey = existingSubscription?.options?.applicationServerKey;
        const mustRenewSubscription = existingSubscription
          ? !applicationServerKeysMatch(expectedApplicationServerKey, currentApplicationServerKey)
          : false;

        if (mustRenewSubscription && existingSubscription) {
          await apiFetch("/browser-notifications/subscriptions", {
            method: "DELETE",
            body: JSON.stringify({ endpoint: existingSubscription.endpoint }),
          }).catch(() => undefined);
          await existingSubscription.unsubscribe().catch(() => false);
          existingSubscription = null;
        }

        const activeSubscription = existingSubscription ?? await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: expectedApplicationServerKey,
        });

        if (disposed) return;

        await apiFetch("/browser-notifications/subscriptions", {
          method: "POST",
          body: JSON.stringify(serializePushSubscription(activeSubscription)),
        });

        setBrowserPushEnabled(true);
      } catch {
        if (!disposed) {
          setBrowserPushEnabled(false);
        }
      }
    };

    void syncBrowserPush();

    return () => {
      disposed = true;
    };
  }, [browserNotificationPermission, user]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const currentUrl = new URL(window.location.href);
    const ticketId = currentUrl.searchParams.get("ticketId");
    if (!ticketId) {
      return;
    }

    const matchingTicket = tickets.find((ticket) => ticket.id === ticketId);
    if (!matchingTicket) {
      return;
    }

    openTicketFromNotification(matchingTicket);
    currentUrl.searchParams.delete("ticketId");
    window.history.replaceState({}, "", `${currentUrl.pathname}${currentUrl.search}`);
  }, [openTicketFromNotification, tickets]);

  const workspaceTitle =
    activeWorkspace === "dashboard"
      ? "Painel geral"
      : activeWorkspace === "tickets"
        ? "Atendimento"
        : activeWorkspace === "closedTickets"
          ? "Tickets fechados"
        : activeWorkspace === "channels"
          ? "Canais e instâncias"
          : activeWorkspace === "quickReplies"
            ? "Respostas rápidas"
          : activeWorkspace === "team"
            ? "Equipe e filas"
            : activeWorkspace === "api"
              ? "API"
            : activeWorkspace === "contacts"
              ? "Contatos"
            : activeWorkspace === "profile"
              ? "Perfil"
              : activeWorkspace === "calendar"
                  ? "Agendamentos"
                  : activeWorkspace === "automations"
                    ? "Automações"
                    : "Configurações";
  const trimmedBrandText = brandText.trim();
  const shouldRenderBrandImage = brandMode === "image" && Boolean(brandLogoPreview);
  const shouldRenderBrandText = brandMode === "text" && trimmedBrandText.length > 0;
  const brandTextLabel = trimmedBrandText.length > 0 ? trimmedBrandText : "CHATFLOW";
  const loginBrandImageSrc = "/sermst-login-logo.png";
  const loginBrandTextLabel = trimmedBrandText.length > 0 ? trimmedBrandText : "SERMST";

  const workspaceDescription =
    activeWorkspace === "dashboard"
      ? "Resumo rápido do que está acontecendo no atendimento."
      : activeWorkspace === "tickets"
        ? "Caixa de entrada de conversas com a operação em tempo real."
        : activeWorkspace === "closedTickets"
          ? "Histórico de tickets encerrados com acesso separado por permissão."
        : activeWorkspace === "channels"
          ? "Instâncias Evolution e orientações de conexão."
          : activeWorkspace === "quickReplies"
            ? "Mensagens prontas para atalho com barra dentro do atendimento."
          : activeWorkspace === "team"
            ? "Gestão de agentes e distribuição por filas."
            : activeWorkspace === "api"
              ? "Endpoints, autenticação e testes rápidos da API própria."
            : activeWorkspace === "contacts"
              ? "Base de contatos atendidos e últimos vínculos com tickets."
            : activeWorkspace === "profile"
              ? "Dados da sessão e atalhos pessoais."
              : activeWorkspace === "calendar"
                  ? "Lista operacional de acompanhamentos e próximos passos."
                  : activeWorkspace === "automations"
                    ? "Regras automatizadas, filtros operacionais e histórico de execuções."
                    : "Ajustes administrativos e visão de ambiente.";

  const workspacePanel = (() => {
    if (activeWorkspace === "dashboard") {
      const maxDailyVolume = Math.max(...(dashboardOverview?.dailySeries.map((item) => Math.max(item.created, item.closed, item.inbound, item.outbound)) ?? [1]));

      return (
        <div className="flex h-full flex-col gap-4 p-6">
          <section className="rounded-[28px] border border-slate-200 bg-white px-6 py-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Visão geral da operação</h3>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="block text-sm font-medium text-slate-600">
                  <span className="sr-only">Escopo do dashboard</span>
                  <select
                    value={dashboardAgentId}
                    onChange={(event) => setDashboardAgentId(event.target.value)}
                    className="h-11 min-w-[220px] rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                  >
                    {dashboardAgentOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-600">
                  <span className="sr-only">Período do dashboard</span>
                  <select
                    value={dashboardRange}
                    onChange={(event) => setDashboardRange(event.target.value as DashboardRangeKey)}
                    className="h-11 min-w-[180px] rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                  >
                    <option value="today">Hoje</option>
                    <option value="7d">Últimos 7 dias</option>
                    <option value="30d">Últimos 30 dias</option>
                  </select>
                </label>
              </div>
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <WorkspaceStatCard title="Tickets abertos" value={String(dashboardOverview?.overview.openTickets ?? 0)} accent="emerald" description="Conversas individuais em atendimento agora." />
            <WorkspaceStatCard title="Aguardando" value={String(dashboardOverview?.overview.pendingTickets ?? 0)} accent="amber" description="Conversas individuais sem resposta final." />
            <WorkspaceStatCard title="Fechados no período" value={String(dashboardOverview?.overview.closedInPeriod ?? 0)} accent="slate" description="Encerramentos concluídos dentro do recorte." />
            <WorkspaceStatCard title="Grupos ativos" value={String(dashboardOverview?.overview.groupTickets ?? 0)} accent="blue" description="Conversas coletivas ainda em andamento." />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <WorkspaceStatCard title="1ª resposta média" value={formatDurationMetric(dashboardOverview?.overview.averageFirstResponseMinutes)} accent="blue" description="Tempo médio entre a 1ª entrada e a 1ª resposta." />
            <WorkspaceStatCard title="Tempo médio de atendimento" value={formatDurationMetric(dashboardOverview?.overview.averageHandleMinutes)} accent="emerald" description="Da abertura até o encerramento do ticket." />
            <WorkspaceStatCard title="Tempo médio até assumir" value={formatDurationMetric(dashboardOverview?.overview.averageAcceptanceMinutes)} accent="amber" description="Da abertura até o aceite do atendimento." />
            <WorkspaceStatCard title="Mensagens no período" value={`${dashboardOverview?.overview.inboundMessages ?? 0}/${dashboardOverview?.overview.outboundMessages ?? 0}`} accent="slate" description="Entradas e saídas no recorte atual." />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
            <WorkspaceSection title="Volume diário" description="Entradas, saídas, aberturas e encerramentos ao longo do período.">
              <div className="space-y-3">
                {(dashboardOverview?.dailySeries ?? []).map((item) => (
                  <div key={item.date} className="grid gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div className="font-semibold text-slate-900">{formatShortDateLabel(item.date)}</div>
                      <div className="text-xs uppercase tracking-[0.08em] text-slate-400">
                        {item.created} abertos · {item.closed} fechados · {item.inbound} in · {item.outbound} out
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(6, (item.created / maxDailyVolume) * 100)}%` }} />
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.max(6, (item.inbound / maxDailyVolume) * 100)}%` }} />
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-[#1A1C32]" style={{ width: `${Math.max(6, (item.outbound / maxDailyVolume) * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
                {dashboardLoading && !dashboardOverview ? <div className="text-sm text-slate-500">Carregando série diária...</div> : null}
              </div>
            </WorkspaceSection>

            <WorkspaceSection title="Alertas operacionais" description="Itens que merecem atenção imediata da operação.">
              <div className="grid gap-3">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-amber-700">Aguardando há mais tempo</div>
                  <div className="mt-3 space-y-2">
                    {(dashboardOverview?.alerts.stalePending ?? []).slice(0, 4).map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                        <div className="font-medium text-slate-800">{item.customerName}</div>
                        <div className="text-amber-700">{formatDurationMetric(item.waitingMinutes)}</div>
                      </div>
                    ))}
                    {dashboardOverview?.alerts.stalePending?.length === 0 ? <div className="text-sm text-slate-500">Nenhum ticket aguardando fora do normal.</div> : null}
                  </div>
                </div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4">
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-rose-700">Sem fila / sem agente</div>
                  <div className="mt-3 text-sm text-slate-700">
                    {dashboardOverview?.overview.withoutQueueTickets ?? 0} sem fila · {dashboardOverview?.overview.unassignedTickets ?? 0} sem agente
                  </div>
                </div>
              </div>
            </WorkspaceSection>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <WorkspaceSection title="Distribuição por fila" description="Carga de trabalho consolidada por fila dentro do período.">
              <DataTable columns={["Fila", "Abertos", "Aguardando", "Fechados"]} emptyMessage="Nenhuma fila encontrada.">
                {(dashboardOverview?.queues ?? []).slice(0, 8).map((queue) => (
                  <DataRow key={queue.id}>
                    <DataCell>
                      <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: queue.color ?? "#CBD5E1" }} />
                        {queue.name}
                      </div>
                    </DataCell>
                    <DataCell subtle>{String(queue.open)}</DataCell>
                    <DataCell subtle>{String(queue.pending)}</DataCell>
                    <DataCell subtle>{String(queue.closed)}</DataCell>
                  </DataRow>
                ))}
              </DataTable>
            </WorkspaceSection>

            <WorkspaceSection title="Distribuição por agente" description="Visão rápida de quem está com carga ativa e fechamentos no período.">
              <DataTable columns={["Agente", "Abertos", "Aguardando", "Fechados"]} emptyMessage="Nenhum agente encontrado.">
                {(dashboardOverview?.agents ?? []).slice(0, 8).map((agent) => (
                  <DataRow key={agent.id}>
                    <DataCell>{agent.name}</DataCell>
                    <DataCell subtle>{String(agent.open)}</DataCell>
                    <DataCell subtle>{String(agent.pending)}</DataCell>
                    <DataCell subtle>{String(agent.closed)}</DataCell>
                  </DataRow>
                ))}
              </DataTable>
            </WorkspaceSection>
          </div>
        </div>
      );
    }

    if (activeWorkspace === "channels") {
          return (
            <div className="flex h-full flex-col gap-4 p-6">
              <WorkspaceSection title="Canais e instâncias" description="Gerencie as conexões com a Evolution em visualização de lista.">
            <ModuleToolbar
              title="Conexões"
              count={filteredInstances.length}
              searchValue={searchQuery}
              searchPlaceholder="Pesquisar instância, telefone ou status"
              onSearchChange={setSearchQuery}
              actionLabel={canManageInstances ? "Nova conexão" : undefined}
              onActionClick={canManageInstances ? openCreateInstanceModal : undefined}
              actionIcon={Plus}
            />

                <DataTable columns={["Nome", "ID", "Evolution", "Status", "Telefone", "URL base", "Criado em", "Ações"]} emptyMessage="Nenhuma instância cadastrada.">
                  {filteredInstances.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-8 text-sm text-slate-500">
                        Nenhuma instância cadastrada.
                      </td>
                    </tr>
                  ) : (
                    filteredInstances.map((instance) => (
                      <DataRow key={instance.id}>
                        <DataCell>{instance.name}</DataCell>
                        <DataCell subtle><span className="font-mono text-xs">{instance.publicId}</span></DataCell>
                        <DataCell subtle>{instance.evolutionInstanceName}</DataCell>
                    <DataCell>
                      <StatusChip tone={instance.status === "connected" ? "success" : instance.status === "error" ? "danger" : "warning"}>
                        {traduzirStatusInstancia(instance.status)}
                      </StatusChip>
                    </DataCell>
                    <DataCell subtle>{instance.phoneNumber ?? "Sem número"}</DataCell>
                    <DataCell subtle>{instance.baseUrl}</DataCell>
                    <DataCell subtle>{formatDateTime(instance.createdAt)}</DataCell>
                    <DataCell>
                      {canManageInstances ? (
                        <button type="button" onClick={() => startEditInstance(instance)} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900">
                          <Pencil className="h-4 w-4" />
                          Editar
                        </button>
                      ) : null}
                    </DataCell>
                  </DataRow>
                ))
              )}
            </DataTable>

            <div className="grid gap-3">
              <InfoRow title="Webhook sugerido" subtitle="Endpoint público para eventos da Evolution" meta={publicUrls.webhookUrl} />
              <InfoRow title="Frontend publicado" subtitle="URL operacional do painel" meta={publicUrls.webBaseUrl} />
            </div>
          </WorkspaceSection>
        </div>
      );
    }

    if (activeWorkspace === "quickReplies") {
      return (
        <div className="flex h-full flex-col gap-4 p-6">
          <WorkspaceSection title="Respostas rápidas" description="Cadastre mensagens padrão e use atalhos com barra dentro das conversas.">
            <ModuleToolbar
              title="Atalhos"
              count={filteredQuickReplies.length}
              searchValue={searchQuery}
              searchPlaceholder="Pesquisar atalho ou conteúdo"
              onSearchChange={setSearchQuery}
              actionLabel={canManageQuickReplies ? "Adicionar resposta" : undefined}
              onActionClick={canManageQuickReplies ? openCreateQuickReplyModal : undefined}
              actionIcon={Zap}
            />

            <DataTable columns={["Atalho", "Mensagem", "Status", "Atualizado em", "Ações"]} emptyMessage="Nenhuma resposta rápida cadastrada.">
              {filteredQuickReplies.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-sm text-slate-500">
                    Nenhuma resposta rápida cadastrada.
                  </td>
                </tr>
              ) : (
                filteredQuickReplies.map((item) => (
                  <DataRow key={item.id}>
                    <DataCell>
                      <span className="font-semibold text-slate-900">/{item.shortcut}</span>
                    </DataCell>
                    <DataCell subtle>{item.content}</DataCell>
                    <DataCell>
                      <StatusChip tone={item.isActive ? "success" : "warning"}>{item.isActive ? "Ativa" : "Inativa"}</StatusChip>
                    </DataCell>
                    <DataCell subtle>{formatDateTime(item.updatedAt)}</DataCell>
                    <DataCell>
                      <div className="flex items-center gap-4">
                        {canManageQuickReplies ? (
                          <button type="button" onClick={() => startEditQuickReply(item)} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900">
                            <Pencil className="h-4 w-4" />
                            Editar
                          </button>
                        ) : null}
                        {canManageQuickReplies ? (
                          <button type="button" onClick={() => void handleDeleteQuickReply(item.id)} className="text-sm font-medium text-red-600 transition hover:text-red-700">
                            Excluir
                          </button>
                        ) : null}
                      </div>
                    </DataCell>
                  </DataRow>
                ))
              )}
            </DataTable>

            <InfoRow title="Uso no atendimento" subtitle="Digite /atalho na caixa de mensagem para aplicar a resposta." meta="Exemplo: /bomdia" />
          </WorkspaceSection>
        </div>
      );
    }

    if (activeWorkspace === "api") {
      return (
        <div className="flex h-full flex-col gap-4 p-6">
          <WorkspaceSection title="API do ChatFlow" description="Integrações externas devem falar com o ChatFlow usando Bearer token. Evolution não é a API pública do sistema.">
            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eef2ff] text-[#1A1C32]">
                    <Code2 className="h-5 w-5" />
                  </span>
                  <div>
                    <h4 className="text-base font-semibold text-slate-900">API própria para produção</h4>
                    <p className="mt-1 text-sm text-slate-500">Use token próprio por integração, sem depender da sessão do painel e sem consumir a Evolution diretamente.</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <InfoRow title="Autenticação" subtitle="Bearer token" meta="Authorization: Bearer SEU_TOKEN" />
                  <InfoRow title="Comportamento" subtitle="409 se já existir ticket aberto" meta="Cria ticket novo apenas quando não houver ticket open ou pending" />
                  <InfoRow title="Orquestração" subtitle="Instância, fila e agente no ChatFlow" meta="Evolution fica apenas como gateway de WhatsApp" />
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Base pública</div>
                  <div className="mt-2 flex items-start justify-between gap-3">
                    <div className="break-all text-sm font-medium text-slate-800">{publicUrls.apiBaseUrl}</div>
                    <button
                      type="button"
                      onClick={() => void handleCopyApiValue(publicUrls.apiBaseUrl, "Base da API copiada.")}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Fluxo de envio</div>
                  <div className="mt-2 text-sm text-slate-700">
                    A integração chama o ChatFlow, informa token, telefone, instância, fila, agente e mensagem. O ChatFlow valida se já existe ticket aberto antes de enviar.
                  </div>
                </div>
              </div>
            </div>
          </WorkspaceSection>

          {canManageApiTokens ? (
            <WorkspaceSection title="Tokens de acesso" description="Crie um token por integração. O valor completo só aparece no momento da criação.">
              <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                  <label className="block text-sm font-medium text-slate-600">
                    Nome da integração
                    <input
                      value={apiTokenNameInput}
                      onChange={(event) => setApiTokenNameInput(event.target.value)}
                      placeholder="Ex.: ERP financeiro"
                      className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                    />
                  </label>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void handleCreateApiToken()}
                      disabled={apiTokensLoading}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#1A1C32] px-5 text-sm font-semibold text-white transition hover:bg-[#111426] disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <Plus className="h-4 w-4" />
                      Criar token
                    </button>
                    <button
                      type="button"
                      onClick={() => void refreshApiTokens()}
                      className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                    >
                      Atualizar lista
                    </button>
                  </div>

                  {apiNewTokenValue ? (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                      <div className="font-semibold uppercase tracking-[0.08em]">Token gerado</div>
                      <div className="mt-2 break-all rounded-xl bg-white px-3 py-3 font-mono text-xs text-slate-800">{apiNewTokenValue}</div>
                      <div className="mt-2 text-xs text-amber-800">Copie agora. O valor completo não será exibido novamente.</div>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-base font-semibold text-slate-900">Integrações cadastradas</h4>
                    <StatusChip tone="default">{apiTokens.length}</StatusChip>
                  </div>
                  <div className="mt-4 space-y-3">
                    {apiTokensLoading ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">Carregando tokens...</div>
                    ) : apiTokens.length === 0 ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">Nenhum token criado ainda.</div>
                    ) : (
                      apiTokens.map((token) => (
                        <div key={token.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900">{token.name}</div>
                              <div className="mt-1 font-mono text-xs text-slate-500">{token.tokenPrefix}...</div>
                              <div className="mt-2 text-xs text-slate-500">
                                Criado em {formatDateTime(token.createdAt)}{token.lastUsedAt ? ` • Último uso ${formatDateTime(token.lastUsedAt)}` : " • Ainda não utilizado"}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleDeleteApiToken(token.id)}
                              className="inline-flex h-10 items-center justify-center rounded-2xl border border-rose-200 px-4 text-sm font-semibold text-rose-600 transition hover:border-rose-300 hover:text-rose-700"
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </WorkspaceSection>
          ) : null}

          <WorkspaceSection title="Documentação da API" description="Rotas públicas do ChatFlow para integrações externas e administração de tokens.">
            <ModuleToolbar
              title="Referência da API"
              count={filteredApiEndpointCount}
              searchValue={searchQuery}
              searchPlaceholder="Pesquisar rota, módulo, permissão ou uso"
              onSearchChange={setSearchQuery}
            />
            <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-4">
                {filteredApiModules.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-8 text-sm text-slate-500">Nenhuma rota encontrada para a busca atual.</div>
                ) : (
                  filteredApiModules.map((module) => (
                    <section key={module.key} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="mb-3">
                        <h4 className="text-base font-semibold text-slate-900">{module.title}</h4>
                        <p className="mt-1 text-sm text-slate-500">{module.description}</p>
                      </div>
                      <div className="space-y-2">
                        {module.endpoints.map((endpoint) => {
                          const selected = endpoint.key === selectedApiEndpoint?.key;
                          return (
                            <button
                              key={endpoint.key}
                              type="button"
                              onClick={() => handleSelectApiEndpoint(endpoint)}
                              className={`flex w-full items-start justify-between gap-4 rounded-2xl border px-4 py-4 text-left transition ${selected ? "border-[#1A1C32] bg-[#f8fafc] shadow-sm" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <StatusChip tone={apiMethodTone(endpoint.method)}>{endpoint.method}</StatusChip>
                                  <span className="text-sm font-semibold text-slate-900">{endpoint.title}</span>
                                  <span className="text-xs uppercase tracking-[0.08em] text-slate-400">{endpoint.module}</span>
                                </div>
                                <div className="mt-2 break-all font-mono text-xs text-slate-500">{endpoint.publicPath}</div>
                                <p className="mt-2 text-sm text-slate-600">{endpoint.summary}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))
                )}
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                {selectedApiEndpoint ? (
                  <div className="space-y-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <StatusChip tone={apiMethodTone(selectedApiEndpoint.method)}>{selectedApiEndpoint.method}</StatusChip>
                          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{selectedApiEndpoint.module}</span>
                        </div>
                        <h4 className="mt-3 text-xl font-semibold text-slate-900">{selectedApiEndpoint.title}</h4>
                        <p className="mt-2 text-sm leading-6 text-slate-500">{selectedApiEndpoint.summary}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleCopyApiValue(`${publicUrls.apiBaseUrl}${selectedApiEndpoint.publicPath}`, "Rota pública copiada.")}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid gap-3">
                      <InfoRow title="Rota pública" subtitle={selectedApiEndpoint.publicPath} meta="Base externa do ChatFlow" />
                      <InfoRow title="Autenticação" subtitle={selectedApiEndpoint.auth === "bearer" ? "Bearer token" : "Sessão do painel"} meta={selectedApiEndpoint.permission ? `Permissão: ${selectedApiEndpoint.permission}` : "Sem permissão adicional"} />
                      <InfoRow title="Preset do testador" subtitle={selectedApiEndpoint.testerPath} meta="Pronto para validar no console abaixo" />
                    </div>
                    {selectedApiEndpoint.bodyExample ? (
                      <div>
                        <div className="text-sm font-semibold text-slate-900">Exemplo de corpo</div>
                        <pre className="mt-3 overflow-auto rounded-2xl border border-slate-200 bg-[#0f172a] p-4 text-xs leading-6 text-slate-100">{selectedApiEndpoint.bodyExample}</pre>
                      </div>
                    ) : null}
                    {selectedApiEndpoint.notes?.length ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                        <div className="font-semibold uppercase tracking-[0.08em]">Observações</div>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                          {selectedApiEndpoint.notes.map((note) => (
                            <li key={note}>{note}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-8 text-sm text-slate-500">Selecione uma rota na lista para ver a documentação detalhada.</div>
                )}
              </div>
            </div>
          </WorkspaceSection>

          <WorkspaceSection title="Console de teste" description="Valide rotas do ChatFlow usando token Bearer ou, quando necessário, a sessão administrativa do painel.">
            <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-sm font-medium text-slate-600">
                    Autenticação
                    <select
                      value={apiSelectedAuthMode}
                      onChange={(event) => setApiSelectedAuthMode(event.target.value as ApiTesterAuthMode)}
                      className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                    >
                      <option value="bearer">Bearer token</option>
                      <option value="session">Sessão do painel</option>
                    </select>
                  </label>
                  <label className="text-sm font-medium text-slate-600">
                    Método
                    <select
                      value={apiTesterMethod}
                      onChange={(event) => setApiTesterMethod(event.target.value as ApiDocMethod)}
                      className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                    >
                      {(["GET", "POST", "PUT", "PATCH", "DELETE"] as ApiDocMethod[]).map((method) => (
                        <option key={method} value={method}>{method}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {apiSelectedAuthMode === "bearer" ? (
                  <label className="mt-4 block text-sm font-medium text-slate-600">
                    Bearer token
                    <input
                      value={apiBearerToken}
                      onChange={(event) => setApiBearerToken(event.target.value)}
                      placeholder="Cole aqui o token da integração"
                      className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                    />
                  </label>
                ) : null}
                <label className="mt-4 block text-sm font-medium text-slate-600">
                  Caminho
                  <input
                    value={apiTesterPath}
                    onChange={(event) => setApiTesterPath(event.target.value)}
                    placeholder="/external/messages/send"
                    className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                  />
                </label>
                <label className="mt-4 block text-sm font-medium text-slate-600">
                  Corpo JSON
                  <textarea
                    value={apiTesterBody}
                    onChange={(event) => setApiTesterBody(event.target.value)}
                    rows={14}
                    placeholder='{"phone":"5511999999999","body":"Mensagem de teste","whatsappInstanceId":12}'
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-mono text-xs leading-6 text-slate-700 outline-none transition focus:border-slate-300"
                  />
                </label>
                {apiTesterError ? (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{apiTesterError}</div>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void handleRunApiTester()}
                    disabled={apiTesterLoading}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#1A1C32] px-5 text-sm font-semibold text-white transition hover:bg-[#111426] disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <Play className="h-4 w-4" />
                    {apiTesterLoading ? "Executando..." : "Rodar teste"}
                  </button>
                  <button
                    type="button"
                    onClick={handleResetApiTester}
                    className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                  >
                    Restaurar preset
                  </button>
                </div>
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  Use <span className="font-semibold text-slate-700">Bearer token</span> para integrações externas. Use <span className="font-semibold text-slate-700">Sessão do painel</span> apenas para administrar tokens.
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-base font-semibold text-slate-900">Resposta</h4>
                  {apiTesterResult ? (
                    <StatusChip tone={apiTesterResult.ok ? "success" : "danger"}>
                      {apiTesterResult.status} · {apiTesterResult.durationMs} ms
                    </StatusChip>
                  ) : null}
                </div>
                {apiTesterResult ? (
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      <InfoRow title="Método" subtitle={apiTesterResult.method} meta="Execução atual" />
                      <InfoRow title="Caminho" subtitle={apiTesterResult.requestedPath} meta={apiTesterResult.contentType ?? "sem content-type"} />
                      <InfoRow title="Status" subtitle={String(apiTesterResult.status)} meta={apiTesterResult.ok ? "Resposta bem-sucedida" : "Resposta com erro"} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Cabeçalhos principais</div>
                      <div className="mt-3 grid gap-2">
                        {apiTesterResult.headers.slice(0, 8).map((header) => (
                          <div key={header.key} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                            <div className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{header.key}</div>
                            <div className="mt-1 break-all text-slate-700">{header.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Corpo da resposta</div>
                      <pre className="mt-3 max-h-[520px] overflow-auto rounded-2xl border border-slate-200 bg-[#0f172a] p-4 text-xs leading-6 text-slate-100">{apiTesterResult.body}</pre>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-sm text-slate-500">Selecione uma rota e rode um teste para inspecionar status, headers e corpo da resposta.</div>
                )}
              </div>
            </div>
          </WorkspaceSection>
        </div>
      );
    }

    if (activeWorkspace === "team") {
      return (
        <div className="flex h-full flex-col gap-4 p-6">
          <div className="flex flex-wrap gap-2">
            <AdminTab label="Agentes" active={adminSection === "agents"} onClick={() => setAdminSection("agents")} />
            <AdminTab label="Filas" active={adminSection === "queues"} onClick={() => setAdminSection("queues")} />
          </div>
          {adminSection === "agents" ? (
            <WorkspaceSection title="Equipe" description="Criação, leitura e distribuição dos agentes do sistema.">
              <ModuleToolbar
                title="Usuários"
                count={filteredAgents.length}
                searchValue={searchQuery}
                searchPlaceholder="Pesquisar nome, e-mail ou fila"
                onSearchChange={setSearchQuery}
                actionLabel={canManageAgents ? "Adicionar usuário" : undefined}
                onActionClick={canManageAgents ? openCreateAgentModal : undefined}
                actionIcon={UserPlus}
              />

                <DataTable columns={["Nome", "ID", "E-mail", "Perfil", "Presença", "Filas", "Ações"]} emptyMessage="Nenhum agente cadastrado.">
                  {filteredAgents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-sm text-slate-500">
                        Nenhum agente cadastrado.
                      </td>
                    </tr>
                  ) : (
                    filteredAgents.map((agent) => (
                      <DataRow key={agent.id}>
                        <DataCell>
                          <div className="flex items-center gap-2">
                            <span>{agent.name}</span>
                            {agent.isBotAgent ? (
                              <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">
                                BOT
                              </span>
                            ) : null}
                          </div>
                        </DataCell>
                        <DataCell subtle><span className="font-mono text-xs">{agent.publicId}</span></DataCell>
                        <DataCell subtle>{agent.email}</DataCell>
                      <DataCell>
                        <StatusChip tone={agent.role === "admin" ? "default" : "success"}>{traduzirPerfil(agent.role)}</StatusChip>
                      </DataCell>
                      <DataCell subtle>{agent.presence}</DataCell>
                      <DataCell subtle>{agent.queues.map((queue) => queue.name).join(", ") || "Sem filas"}</DataCell>
                      <DataCell>
                        {canManageAgents || canDeleteAgents ? (
                          <div className="flex items-center gap-4">
                            {canManageAgents ? (
                              <>
                                <button type="button" onClick={() => startDuplicateAgent(agent)} className="inline-flex items-center gap-2 text-sm font-medium text-sky-600 transition hover:text-sky-700">
                                  <Plus className="h-4 w-4" />
                                  Duplicar
                                </button>
                                <button type="button" onClick={() => startEditAgent(agent)} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900">
                                  <Pencil className="h-4 w-4" />
                                  Editar
                                </button>
                              </>
                            ) : null}
                            {canDeleteAgents && agent.id !== currentUser.id ? (
                              <button type="button" onClick={() => void handleDeleteAgent(agent.id, agent.name)} className="inline-flex items-center gap-2 text-sm font-medium text-rose-600 transition hover:text-rose-700">
                                <Trash2 className="h-4 w-4" />
                                Excluir
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </DataCell>
                    </DataRow>
                  ))
                )}
              </DataTable>
            </WorkspaceSection>
          ) : (
            <WorkspaceSection title="Filas e membros" description="Distribuição de agentes e leitura do volume atual.">
              <ModuleToolbar
                title="Filas"
                count={filteredQueues.length}
                searchValue={searchQuery}
                searchPlaceholder="Pesquisar fila ou membro"
                onSearchChange={setSearchQuery}
                actionLabel={canManageQueues ? "Adicionar fila" : undefined}
                onActionClick={canManageQueues ? openCreateQueueModal : undefined}
                actionIcon={Workflow}
              />

                <DataTable columns={["Fila", "ID", "Cor", "Agentes", "Tickets abertos", "Ações"]} emptyMessage="Nenhuma fila cadastrada.">
                  {filteredQueues.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-sm text-slate-500">
                        Nenhuma fila cadastrada.
                      </td>
                    </tr>
                  ) : (
                    filteredQueues.map((queue) => (
                      <DataRow key={queue.id}>
                        <DataCell>
                          <div className="flex items-center gap-2">
                            <span>{queue.name}</span>
                            {queue.isBotQueue ? <StatusChip tone="default">BOT</StatusChip> : null}
                          </div>
                        </DataCell>
                        <DataCell subtle><span className="font-mono text-xs">{queue.publicId}</span></DataCell>
                        <DataCell>
                          <div className="flex items-center gap-2">
                            <span className="h-4 w-10 rounded-sm border border-slate-200" style={{ backgroundColor: queue.color ?? "#1A1C32" }} />
                            <span className="text-sm text-slate-500">{queue.color ?? "#1A1C32"}</span>
                        </div>
                      </DataCell>
                      <DataCell subtle>{queue.agents.map((agent) => agent.name).join(", ") || "Sem membros"}</DataCell>
                      <DataCell subtle>{queue.openTicketCount}</DataCell>
                      <DataCell>
                        {canManageQueues ? (
                          <button type="button" onClick={() => startEditQueue(queue)} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900">
                            <Pencil className="h-4 w-4" />
                            Editar
                          </button>
                        ) : null}
                      </DataCell>
                    </DataRow>
                  ))
                )}
              </DataTable>

              <div className="grid gap-3">
                {filteredQueues.map((queue) => (
                  <QueueEditor key={queue.id} queue={queue} agents={agents} loading={assignmentLoading === queue.id} canEdit={canAssignQueues} onSave={handleAssignQueueAgents} onChange={setQueues} />
                ))}
              </div>
            </WorkspaceSection>
          )}
        </div>
      );
    }

    if (false && activeWorkspace === "api") {
      return (
        <div className="flex h-full flex-col gap-4 p-6">
          <WorkspaceSection title="API ChatFlow" description="Documentação operacional da API e console de teste usando a sessão atual do painel.">
            <div className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
              <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eef2ff] text-[#1A1C32]">
                    <Code2 className="h-5 w-5" />
                  </span>
                  <div>
                    <h4 className="text-base font-semibold text-slate-900">Referencia pronta para producao</h4>
                    <p className="mt-1 text-sm text-slate-500">Cada rota abaixo traz autenticacao, permissao esperada, exemplo de corpo e preset direto no testador.</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <InfoRow title="Autenticacao" subtitle="Cookie de sessao" meta="As rotas internas usam a sessao ja aberta no painel" />
                  <InfoRow title="Webhook" subtitle="/api/webhooks/evolution" meta="Entrada publica para eventos da Evolution" />
                  <InfoRow title="Teste local" subtitle="No proprio painel" meta="Sem Postman para validar o fluxo principal" />
                </div>
              </div>

              <div className="grid gap-3">
                {[
                  ["Base publica da API", publicUrls.apiBaseUrl],
                  ["Webhook Evolution", publicUrls.webhookUrl],
                  ["Frontend publicado", publicUrls.webBaseUrl],
                  ["Tempo real", SOCKET_URL ?? "NEXT_PUBLIC_SOCKET_URL nao configurada"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</div>
                    <div className="mt-2 flex items-start justify-between gap-3">
                      <div className="break-all text-sm font-medium text-slate-800">{value}</div>
                      <button
                        type="button"
                        onClick={() => void handleCopyApiValue(value, `${label} copiado.`)}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                        title={`Copiar ${label}`}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </WorkspaceSection>

          <WorkspaceSection title="Catalogo da API" description="Rotas organizadas por dominio, com detalhes de uso e acesso.">
            <ModuleToolbar
              title="Referencia da API"
              count={filteredApiEndpointCount}
              searchValue={searchQuery}
              searchPlaceholder="Pesquisar rota, modulo, permissao ou uso"
              onSearchChange={setSearchQuery}
            />

            <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-4">
                {filteredApiModules.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-8 text-sm text-slate-500">
                    Nenhuma rota encontrada para a busca atual.
                  </div>
                ) : (
                  filteredApiModules.map((module) => (
                    <section key={module.key} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="mb-3">
                        <h4 className="text-base font-semibold text-slate-900">{module.title}</h4>
                        <p className="mt-1 text-sm text-slate-500">{module.description}</p>
                      </div>
                      <div className="space-y-2">
                        {module.endpoints.map((endpoint) => {
                          const selected = endpoint.key === selectedApiEndpoint?.key;
                          return (
                            <button
                              key={endpoint.key}
                              type="button"
                              onClick={() => handleSelectApiEndpoint(endpoint)}
                              className={`flex w-full items-start justify-between gap-4 rounded-2xl border px-4 py-4 text-left transition ${selected ? "border-[#1A1C32] bg-[#f8fafc] shadow-sm" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <StatusChip tone={apiMethodTone(endpoint.method)}>{endpoint.method}</StatusChip>
                                  <span className="text-sm font-semibold text-slate-900">{endpoint.title}</span>
                                  <span className="text-xs uppercase tracking-[0.08em] text-slate-400">{endpoint.module}</span>
                                </div>
                                <div className="mt-2 break-all font-mono text-xs text-slate-500">{endpoint.publicPath}</div>
                                <p className="mt-2 text-sm text-slate-600">{endpoint.summary}</p>
                              </div>
                              <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                                Usar
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))
                )}
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                {selectedApiEndpoint ? (
                  <div className="space-y-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <StatusChip tone={apiMethodTone(selectedApiEndpoint.method)}>{selectedApiEndpoint.method}</StatusChip>
                          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{selectedApiEndpoint.module}</span>
                        </div>
                        <h4 className="mt-3 text-xl font-semibold text-slate-900">{selectedApiEndpoint.title}</h4>
                        <p className="mt-2 text-sm leading-6 text-slate-500">{selectedApiEndpoint.summary}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleCopyApiValue(`${publicUrls.apiBaseUrl}${selectedApiEndpoint.publicPath}`, "Rota publica copiada.")}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                        title="Copiar rota publica"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid gap-3">
                      <InfoRow title="Rota publica" subtitle={selectedApiEndpoint.publicPath} meta="Consumir externamente com a base publica da API" />
                      <InfoRow title="Preset do testador" subtitle={selectedApiEndpoint.testerPath} meta="Executa pela sessao autenticada do painel" />
                      <InfoRow title="Autenticacao" subtitle={selectedApiEndpoint.auth === "sessao" ? "Sessao autenticada" : "Publica"} meta={selectedApiEndpoint.permission ? `Permissao: ${selectedApiEndpoint.permission}` : "Sem permissao adicional declarada"} />
                    </div>

                    {selectedApiEndpoint.query?.length ? (
                      <div>
                        <div className="text-sm font-semibold text-slate-900">Parametros de consulta</div>
                        <div className="mt-3 space-y-2">
                          {(selectedApiEndpoint.query ?? []).map((item) => (
                            <div key={item.name} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                              <div className="font-mono text-xs font-semibold text-slate-700">{item.name}</div>
                              <div className="mt-1 text-sm text-slate-500">{item.description}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {selectedApiEndpoint.bodyExample ? (
                      <div>
                        <div className="text-sm font-semibold text-slate-900">Exemplo de corpo</div>
                        <pre className="mt-3 overflow-auto rounded-2xl border border-slate-200 bg-[#0f172a] p-4 text-xs leading-6 text-slate-100">{selectedApiEndpoint.bodyExample}</pre>
                      </div>
                    ) : null}

                    {selectedApiEndpoint.notes?.length ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                        <div className="font-semibold uppercase tracking-[0.08em]">Observacoes</div>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                          {(selectedApiEndpoint.notes ?? []).map((note) => (
                            <li key={note}>{note}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-8 text-sm text-slate-500">
                    Selecione uma rota na lista para ver a documentacao detalhada.
                  </div>
                )}
              </div>
            </div>
          </WorkspaceSection>

          <WorkspaceSection title="Console de teste" description="Execute chamadas da API usando a mesma sessao autenticada do painel.">
            <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="grid gap-3 md:grid-cols-[140px_1fr]">
                  <label className="text-sm font-medium text-slate-600">
                    Metodo
                    <select
                      value={apiTesterMethod}
                      onChange={(event) => setApiTesterMethod(event.target.value as ApiDocMethod)}
                      className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                    >
                      {(["GET", "POST", "PUT", "PATCH", "DELETE"] as ApiDocMethod[]).map((method) => (
                        <option key={method} value={method}>{method}</option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm font-medium text-slate-600">
                    Caminho
                    <input
                      value={apiTesterPath}
                      onChange={(event) => setApiTesterPath(event.target.value)}
                      placeholder="/tickets?status=open&isGroup=false"
                      className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                    />
                  </label>
                </div>

                <label className="mt-4 block text-sm font-medium text-slate-600">
                  Corpo JSON
                  <textarea
                    value={apiTesterBody}
                    onChange={(event) => setApiTesterBody(event.target.value)}
                    rows={14}
                    placeholder='{"body":"Mensagem de teste"}'
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-mono text-xs leading-6 text-slate-700 outline-none transition focus:border-slate-300"
                  />
                </label>

                {apiTesterError ? (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {apiTesterError}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void handleRunApiTester()}
                    disabled={apiTesterLoading}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#1A1C32] px-5 text-sm font-semibold text-white transition hover:bg-[#111426] disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <Play className="h-4 w-4" />
                    {apiTesterLoading ? "Executando..." : "Rodar teste"}
                  </button>
                  <button
                    type="button"
                    onClick={handleResetApiTester}
                    className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                  >
                    Restaurar preset
                  </button>
                  {selectedApiEndpoint ? (
                    <button
                      type="button"
                      onClick={() => void handleCopyApiValue(`${publicUrls.apiBaseUrl}${selectedApiEndpoint.publicPath}`, "Rota publica copiada.")}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                    >
                      <Copy className="h-4 w-4" />
                      Copiar rota publica
                    </button>
                  ) : null}
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  O console usa a sessao autenticada do painel e envia a chamada pelo mesmo proxy interno usado pela aplicacao.
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-base font-semibold text-slate-900">Resposta</h4>
                  {apiTesterResult ? (
                    <StatusChip tone={apiTesterResult!.ok ? "success" : "danger"}>
                      {apiTesterResult!.status} · {apiTesterResult!.durationMs} ms
                    </StatusChip>
                  ) : null}
                </div>

                {apiTesterResult ? (
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      <InfoRow title="Metodo" subtitle={apiTesterResult!.method} meta="Execucao atual" />
                      <InfoRow title="Caminho" subtitle={apiTesterResult!.requestedPath} meta={apiTesterResult!.contentType ?? "sem content-type"} />
                      <InfoRow title="Status" subtitle={String(apiTesterResult!.status)} meta={apiTesterResult!.ok ? "Resposta bem-sucedida" : "Resposta com erro"} />
                    </div>

                    <div>
                      <div className="text-sm font-semibold text-slate-900">Cabecalhos principais</div>
                      <div className="mt-3 grid gap-2">
                        {apiTesterResult!.headers.slice(0, 8).map((header) => (
                          <div key={header.key} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                            <div className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{header.key}</div>
                            <div className="mt-1 break-all text-slate-700">{header.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-semibold text-slate-900">Corpo da resposta</div>
                      <pre className="mt-3 max-h-[520px] overflow-auto rounded-2xl border border-slate-200 bg-[#0f172a] p-4 text-xs leading-6 text-slate-100">{apiTesterResult!.body}</pre>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-sm text-slate-500">
                    Selecione uma rota e rode um teste para inspecionar status, headers e corpo da resposta.
                  </div>
                )}
              </div>
            </div>
          </WorkspaceSection>
        </div>
      );
    }

    if (activeWorkspace === "contacts") {
      return (
        <div className="flex h-full flex-col gap-4 p-6">
          <WorkspaceSection title="Contatos" description="Visualizacao em lista dos contatos atendidos pela operacao.">
            <ModuleToolbar
              title="Contatos"
              count={filteredCustomers.length}
              searchValue={searchQuery}
              searchPlaceholder="Pesquisar contato, telefone ou empresa"
              onSearchChange={setSearchQuery}
              actionLabel={canManageContacts ? "Adicionar contato" : undefined}
              onActionClick={canManageContacts ? openCreateCustomerModal : undefined}
              actionIcon={Plus}
            />

            <DataTable
              columns={["Nome", "Telefone", "E-mail", "Empresa", "Ultimo ticket", "Atualizado em", "Ações"]}
              emptyMessage="Nenhum contato encontrado."
            >
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-sm text-slate-500">
                    Nenhum contato encontrado.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <DataRow key={customer.id}>
                    <DataCell>
                      {canManageContacts ? (
                        <button
                          type="button"
                          onClick={() => startEditCustomer(customer)}
                          className="text-left font-medium text-slate-900 transition hover:text-[#1A1C32]"
                        >
                          {customer.name}
                        </button>
                      ) : (
                        customer.name
                      )}
                    </DataCell>
                    <DataCell subtle>{customer.phone ?? "Sem telefone"}</DataCell>
                    <DataCell subtle>{customer.email ?? "Sem e-mail"}</DataCell>
                    <DataCell subtle>{customer.companyName ?? "Sem empresa"}</DataCell>
                    <DataCell subtle>
                      {customer.lastTicket ? (
                        <div className="space-y-1">
                          <div>{traduzirStatusTicket(customer.lastTicket.status)}</div>
                          <div className="text-xs text-slate-400">{customer.lastTicket.queueName ?? "Sem fila"}</div>
                        </div>
                      ) : (
                        "Sem historico"
                      )}
                    </DataCell>
                    <DataCell subtle>{formatDateTime(customer.updatedAt)}</DataCell>
                    <DataCell>
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => void handleOpenCustomerTickets(customer)} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900">
                          <Eye className="h-4 w-4" />
                          Ver tickets
                        </button>
                        {canManageContacts ? (
                          <button type="button" onClick={() => startEditCustomer(customer)} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900">
                            <Pencil className="h-4 w-4" />
                            Editar
                          </button>
                        ) : null}
                        {canManageContacts ? (
                          <button type="button" onClick={() => void handleDeleteCustomer(customer.id)} className="inline-flex items-center gap-2 text-sm font-medium text-rose-600 transition hover:text-rose-700">
                            <Trash2 className="h-4 w-4" />
                            Excluir
                          </button>
                        ) : null}
                      </div>
                    </DataCell>
                  </DataRow>
                ))
              )}
            </DataTable>
          </WorkspaceSection>
        </div>
      );
    }

    if (activeWorkspace === "profile") {
      return (
        <div className="flex h-full flex-col gap-4 p-6">
          <WorkspaceSection title="Meu perfil" description="Informações da sessão atual e atalhos pessoais.">
            <div className="grid gap-4">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                  {profileAvatarPreview ? (
                    <img src={profileAvatarPreview} alt={`Avatar de ${currentUser.name}`} className="h-24 w-24 rounded-full border border-slate-200 object-cover shadow-sm" />
                  ) : (
                    <div className="grid h-24 w-24 place-items-center rounded-full bg-[#1A1C32] text-3xl font-bold text-white">{initials(currentUser.name) || "CF"}</div>
                  )}
                  <div className="flex-1">
                    <div className="text-xl font-semibold text-slate-900">{currentUser.name}</div>
                    <div className="mt-1 text-sm text-slate-500">{currentUser.email}</div>
                    <div className="mt-4 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-600">{traduzirPerfil(currentUser.role)}</div>
                  </div>
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    Nome do usuário
                    <input
                      value={profileName}
                      onChange={(event) => setProfileName(event.target.value)}
                      className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-[#1A1C32]"
                      placeholder="Seu nome de exibição"
                    />
                  </label>
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="inline-flex h-12 cursor-pointer items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                      Enviar avatar
                      <input type="file" accept="image/*" className="hidden" onChange={(event) => void handleProfileAvatarChange(event)} />
                    </label>
                    {profileAvatarPreview ? (
                      <button type="button" onClick={() => setProfileAvatarPreview(null)} className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                        Remover avatar
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void handleSaveProfile()}
                      disabled={profileSaving || !profileName.trim()}
                      className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#1A1C32] px-5 text-sm font-semibold text-white transition hover:bg-[#23274a] disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {profileSaving ? "Salvando..." : "Salvar perfil"}
                    </button>
                  </div>
                </div>
              </div>
              <div className="grid gap-3">
                <InfoRow title="Sessão" subtitle="Autenticação ativa" meta="cookie httpOnly + backend próprio" />
                <InfoRow title="Tempo real" subtitle={SOCKET_URL ? "Tempo real configurado" : "Tempo real não configurado"} meta={SOCKET_URL ?? "atualização por consulta periódica"} />
                <button type="button" onClick={() => setActiveWorkspace("tickets")} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm transition hover:bg-slate-50"><div className="font-semibold text-slate-900">Voltar à caixa de entrada</div><div className="mt-1 text-sm text-slate-500">Abrir conversas e continuar o atendimento.</div></button>
                <button type="button" onClick={() => void handleLogout()} className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-left shadow-sm transition hover:bg-red-100"><div className="font-semibold text-red-700">Encerrar sessão</div><div className="mt-1 text-sm text-red-500">Sair do painel com segurança.</div></button>
              </div>
            </div>
          </WorkspaceSection>
        </div>
      );
    }

    if (activeWorkspace === "calendar") {
      return (
        <div className="flex h-full flex-col gap-4 p-6">
          <WorkspaceSection title="Mensagens agendadas" description="Acompanhe, edite e exclua mensagens programadas para envio.">
            <ModuleToolbar
              title="Mensagens agendadas"
              count={filteredScheduledMessageOverview.length}
              searchValue={searchQuery}
              searchPlaceholder="Pesquisar contato, fila, responsável ou mensagem"
              onSearchChange={setSearchQuery}
            />
            <div className="mb-4 flex flex-wrap gap-2">
              {[
                { key: "pending", label: "Agendadas" },
                { key: "processing", label: "Processando" },
                { key: "failed", label: "Falhas" },
                { key: "sent", label: "Enviadas" },
                { key: "canceled", label: "Canceladas" },
                { key: "all", label: "Todas" },
              ].map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setScheduledMessageStatusFilter(filter.key as typeof scheduledMessageStatusFilter)}
                  className={`inline-flex h-9 items-center justify-center rounded-2xl border px-4 text-sm font-semibold transition ${
                    scheduledMessageStatusFilter === filter.key
                      ? "border-[#1A1C32] bg-[#1A1C32] text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <DataTable columns={["Destino", "Agendado para", "Status", "Ações"]} emptyMessage={scheduledMessageOverviewLoading ? "Carregando mensagens agendadas..." : "Nenhuma mensagem agendada encontrada."}>
              {filteredScheduledMessageOverview.map((item) => (
                <DataRow key={item.id}>
                  <DataCell>
                    <button
                      type="button"
                      onClick={() => setScheduledMessageViewer(item)}
                      className="text-left"
                    >
                      <div className="font-semibold text-slate-900">{item.ticket?.customerName ?? "Ticket"}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {item.ticket?.currentQueue?.name ?? "Sem fila"} • {item.ticket?.whatsappInstance.name ?? "Sem instância"}
                      </div>
                    </button>
                  </DataCell>
                  <DataCell>
                    <div className="text-sm text-slate-700">{formatDateTime(item.sendAt)}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.createdBy.name}</div>
                  </DataCell>
                  <DataCell>
                    <StatusChip tone={tomMensagemAgendada(item.status)}>{traduzirStatusMensagemAgendada(item.status)}</StatusChip>
                    {item.errorMessage ? <div className="mt-1 max-w-[260px] text-xs text-red-500">{item.errorMessage}</div> : null}
                  </DataCell>
                  <DataCell>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setScheduledMessageViewer(item)}
                        className="inline-flex h-8 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        Ver ticket
                      </button>
                      {item.status !== "sent" && item.status !== "canceled" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenScheduledMessageEditor(item)}
                            className="inline-flex h-8 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => setScheduledMessageDeleteTarget(item)}
                            className="inline-flex h-8 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 text-[11px] font-semibold text-red-600 transition hover:bg-red-100"
                          >
                            Excluir
                          </button>
                        </>
                      ) : null}
                    </div>
                  </DataCell>
                </DataRow>
              ))}
            </DataTable>
          </WorkspaceSection>
        </div>
      );
    }

    if (activeWorkspace === "automations") {
      return (
        <div className="flex h-full flex-col gap-4 p-6">
          <div className="grid gap-4 xl:grid-cols-3">
            <WorkspaceStatCard
              title="Automações"
              value={String(automations.length)}
              description="Regras configuradas para acionar fluxos automáticos."
              accent="blue"
            />
            <WorkspaceStatCard
              title="Ativas"
              value={String(automations.filter((item) => item.status === "active").length)}
              description="Automações prontas para execução na operação."
              accent="emerald"
            />
            <WorkspaceStatCard
              title="Execuções recentes"
              value={String(automationExecutions.length)}
              description="Últimos disparos registrados pelo módulo."
              accent="amber"
            />
          </div>

          <WorkspaceSection
            title="Automações"
            description="Monte regras com gatilho, filtros e ação para o atendimento operacional."
          >
            <ModuleToolbar
              title={automationView === "rules" ? "Regras automatizadas" : "Execuções"}
              count={automationView === "rules" ? filteredAutomations.length : filteredAutomationExecutions.length}
              searchValue={searchQuery}
              searchPlaceholder={
                automationView === "rules"
                  ? "Pesquisar regra, gatilho, fila ou ação"
                  : "Pesquisar automação, status ou resultado"
              }
              onSearchChange={setSearchQuery}
              actionLabel={automationView === "rules" && canManageAutomations ? "Nova automação" : undefined}
              onActionClick={automationView === "rules" && canManageAutomations ? openCreateAutomationModal : undefined}
              actionIcon={Workflow}
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAutomationView("rules")}
                className={`inline-flex h-10 items-center justify-center rounded-2xl border px-4 text-sm font-semibold transition ${
                  automationView === "rules"
                    ? "border-[#1A1C32] bg-[#1A1C32] text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                Regras
              </button>
              <button
                type="button"
                onClick={() => setAutomationView("executions")}
                className={`inline-flex h-10 items-center justify-center rounded-2xl border px-4 text-sm font-semibold transition ${
                  automationView === "executions"
                    ? "border-[#1A1C32] bg-[#1A1C32] text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                Execuções
              </button>
            </div>

            {automationView === "rules" ? (
              automationLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-8 text-sm text-slate-500">
                  Carregando automações...
                </div>
              ) : filteredAutomations.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-sm text-slate-500">
                  Nenhuma automação cadastrada ainda. Crie a primeira regra para começar a automatizar o atendimento.
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {filteredAutomations.map((item) => (
                    <article key={item.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusChip
                              tone={item.status === "active" ? "success" : item.status === "inactive" ? "warning" : "default"}
                            >
                              {translateAutomationStatus(item.status)}
                            </StatusChip>
                            <StatusChip>{translateAutomationTrigger(item.triggerType)}</StatusChip>
                          </div>
                          <h4 className="text-lg font-semibold text-slate-900">{item.name}</h4>
                          {item.description ? <p className="text-sm text-slate-500">{item.description}</p> : null}
                        </div>
                        <div className="text-right text-xs text-slate-400">
                          <div>Atualizada em</div>
                          <div className="mt-1 font-semibold text-slate-500">{formatDateTime(item.updatedAt)}</div>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Escopo</div>
                          <div className="mt-2 text-sm font-semibold text-slate-800">{item.queue?.name ?? "Todas as filas"}</div>
                          <div className="mt-1 text-xs text-slate-500">{item.whatsappInstance?.name ?? "Todas as instâncias"}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Ação principal</div>
                          <div className="mt-2 text-sm font-semibold text-slate-800">
                            {item.actions[0] ? formatAutomationActionSummary(item.actions[0]) : "Sem ação"}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {item.executionCount} execução(ões) registrada(s)
                          </div>
                        </div>
                      </div>

                      {item.conditions.length > 0 ? (
                        <div className="mt-4">
                          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Condições</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {item.conditions.map((condition, index) => (
                              <span
                                key={`${item.id}-condition-${index}`}
                                className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600"
                              >
                                {formatAutomationCondition(condition)}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {item.latestExecution ? (
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold text-slate-800">Última execução</span>
                            <StatusChip
                              tone={
                                item.latestExecution.status === "success"
                                  ? "success"
                                  : item.latestExecution.status === "failed"
                                    ? "danger"
                                    : "warning"
                              }
                            >
                              {translateAutomationExecutionStatus(item.latestExecution.status)}
                            </StatusChip>
                          </div>
                          <div className="mt-2 text-xs text-slate-500">{formatDateTime(item.latestExecution.executedAt)}</div>
                          {item.latestExecution.message ? (
                            <div className="mt-2 text-sm text-slate-600">{item.latestExecution.message}</div>
                          ) : null}
                        </div>
                      ) : null}

                      {canManageAutomations ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEditAutomation(item)}
                            className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteAutomation(item.id, item.name)}
                            className="inline-flex h-10 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                          >
                            Excluir
                          </button>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              )
            ) : (
              <DataTable
                columns={["Automação", "Gatilho", "Status", "Executada em", "Resultado"]}
                emptyMessage={automationExecutionLoading ? "Carregando execuções..." : "Nenhuma execução registrada."}
              >
                {filteredAutomationExecutions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-sm text-slate-500">
                      {automationExecutionLoading ? "Carregando execuções..." : "Nenhuma execução registrada."}
                    </td>
                  </tr>
                ) : (
                  filteredAutomationExecutions.map((item) => (
                    <DataRow key={item.id}>
                      <DataCell>
                        <div className="font-semibold text-slate-900">{item.automation.name}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {translateAutomationStatus(item.automation.status)}
                        </div>
                      </DataCell>
                      <DataCell subtle>{translateAutomationTrigger(item.automation.triggerType)}</DataCell>
                      <DataCell>
                        <StatusChip
                          tone={item.status === "success" ? "success" : item.status === "failed" ? "danger" : "warning"}
                        >
                          {translateAutomationExecutionStatus(item.status)}
                        </StatusChip>
                      </DataCell>
                      <DataCell subtle>{formatDateTime(item.executedAt)}</DataCell>
                      <DataCell subtle>{item.message ?? "Execução registrada sem observações."}</DataCell>
                    </DataRow>
                  ))
                )}
              </DataTable>
            )}
          </WorkspaceSection>
        </div>
      );
    }

    if (activeWorkspace === "settings") {
      return (
        <div className="flex h-full flex-col gap-4 p-6">
          <div className="flex flex-wrap gap-2">
            <AdminTab label="Identidade visual" active={adminSection === "branding"} onClick={() => setAdminSection("branding")} />
            <AdminTab label="Instâncias" active={adminSection === "instances"} onClick={() => setAdminSection("instances")} />
            <AdminTab label="Agentes" active={adminSection === "agents"} onClick={() => setAdminSection("agents")} />
            <AdminTab label="Filas" active={adminSection === "queues"} onClick={() => setAdminSection("queues")} />
          </div>

          {adminSection === "branding" ? (
            <WorkspaceSection title="Identidade visual" description="Personalize a marca principal exibida no topo do painel.">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_320px]">
                <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff,#f5f8fb)] p-5 shadow-sm">
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Logo superior</div>
                  <div className="mt-3 rounded-[24px] bg-[#1A1C32] p-5 shadow-[0_20px_40px_rgba(26,28,50,0.22)]">
                    <div className="flex items-center gap-4">
                      {shouldRenderBrandImage ? (
                        <div className="flex min-h-[64px] min-w-[200px] items-center px-2 py-2">
                          <img src={brandLogoPreview ?? undefined} alt="Logo do painel" className="max-h-11 w-auto object-contain" />
                        </div>
                      ) : shouldRenderBrandText ? (
                        <div className="flex min-h-[64px] min-w-[200px] items-center px-2 py-2">
                          <div className="text-[30px] font-semibold leading-none tracking-tight text-white">{brandTextLabel}</div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-white/10">
                            <ShieldCheck className="h-5 w-5 text-white" />
                          </span>
                          <div>
                            <div className="text-xl font-semibold tracking-tight text-white">CHATFLOW</div>
                            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Marca padrão</div>
                          </div>
                        </div>
                      )}

                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Prévia</div>
                        <div className="mt-1 text-sm font-semibold text-white">{workspaceTitle}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-sm font-semibold text-[#1A1C32]">Marca do cabeçalho</div>
                  <p className="mt-2 text-sm text-slate-500">Escolha se quer manter a marca padrão, usar uma imagem transparente ou escrever um texto personalizado.</p>
                  <div className="mt-4 grid gap-2">
                    <button
                      type="button"
                      onClick={() => handleBrandModeChange("default")}
                      className={`inline-flex h-10 items-center justify-center rounded-2xl border px-4 text-sm font-semibold transition ${
                        brandMode === "default"
                          ? "border-[#1A1C32] bg-[#1A1C32] text-white"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Marca padrão
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBrandModeChange("image")}
                      className={`inline-flex h-10 items-center justify-center rounded-2xl border px-4 text-sm font-semibold transition ${
                        brandMode === "image"
                          ? "border-[#1A1C32] bg-[#1A1C32] text-white"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Usar imagem
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBrandModeChange("text")}
                      className={`inline-flex h-10 items-center justify-center rounded-2xl border px-4 text-sm font-semibold transition ${
                        brandMode === "text"
                          ? "border-[#1A1C32] bg-[#1A1C32] text-white"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Usar texto
                    </button>
                  </div>

                  <div className="mt-4 flex flex-col gap-3">
                    <div>
                      <div className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Texto personalizado</div>
                      <input
                        type="text"
                        value={brandText}
                        onChange={(event) => handleBrandTextChange(event.target.value)}
                        placeholder="Digite o texto do cabeçalho"
                        className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm text-slate-700 outline-none transition focus:border-[#1A1C32]"
                      />
                    </div>
                    <label className="inline-flex h-11 cursor-pointer items-center justify-center rounded-2xl bg-[#1A1C32] px-5 text-sm font-semibold text-white transition hover:bg-[#232643]">
                      <input type="file" accept="image/*" className="hidden" onChange={(event) => void handleBrandLogoChange(event)} />
                      {brandLogoPreview ? "Trocar logo" : "Enviar logo"}
                    </label>
                    <button
                      type="button"
                      onClick={handleRemoveBrandLogo}
                      disabled={!brandLogoPreview}
                      className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Remover logo
                    </button>
                  </div>
                  <div className="mt-4 space-y-2 text-xs text-slate-400">
                    <div>Formato recomendado: PNG ou SVG convertido em imagem.</div>
                    <div>Tamanho máximo: 2 MB.</div>
                    <div>O texto personalizado aparece no lugar da imagem quando o modo "Usar texto" estiver ativo.</div>
                  </div>
                </div>
              </div>
            </WorkspaceSection>
          ) : adminSection === "instances" ? (
            <WorkspaceSection title="Canais e instâncias" description="Gerencie as conexões com a Evolution em um único lugar dentro das configurações.">
              <ModuleToolbar
                title="Conexões"
                count={filteredInstances.length}
                searchValue={searchQuery}
                searchPlaceholder="Pesquisar instância, telefone ou status"
                onSearchChange={setSearchQuery}
                actionLabel={canManageInstances ? "Nova conexão" : undefined}
                onActionClick={canManageInstances ? openCreateInstanceModal : undefined}
                actionIcon={Plus}
              />

                <DataTable columns={["Nome", "ID", "Evolution", "Status", "Telefone", "URL base", "Criado em", "Ações"]} emptyMessage="Nenhuma instância cadastrada.">
                {filteredInstances.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-8 text-sm text-slate-500">
                        Nenhuma instância cadastrada.
                      </td>
                    </tr>
                  ) : (
                    filteredInstances.map((instance) => (
                      <DataRow key={instance.id}>
                        <DataCell>{instance.name}</DataCell>
                        <DataCell subtle><span className="font-mono text-xs">{instance.publicId}</span></DataCell>
                        <DataCell subtle>{instance.evolutionInstanceName}</DataCell>
                      <DataCell>
                        <StatusChip tone={instance.status === "connected" ? "success" : instance.status === "error" ? "danger" : "warning"}>
                          {traduzirStatusInstancia(instance.status)}
                        </StatusChip>
                      </DataCell>
                      <DataCell subtle>{instance.phoneNumber ?? "Sem número"}</DataCell>
                      <DataCell subtle>{instance.baseUrl}</DataCell>
                      <DataCell subtle>{formatDateTime(instance.createdAt)}</DataCell>
                      <DataCell>
                        {canManageInstances ? (
                          <button type="button" onClick={() => startEditInstance(instance)} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900">
                            <Pencil className="h-4 w-4" />
                            Editar
                          </button>
                        ) : null}
                      </DataCell>
                    </DataRow>
                  ))
                )}
              </DataTable>

              <div className="grid gap-3">
                <InfoRow title="Webhook sugerido" subtitle="Endpoint público para eventos da Evolution" meta={publicUrls.webhookUrl} />
                <InfoRow title="Frontend publicado" subtitle="URL operacional do painel" meta={publicUrls.webBaseUrl} />
              </div>
            </WorkspaceSection>
          ) : adminSection === "agents" ? (
            <WorkspaceSection title="Equipe" description="Criação, leitura e distribuição dos agentes do sistema.">
              <ModuleToolbar
                title="Usuários"
                count={filteredAgents.length}
                searchValue={searchQuery}
                searchPlaceholder="Pesquisar nome, e-mail ou fila"
                onSearchChange={setSearchQuery}
                actionLabel={canManageAgents ? "Adicionar usuário" : undefined}
                onActionClick={canManageAgents ? openCreateAgentModal : undefined}
                actionIcon={UserPlus}
              />

                <DataTable columns={["Nome", "ID", "E-mail", "Perfil", "Presença", "Filas", "Ações"]} emptyMessage="Nenhum agente cadastrado.">
                {filteredAgents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-sm text-slate-500">
                        Nenhum agente cadastrado.
                      </td>
                    </tr>
                  ) : (
                    filteredAgents.map((agent) => (
                      <DataRow key={agent.id}>
                        <DataCell>
                          <div className="flex items-center gap-2">
                            <span>{agent.name}</span>
                            {agent.isBotAgent ? (
                              <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">
                                BOT
                              </span>
                            ) : null}
                          </div>
                        </DataCell>
                        <DataCell subtle><span className="font-mono text-xs">{agent.publicId}</span></DataCell>
                        <DataCell subtle>{agent.email}</DataCell>
                      <DataCell>
                        <StatusChip tone={agent.role === "admin" ? "default" : "success"}>{traduzirPerfil(agent.role)}</StatusChip>
                      </DataCell>
                      <DataCell subtle>{agent.presence}</DataCell>
                      <DataCell subtle>{agent.queues.map((queue) => queue.name).join(", ") || "Sem filas"}</DataCell>
                      <DataCell>
                        {canManageAgents || canDeleteAgents ? (
                          <div className="flex items-center gap-4">
                            {canManageAgents ? (
                              <>
                                <button type="button" onClick={() => startDuplicateAgent(agent)} className="inline-flex items-center gap-2 text-sm font-medium text-sky-600 transition hover:text-sky-700">
                                  <Plus className="h-4 w-4" />
                                  Duplicar
                                </button>
                                <button type="button" onClick={() => startEditAgent(agent)} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900">
                                  <Pencil className="h-4 w-4" />
                                  Editar
                                </button>
                              </>
                            ) : null}
                            {canDeleteAgents && agent.id !== currentUser.id ? (
                              <button type="button" onClick={() => void handleDeleteAgent(agent.id, agent.name)} className="inline-flex items-center gap-2 text-sm font-medium text-rose-600 transition hover:text-rose-700">
                                <Trash2 className="h-4 w-4" />
                                Excluir
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </DataCell>
                    </DataRow>
                  ))
                )}
              </DataTable>
            </WorkspaceSection>
          ) : (
            <WorkspaceSection title="Filas e membros" description="Distribuição de agentes e leitura do volume atual.">
              <ModuleToolbar
                title="Filas"
                count={filteredQueues.length}
                searchValue={searchQuery}
                searchPlaceholder="Pesquisar fila ou membro"
                onSearchChange={setSearchQuery}
                actionLabel={canManageQueues ? "Adicionar fila" : undefined}
                onActionClick={canManageQueues ? openCreateQueueModal : undefined}
                actionIcon={Workflow}
              />

                <DataTable columns={["Fila", "ID", "Cor", "Agentes", "Tickets abertos", "Ações"]} emptyMessage="Nenhuma fila cadastrada.">
                {filteredQueues.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-sm text-slate-500">
                        Nenhuma fila cadastrada.
                      </td>
                    </tr>
                  ) : (
                    filteredQueues.map((queue) => (
                      <DataRow key={queue.id}>
                        <DataCell>
                          <div className="flex items-center gap-2">
                            <span>{queue.name}</span>
                            {queue.isBotQueue ? <StatusChip tone="default">BOT</StatusChip> : null}
                          </div>
                        </DataCell>
                        <DataCell subtle><span className="font-mono text-xs">{queue.publicId}</span></DataCell>
                        <DataCell>
                          <div className="flex items-center gap-2">
                          <span className="h-4 w-10 rounded-sm border border-slate-200" style={{ backgroundColor: queue.color ?? "#1A1C32" }} />
                          <span className="text-sm text-slate-500">{queue.color ?? "#1A1C32"}</span>
                        </div>
                      </DataCell>
                      <DataCell subtle>{queue.agents.map((agent) => agent.name).join(", ") || "Sem membros"}</DataCell>
                      <DataCell subtle>{queue.openTicketCount}</DataCell>
                      <DataCell>
                        {canManageQueues ? (
                          <button type="button" onClick={() => startEditQueue(queue)} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900">
                            <Pencil className="h-4 w-4" />
                            Editar
                          </button>
                        ) : null}
                      </DataCell>
                    </DataRow>
                  ))
                )}
              </DataTable>

              <div className="grid gap-3">
                {filteredQueues.map((queue) => (
                  <QueueEditor key={queue.id} queue={queue} agents={agents} loading={assignmentLoading === queue.id} canEdit={canAssignQueues} onSave={handleAssignQueueAgents} onChange={setQueues} />
                ))}
              </div>
            </WorkspaceSection>
          )}
        </div>
      );
    }

    return (
      <>
        {selectedTicket ? (
          <>
            <div className="border-b border-slate-200 bg-white px-3 py-3 md:px-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
                <div className="flex items-center gap-3 md:gap-4">
                  {isMobileViewport ? (
                    <button
                      type="button"
                      aria-label="Voltar para a lista de tickets"
                      title="Voltar"
                      onClick={() => {
                        setShowTicketDetails(false);
                        setMobileTicketView("list");
                      }}
                      className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                  ) : null}
                  <SafeAvatar
                    src={selectedTicket.customerAvatarUrl}
                    name={selectedTicket.customerName}
                    alt={`Foto de ${selectedTicket.customerName}`}
                    className="grid h-12 w-12 place-items-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-700"
                  />
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => setShowTicketDetails(true)}
                      className="max-w-full text-left transition hover:opacity-80"
                    >
                      <h3 className="truncate text-[16px] font-semibold leading-tight tracking-[-0.02em] text-[#1A1C32]">{selectedTicketDisplayName}</h3>
                    </button>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-slate-500">
                      <span>{formatContactIdentity(selectedTicket.externalContactId ?? selectedTicket.externalChatId)}</span>
                      <span className="text-slate-300">•</span>
                      <span>{selectedTicket.isGroup ? "Conversa compartilhada" : (selectedTicket.currentAgent?.name ?? "Aguardando atendente")}</span>
                    </div>
                  </div>
                </div>

                {isMobileViewport ? (
                  <div ref={mobileTicketActionsRef} className="relative self-start">
                    <button
                      type="button"
                      aria-label="Abrir ações do atendimento"
                      title="Ações"
                      aria-expanded={mobileTicketActionsOpen}
                      onClick={() => setMobileTicketActionsOpen((current) => !current)}
                      className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600 transition hover:bg-slate-50"
                    >
                      <Menu className="h-4 w-4" />
                      Ações
                      <ChevronDown className={`h-3.5 w-3.5 transition ${mobileTicketActionsOpen ? "rotate-180" : ""}`} />
                    </button>
                    {mobileTicketActionsOpen ? (
                      <div className="absolute left-0 top-[calc(100%+0.65rem)] z-[65] w-[min(84vw,320px)] rounded-[24px] border border-slate-200 bg-white p-2 shadow-[0_24px_60px_rgba(15,23,42,0.16)]">
                        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Ações do atendimento</div>
                        <div className="space-y-1">
                          {canDeleteSelectedTicket ? (
                            <button
                              type="button"
                              onClick={() => {
                                setMobileTicketActionsOpen(false);
                                void handleDeleteSelectedTicket();
                              }}
                              disabled={bulkDeleteLoading}
                              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-300"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span>Apagar ticket</span>
                            </button>
                          ) : null}
                          {canBulkDeleteMessages ? (
                            <button
                              type="button"
                              onClick={() => {
                                setMobileTicketActionsOpen(false);
                                if (messageBulkSelectionMode) {
                                  cancelMessageBulkSelectionMode();
                                } else {
                                  startMessageBulkSelectionMode();
                                }
                              }}
                              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm transition ${
                                messageBulkSelectionMode
                                  ? "bg-rose-50 text-rose-700 hover:bg-rose-100"
                                  : "text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span>{messageBulkSelectionMode ? "Cancelar seleção" : "Apagar mensagens"}</span>
                            </button>
                          ) : null}
                          {!selectedTicket.isGroup ? (
                            <button
                              type="button"
                              onClick={() => {
                                setMobileTicketActionsOpen(false);
                                void handleAcceptTicket();
                              }}
                              disabled={!canAcceptSelectedTicket}
                              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm text-[#385a7a] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                            >
                              <CheckSquare className="h-4 w-4" />
                              <span>{selectedTicket.currentAgent?.id === currentUser.id ? "Em atendimento" : selectedTicket.status === "closed" ? "Atendimento fechado" : "Aceitar atendimento"}</span>
                            </button>
                          ) : null}
                          {canTransferSelectedTicket ? (
                            <button
                              type="button"
                              onClick={() => {
                                setMobileTicketActionsOpen(false);
                                setShowTransferPanel(true);
                              }}
                              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                            >
                              <ArrowRightLeft className="h-4 w-4" />
                              <span>Transferir</span>
                            </button>
                          ) : null}
                          {canNudgeSelectedTicket ? (
                            <button
                              type="button"
                              onClick={() => {
                                setMobileTicketActionsOpen(false);
                                void handleNudgeTicket();
                              }}
                              disabled={nudgeLoading}
                              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:text-slate-400"
                            >
                              <Zap className="h-4 w-4" />
                              <span>{nudgeLoading ? "Enviando alerta..." : "Chamar atenção"}</span>
                            </button>
                          ) : null}
                          {selectedTicket.status === "closed" ? (
                            <button
                              type="button"
                              onClick={() => {
                                setMobileTicketActionsOpen(false);
                                void handleReopenTicket();
                              }}
                              disabled={!canReopenSelectedTicket}
                              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm text-emerald-600 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:text-slate-400"
                            >
                              <RefreshCw className="h-4 w-4" />
                              <span>Reabrir</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setMobileTicketActionsOpen(false);
                                void handleCloseTicket();
                              }}
                              disabled={!canCloseSelectedTicket}
                              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-400"
                            >
                              <X className="h-4 w-4" />
                              <span>Fechar</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setMobileTicketActionsOpen(false);
                              void openTicketHistoryViewer(selectedTicket);
                            }}
                            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                          >
                            <Info className="h-4 w-4" />
                            <span>Histórico do ticket</span>
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {canDeleteSelectedTicket ? (
                      <button
                        type="button"
                        aria-label="Apagar ticket selecionado"
                        title="Apagar ticket"
                        onClick={() => void handleDeleteSelectedTicket()}
                        disabled={bulkDeleteLoading}
                        className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-white disabled:text-slate-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                    {canBulkDeleteMessages ? (
                      <button
                        type="button"
                        aria-label={messageBulkSelectionMode ? "Cancelar seleção de mensagens" : "Selecionar mensagens para apagar"}
                        title={messageBulkSelectionMode ? "Cancelar seleção de mensagens" : "Selecionar mensagens para apagar"}
                        onClick={() => {
                          if (messageBulkSelectionMode) {
                            cancelMessageBulkSelectionMode();
                          } else {
                            startMessageBulkSelectionMode();
                          }
                        }}
                        className={`inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[10px] font-bold uppercase tracking-[0.12em] transition ${
                          messageBulkSelectionMode
                            ? "border-rose-200 bg-rose-50 text-rose-700"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {messageBulkSelectionMode ? "Cancelar seleção" : "Apagar mensagens"}
                      </button>
                    ) : null}
                    {!selectedTicket.isGroup ? (
                      <button type="button" aria-label="Assumir atendimento selecionado" title="Assumir atendimento" onClick={() => void handleAcceptTicket()} disabled={!canAcceptSelectedTicket} className="inline-flex h-9 items-center gap-2 rounded-full bg-[#e7eff8] px-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#385a7a] transition hover:bg-[#dbe7f3] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500">
                        <CheckSquare className="h-4 w-4" />
                        {selectedTicket.currentAgent?.id === currentUser.id ? "Em atendimento" : selectedTicket.status === "closed" ? "Atendimento fechado" : "Aceitar atendimento"}
                      </button>
                    ) : null}
                    {canTransferSelectedTicket ? (
                      <button
                        type="button"
                        aria-label={showTransferPanel ? "Fechar popup de transferência" : "Transferir atendimento"}
                        title="Transferir atendimento"
                        onClick={() => setShowTransferPanel(true)}
                        className={`inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[10px] font-bold uppercase tracking-[0.12em] transition ${showTransferPanel ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                        Transferir
                      </button>
                    ) : null}
                    {canNudgeSelectedTicket ? (
                      <button
                        type="button"
                        aria-label="Chamar atenção do responsável"
                        title="Chamar atenção do responsável"
                        onClick={() => void handleNudgeTicket()}
                        disabled={nudgeLoading}
                        className="inline-flex h-9 items-center gap-2 rounded-full border border-amber-200 bg-white px-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                      >
                        <Zap className="h-3.5 w-3.5" />
                        {nudgeLoading ? "Enviando..." : "Chamar atenção"}
                      </button>
                    ) : null}
                    {selectedTicket.status === "closed" ? (
                      <button type="button" aria-label="Reabrir atendimento selecionado" title="Reabrir atendimento" onClick={() => void handleReopenTicket()} disabled={!canReopenSelectedTicket} className="inline-flex h-9 items-center gap-2 rounded-full border border-emerald-200 bg-white px-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-600 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400">
                        <RefreshCw className="h-3.5 w-3.5" />
                        Reabrir
                      </button>
                    ) : (
                      <button type="button" aria-label="Fechar atendimento selecionado" title="Fechar atendimento" onClick={() => void handleCloseTicket()} disabled={!canCloseSelectedTicket} className="inline-flex h-9 items-center gap-2 rounded-full border border-red-200 bg-white px-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400">
                        <X className="h-3.5 w-3.5" />
                        Fechar
                      </button>
                    )}
                    <button type="button" aria-label="Abrir histórico do ticket" title="Histórico do ticket" onClick={() => void openTicketHistoryViewer(selectedTicket)} className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-700">
                      <Info className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div
              className="flex min-h-0 flex-1 overflow-hidden"
              onDragEnter={handleComposerDragEnter}
              onDragOver={handleComposerDragOver}
              onDragLeave={handleComposerDragLeave}
              onDrop={(event) => void handleComposerDrop(event)}
            >
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div
                ref={messagesViewportRef}
                onScroll={handleMessagesScroll}
                className="scrollbar-hide flex-1 overflow-y-auto px-4 py-5 md:px-6"
                style={{
                  backgroundColor: "#efe8dd",
                  backgroundImage:
                    "radial-gradient(rgba(140,120,90,0.06) 1px, transparent 1px), radial-gradient(rgba(140,120,90,0.04) 1px, transparent 1px)",
                  backgroundPosition: "0 0, 12px 12px",
                  backgroundSize: "24px 24px",
                }}
              >
                <div className="mx-auto flex max-w-5xl flex-col gap-4">
                  {messageBulkSelectionMode ? (
                    <div className="sticky top-0 z-20 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {selectedMessageIdsForBulkDelete.length} mensagem(ns) selecionada(s)
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={cancelMessageBulkSelectionMode}
                          className="inline-flex h-8 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleBulkDeleteMessages()}
                          disabled={bulkDeleteLoading || selectedMessageIdsForBulkDelete.length === 0}
                          className="inline-flex h-8 items-center justify-center rounded-xl bg-rose-600 px-3 text-[11px] font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          {bulkDeleteLoading ? "Apagando..." : "Apagar selecionadas"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {messageLoading ? (
                    <div className="text-center text-sm text-slate-500">Carregando mensagens...</div>
                  ) : messages.length === 0 ? (
                    <EmptyMessages />
                    ) : (
                      messages.map((message) => {
                        const outgoing = message.direction === "outbound";
                        const system = message.direction === "system";
                        const internalNote = Boolean(message.internalNote);
                        const isDeletedMessage = Boolean(message.deleted?.isDeleted);
                        const hasAttachment = Boolean(message.attachments?.length);
                        const normalizedBody = (message.body ?? "").trim();
                        const shouldShowInboundGroupSender =
                          Boolean(selectedTicket?.isGroup) &&
                          !outgoing &&
                          !system &&
                          Boolean(message.senderName?.trim());
                        const canEditMessage = outgoing && !hasAttachment && Boolean(normalizedBody) && !isDeletedMessage;
                        const canDeleteMessage = outgoing && !isDeletedMessage;
                        const canDeleteMessageForMe = !system;
                        const canReplyToMessage = !system && !internalNote && !isEditingMessage && !isDeletedMessage;
                        const canForwardMessage = !system && !internalNote && !isDeletedMessage;
                        const messageMenuActionCount =
                          (canReplyToMessage ? 1 : 0)
                          + (canForwardMessage ? 1 : 0)
                          + (canEditMessage ? 1 : 0)
                          + (canDeleteMessage ? 1 : 0)
                          + (canDeleteMessageForMe ? 1 : 0);
                        const messageMenuEstimatedHeight =
                          16
                          + (canReplyToMessage ? 48 : 0)
                          + (messageMenuActionCount * 44);
                        const parsedSignedBody = outgoing && !internalNote ? parseMessageSignature(message.body) : null;
                        const displayedMessageSignature = parsedSignedBody?.signature ?? null;
                        const displayedMessageBody = parsedSignedBody ? parsedSignedBody.body : (message.body ?? "");
                        const groupedReactions = (message.reactions ?? []).reduce<Record<string, number>>((acc, reaction) => {
                          acc[reaction.emoji] = (acc[reaction.emoji] ?? 0) + 1;
                          return acc;
                        }, {});
                        const messageAttachments = message.attachments ?? [];
                        const hasImageAttachment = messageAttachments.some((attachment) => attachment.mimeType.startsWith("image/"));
                        const hasAudioAttachment = messageAttachments.some((attachment) => attachment.mimeType.startsWith("audio/"));
                        const hasVideoAttachment = messageAttachments.some((attachment) => attachment.mimeType.startsWith("video/"));
                        const hasStickerAttachment = message.contentType === "sticker" || messageAttachments.some((attachment) => attachment.mimeType === "image/webp");
                        const hasDocumentAttachment = messageAttachments.some((attachment) => !attachment.mimeType.startsWith("image/") && !attachment.mimeType.startsWith("audio/") && !attachment.mimeType.startsWith("video/"));
                        const isContactCardMessage = message.contentType === "contact";
                        const sharedContact = isContactCardMessage ? parseSharedContactMessage(message.body) : null;
                        const selectedForBulkDelete = selectedMessageIdsForBulkDelete.includes(message.id);
                        const matchesAttachmentFileName = messageAttachments.some((attachment) => {
                          const attachmentFileName = (attachment.fileName ?? "").trim().toLowerCase();
                          return Boolean(attachmentFileName) && normalizedBody.toLowerCase() === attachmentFileName;
                        });
                        const shouldHideMessageBody =
                          messageAttachments.length > 0 &&
                          (
                            !normalizedBody
                          || ((hasImageAttachment || hasStickerAttachment) && /^imagem recebida$/i.test(normalizedBody))
                          || (hasAudioAttachment && /^audio recebido$/i.test(normalizedBody))
                          || (hasVideoAttachment && /^video recebido$/i.test(normalizedBody))
                          || (hasDocumentAttachment && /^documento recebido$/i.test(normalizedBody))
                          || (hasStickerAttachment && /^sticker recebido$/i.test(normalizedBody))
                          || matchesAttachmentFileName
                          || /^\[(image|audio|document|video)\]\s/i.test(normalizedBody)
                        );
                        const shouldRenderAttachments = messageAttachments.length > 0;

                      if (system) {
                        return (
                          <div key={message.id} className="self-center rounded-full bg-slate-200 px-4 py-2 text-[11px] font-bold uppercase text-slate-500">
                            {message.body ?? "Evento interno"}
                          </div>
                        );
                      }

                      return (
                          <div key={message.id} className={`group flex flex-col ${outgoing ? "items-end" : "items-start"}`}>
                            <div className={`flex max-w-full items-start gap-2 ${outgoing ? "flex-row-reverse" : ""}`}>
                              {messageBulkSelectionMode ? (
                                <button
                                  type="button"
                                  onClick={() => toggleMessageBulkSelection(message.id)}
                                  className={`mt-2 grid h-8 w-8 shrink-0 place-items-center rounded-full border bg-white shadow-sm transition ${
                                    selectedForBulkDelete
                                      ? "border-rose-600 bg-rose-600 text-white"
                                      : "border-slate-200 text-slate-400 hover:bg-slate-50"
                                  }`}
                                  aria-label={selectedForBulkDelete ? "Desmarcar mensagem" : "Selecionar mensagem"}
                                >
                                  {selectedForBulkDelete ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                                </button>
                              ) : null}
                              <div className={`${hasAudioAttachment ? "w-full min-w-[280px] max-w-[min(420px,88vw)] md:min-w-[340px] md:max-w-[460px]" : shouldRenderAttachments ? "w-full max-w-[min(420px,88vw)] md:max-w-[460px]" : "w-auto max-w-full"} flex flex-col ${outgoing ? "items-end" : "items-start"}`}>
                              <article
                                onClick={messageBulkSelectionMode ? () => toggleMessageBulkSelection(message.id) : undefined}
                                className={`${shouldRenderAttachments ? "w-full" : "inline-flex w-auto max-w-full flex-col"} rounded-[18px] px-4 py-3 text-sm shadow-sm ${internalNote ? "border border-[#eadc7a] bg-[#fff08a] text-slate-800" : outgoing ? "border border-[#cfe9ad] bg-[#dcf8c6] text-slate-800" : "rounded-tl-[8px] border border-[#ece4d8] bg-white text-slate-800"} ${messageBulkSelectionMode ? "cursor-pointer" : ""} ${selectedForBulkDelete ? "ring-2 ring-rose-300 ring-offset-2 ring-offset-transparent" : ""}`}
                              >
                                {internalNote ? (
                                  <div className="mb-1.5 text-[14px] font-semibold leading-5 text-slate-900">
                                    {message.senderName || "Observação"} - Observação:
                                  </div>
                                ) : null}
                                {shouldShowInboundGroupSender ? (
                                  <div className="mb-2 text-[14px] font-semibold leading-5 text-sky-700">
                                    {message.senderName}
                                  </div>
                                ) : null}
                                {message.replyToMessage ? (
                                  <div className={`mb-3 rounded-2xl border px-3 py-2 ${outgoing ? "border-emerald-200 bg-emerald-50/70" : "border-slate-200 bg-slate-50/90"}`}>
                                    <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                                      {message.replyToMessage.senderName || (message.replyToMessage.direction === "outbound" ? "Você" : "Mensagem citada")}
                                    </div>
                                    <div className="mt-1 break-words text-sm text-slate-700 [overflow-wrap:anywhere]">
                                      {summarizeQuotedMessage(message.replyToMessage)}
                                    </div>
                                  </div>
                                ) : null}
                                {isContactCardMessage ? (
                                  <div className={`w-full overflow-hidden rounded-[20px] border ${outgoing ? "border-emerald-200 bg-white/80" : "border-slate-200 bg-white/95"}`}>
                                    <div className="flex items-center gap-3 px-4 py-3">
                                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-slate-200 text-slate-500">
                                        <User className="h-6 w-6" />
                                      </span>
                                      <div className="min-w-0">
                                        <div className="truncate text-[15px] font-semibold text-slate-800">
                                          {sharedContact?.name ?? "Contato compartilhado"}
                                        </div>
                                        {sharedContact?.phone ? (
                                          <div className="mt-1 text-sm text-slate-500">
                                            {sharedContact.phone}
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>
                                    <div className="border-t border-slate-200 px-4 py-3">
                                      <button
                                        type="button"
                                        onClick={() => void handleStartConversationFromSharedContact(sharedContact?.name ?? "Contato compartilhado", sharedContact?.phone ?? null, message.id)}
                                        disabled={!sharedContact?.phone || sharedContactLoadingKey === message.id}
                                        className="w-full text-center text-sm font-semibold uppercase tracking-[0.08em] text-sky-700 transition hover:text-sky-900 disabled:cursor-not-allowed disabled:text-slate-300"
                                      >
                                        {sharedContactLoadingKey === message.id ? "Abrindo..." : "Conversar"}
                                      </button>
                                    </div>
                                  </div>
                                ) : null}
                                {shouldRenderAttachments ? (
                                  <div className={`${message.body && !shouldHideMessageBody ? "mb-3" : ""} w-full space-y-3 ${isDeletedMessage ? "opacity-55 saturate-0" : ""}`}>
                                    {messageAttachments.map((attachment) => (
                                      <div key={attachment.id} className="w-full overflow-hidden rounded-[20px] border border-slate-200/80 bg-white/70">
                                      {attachment.mimeType.startsWith("image/") ? (
                                        <PhotoProvider maskOpacity={0.72}>
                                          <PhotoView src={resolveAttachmentUrl(selectedTicket.id, attachment)}>
                                            <img
                                              src={resolveAttachmentUrl(selectedTicket.id, attachment)}
                                              alt={attachment.fileName ?? "Imagem"}
                                              className="max-h-72 w-full cursor-zoom-in object-cover"
                                            />
                                          </PhotoView>
                                        </PhotoProvider>
                                      ) : attachment.mimeType.startsWith("audio/") ? (
                                        <div className="p-3">
                                          <AudioMessagePlayer
                                            src={resolveAttachmentUrl(selectedTicket.id, attachment)}
                                          />
                                        </div>
                                      ) : (
                                        <a href={resolveAttachmentUrl(selectedTicket.id, attachment)} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 transition hover:bg-slate-50">
                                          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-100 text-slate-500">
                                            <FileText className="h-4 w-4" />
                                          </span>
                                          <div className="min-w-0">
                                            <div className="truncate text-sm font-semibold text-slate-700">{attachment.fileName ?? "Arquivo"}</div>
                                            <div className="text-xs text-slate-400">{attachment.mimeType}</div>
                                          </div>
                                        </a>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                                {message.body && !shouldHideMessageBody && !isContactCardMessage ? (
                                  <div className={isDeletedMessage ? "text-slate-400 line-through decoration-2" : ""}>
                                    {displayedMessageSignature ? (
                                      <div className="mb-1 font-semibold text-slate-900">
                                        {displayedMessageSignature}
                                      </div>
                                    ) : null}
                                    {displayedMessageBody ? (
                                      <div className="whitespace-pre-wrap break-words text-[15px] leading-6 [overflow-wrap:anywhere]">
                                        {displayedMessageBody}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}
                                {!message.body && messageAttachments.length === 0 && !isContactCardMessage ? (
                                  <div className={`whitespace-pre-wrap break-words text-[15px] leading-6 [overflow-wrap:anywhere] ${isDeletedMessage ? "text-slate-400 line-through decoration-2" : ""}`}>
                                    {`[${message.contentType}]`}
                                  </div>
                                ) : null}
                                <div className="mt-2 flex items-center justify-end gap-2 text-[11px] text-slate-400">
                                  {message.editedAt && !shouldHideMessageBody && !isDeletedMessage ? (
                                    <span className="font-medium italic">Editada</span>
                                  ) : null}
                                  {isDeletedMessage ? (
                                    <span className="font-medium italic">Mensagem apagada</span>
                                  ) : null}
                                  <span>{formatDateTime(message.createdAt)}</span>
                                </div>
                              </article>
                              {Object.keys(groupedReactions).length > 0 && !isDeletedMessage ? (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {Object.entries(groupedReactions).map(([emoji, count]) => (
                                    <button
                                      key={emoji}
                                      type="button"
                                      onClick={() => void handleReactToMessage(message.id, emoji)}
                                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                                    >
                                      <span>{emoji}</span>
                                      {count > 1 ? <span>{count}</span> : null}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                              </div>
                                {!messageBulkSelectionMode && (canEditMessage || canDeleteMessage || canDeleteMessageForMe || canReplyToMessage || canForwardMessage) ? (
                                  <div
                                    onPointerDown={(event) => event.stopPropagation()}
                                    className="relative mt-1"
                                  >
                                    <button
                                      type="button"
                                      aria-label="Abrir ações da mensagem"
                                      title="Mais opções"
                                      onClick={(event) => openMessageMenuForButton({
                                        event,
                                        messageId: message.id,
                                        outgoing,
                                        estimatedHeight: messageMenuEstimatedHeight,
                                      })}
                                      onPointerDown={(event) => event.stopPropagation()}
                                      className={`grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition hover:bg-slate-50 hover:text-slate-700 ${openMessageMenuId === message.id ? "opacity-100" : "opacity-70 group-hover:opacity-100"}`}
                                    >
                                      <ChevronDown className="h-3.5 w-3.5" />
                                    </button>
  
                                    {openMessageMenuId === message.id && messageMenuPosition ? (
                                      <div
                                        ref={messageMenuRef}
                                        onPointerDown={(event) => event.stopPropagation()}
                                        onClick={(event) => event.stopPropagation()}
                                        style={{
                                          position: "fixed",
                                          top: messageMenuPosition.top,
                                          left: messageMenuPosition.left,
                                        }}
                                        className="z-[120] w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_48px_rgba(15,23,42,0.16)]"
                                      >
                                      {canReplyToMessage ? (
                                        <div className="mb-2 flex flex-wrap gap-1 rounded-2xl bg-slate-50 p-1">
                                          {MESSAGE_REACTION_LIBRARY.map((emoji) => (
                                            <button
                                              key={emoji}
                                              type="button"
                                              onClick={() => {
                                                void handleReactToMessage(message.id, emoji);
                                                setOpenMessageMenuId(null);
                                              }}
                                              className="grid h-8 w-8 place-items-center rounded-xl text-base transition hover:bg-white"
                                            >
                                              {emoji}
                                            </button>
                                          ))}
                                        </div>
                                      ) : null}

                                      {canReplyToMessage ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            handleStartReplyingToMessage(message);
                                            setOpenMessageMenuId(null);
                                          }}
                                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                                        >
                                          <MessageSquare className="h-4 w-4 text-slate-400" />
                                          Responder
                                        </button>
                                      ) : null}

                                      {canForwardMessage ? (
                                        <button
                                          type="button"
                                          onClick={() => handleOpenForwardModal(message)}
                                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                                        >
                                          <ArrowRightLeft className="h-4 w-4 text-slate-400" />
                                          Encaminhar
                                        </button>
                                      ) : null}

                                      {canEditMessage ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            handleStartEditingMessage(message);
                                            setOpenMessageMenuId(null);
                                          }}
                                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                                        >
                                          <Pencil className="h-4 w-4 text-slate-400" />
                                          Editar
                                        </button>
                                      ) : null}

                                      {canDeleteMessage ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            void handleDeleteMessage(message.id);
                                            setOpenMessageMenuId(null);
                                          }}
                                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-red-600 transition hover:bg-red-50"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                          Apagar para todos
                                        </button>
                                      ) : null}

                                      {canDeleteMessageForMe ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            void handleDeleteMessageForMe(message.id);
                                            setOpenMessageMenuId(null);
                                          }}
                                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                                        >
                                          <EyeOff className="h-4 w-4 text-slate-400" />
                                          Apagar para mim
                                        </button>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

                <div className="border-t border-slate-200 bg-white">
                  {scheduledMessages.length > 0 ? (
                    <div className="border-b border-slate-200 px-4 py-3 md:px-5">
                      <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Mensagens agendadas</div>
                      <div className="space-y-2">
                        {scheduledMessages.map((item) => (
                          <div key={item.id} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-800">
                                {item.body?.trim() || (item.attachment ? `[${item.attachment.kind}] ${item.attachment.fileName}` : "Mensagem agendada")}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                {item.internalNote ? "Observação interna" : "Envio externo"} • {formatDateTime(item.sendAt)} • {item.createdBy.name}
                              </div>
                              {item.errorMessage ? <div className="mt-1 text-xs text-red-500">{item.errorMessage}</div> : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleCancelScheduledMessage(item.id)}
                              className="shrink-0 rounded-full border border-red-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-red-500 transition hover:bg-red-50"
                            >
                              Cancelar
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                <form onSubmit={handleSendMessage} className="px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+0.9rem)] md:px-5 md:py-2.5 md:pb-2.5">
                <input ref={attachmentUploadRef} type="file" multiple className="hidden" onChange={(event) => void handleComposerAttachmentChange(event)} />
                {isEditingMessage && editingMessage ? (
                  <div className="mb-3 flex items-center justify-between gap-3 rounded-[22px] border border-emerald-100 bg-emerald-50/80 px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">Editando mensagem</div>
                      <div className="mt-1 truncate text-sm text-emerald-900">{editingMessage.body ?? "Mensagem sem texto"}</div>
                    </div>
                    <button type="button" onClick={cancelEditingMessage} className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700 transition hover:text-emerald-900">
                      Cancelar
                    </button>
                  </div>
                ) : null}
                {!isEditingMessage && replyToMessage ? (
                  <div className="mb-3 flex items-center justify-between gap-3 rounded-[22px] border border-sky-100 bg-sky-50/80 px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-700">
                        Respondendo {replyToMessage.senderName || (replyToMessage.direction === "outbound" ? "você" : "mensagem")}
                      </div>
                      <div className="mt-1 truncate text-sm text-sky-900">{summarizeQuotedMessage(replyToMessage)}</div>
                    </div>
                    <button type="button" onClick={cancelReplyToMessage} className="text-xs font-bold uppercase tracking-[0.12em] text-sky-700 transition hover:text-sky-900">
                      Cancelar
                    </button>
                  </div>
                ) : null}
                {composerAttachments.length > 0 ? (
                  <div className="mb-3 space-y-2">
                    {composerAttachments.map((attachment, index) => (
                      <div key={`${attachment.fileName}-${attachment.sizeBytes}-${index}`} className="flex items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-white/90 px-4 py-3 shadow-[0_14px_40px_rgba(148,163,184,0.1)]">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-2xl bg-slate-100 text-slate-500">
                            {attachment.kind === "image" ? (
                              <img src={attachment.dataUrl} alt={attachment.fileName} className="h-full w-full object-cover" />
                            ) : attachment.kind === "audio" ? (
                              <FileAudio className="h-4 w-4" />
                            ) : (
                              <FileText className="h-4 w-4" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-800">{attachment.fileName}</div>
                            <div className="text-xs text-slate-400">{attachment.mimeType}</div>
                          </div>
                        </div>
                        <button type="button" onClick={() => clearComposerAttachment(index)} className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400 transition hover:text-slate-700">
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                  <div className="order-2 flex items-center gap-2 overflow-x-auto pb-0.5 md:order-1 md:overflow-visible">
                    <div className="relative">
                      <button type="button" aria-label="Biblioteca de emoji" title="Emoji" onClick={() => setShowEmojiPicker((current) => !current)} disabled={shouldDisableComposer || sendLoading} className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
                        <Smile className="h-4 w-4" />
                      </button>
                      {showEmojiPicker && canSendToSelectedTicket ? (
                        <div className="absolute bottom-[calc(100%+0.75rem)] left-0 z-30 w-64 rounded-[22px] border border-slate-200 bg-white p-3 shadow-[0_24px_60px_rgba(15,23,42,0.16)]">
                          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Emojis</div>
                          <div className="grid grid-cols-5 gap-2">
                            {EMOJI_LIBRARY.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => insertEmoji(emoji)}
                                className="grid h-9 w-9 place-items-center rounded-2xl bg-slate-50 text-xl transition hover:bg-slate-100"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      aria-label={composerInternalNoteMode ? "Desativar observação interna" : "Ativar observação interna"}
                      title={composerInternalNoteMode ? "Desativar observação interna" : "Ativar observação interna"}
                      onClick={toggleComposerInternalNoteMode}
                      disabled={shouldDisableComposer || sendLoading || isEditingMessage}
                      className={`grid h-9 w-9 place-items-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        composerInternalNoteMode
                          ? "border-[#eadc7a] bg-[#fff08a] text-[#5a4a00]"
                          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                      }`}
                    >
                      <MessageSquare className="h-4 w-4" />
                    </button>
                    <button type="button" aria-label="Anexar arquivo" title="Anexar arquivo" onClick={() => attachmentUploadRef.current?.click()} disabled={shouldDisableComposer || sendLoading || isEditingMessage || composerInternalNoteMode} className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
                      <Paperclip className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={recordingAudio ? "Parar gravação" : "Gravar áudio"}
                      title={recordingAudio ? "Parar gravação" : "Gravar áudio"}
                      onClick={() => void handleToggleAudioRecording()}
                      disabled={shouldDisableComposer || sendLoading || isEditingMessage || composerInternalNoteMode}
                      className={`grid h-9 w-9 place-items-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        recordingAudio
                          ? "border-red-200 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600"
                          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                      }`}
                    >
                      {recordingAudio ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="order-1 relative flex-1 md:order-2">
                    <textarea
                      value={messageInput}
                      onChange={(event) => {
                        setMessageInput(event.target.value);
                        setMessageCursorPosition(event.target.selectionStart);
                      }}
                      onSelect={(event) => setMessageCursorPosition(event.currentTarget.selectionStart)}
                      onClick={(event) => setMessageCursorPosition(event.currentTarget.selectionStart)}
                      onKeyUp={(event) => setMessageCursorPosition(event.currentTarget.selectionStart)}
                      onKeyDown={handleComposerKeyDown}
                      rows={1}
                      placeholder={canSendToSelectedTicket ? (isEditingMessage ? "Edite a mensagem" : composerPlaceholder) : composerPlaceholder}
                      disabled={shouldDisableComposer}
                      onPaste={(event) => void handleComposerPaste(event)}
                      className={`min-h-[56px] max-h-36 w-full resize-none rounded-[28px] border px-4 py-3 text-[16px] leading-6 text-slate-700 outline-none transition md:min-h-[44px] md:max-h-28 md:rounded-[24px] md:px-5 md:py-2.5 md:text-sm md:leading-5 disabled:cursor-not-allowed disabled:text-slate-400 ${
                        composerInternalNoteMode
                          ? "border-[#eadc7a] bg-[#fff7b8] focus:border-[#d6c14a] focus:bg-[#fffbe0] disabled:bg-[#f5efb7]"
                          : "border-slate-200 bg-[#f8fafc] focus:border-slate-300 focus:bg-white disabled:bg-slate-100"
                      }`}
                    />
                    {dynamicFieldMatches.length > 0 && canSendToSelectedTicket && !isEditingMessage ? (
                      <div className="absolute bottom-[calc(100%+0.75rem)] left-0 z-20 w-full overflow-hidden rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fbfd)] shadow-[0_24px_60px_rgba(15,23,42,0.16)]">
                        <div className="border-b border-slate-100 px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                          Campos dinâmicos
                        </div>
                        <div className="max-h-72 overflow-y-auto py-2">
                          {dynamicFieldMatches.map((item) => (
                            <button
                              key={item.token}
                              type="button"
                              onClick={() => applyDynamicField(item)}
                              className="flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition hover:bg-slate-50"
                            >
                              <div className="text-sm font-semibold text-slate-900">{`{{${item.token}}}`}</div>
                              <div className="text-xs font-medium uppercase tracking-[0.08em] text-slate-400">{item.label}</div>
                              <div className="max-w-full text-sm text-slate-500">{item.description}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {quickReplyMatches.length > 0 && canSendToSelectedTicket && !isEditingMessage && dynamicFieldMatches.length === 0 ? (
                      <div className="absolute bottom-[calc(100%+0.75rem)] left-0 z-20 w-full overflow-hidden rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fbfd)] shadow-[0_24px_60px_rgba(15,23,42,0.16)]">
                        <div className="border-b border-slate-100 px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                          Respostas rápidas
                        </div>
                        <div className="max-h-72 overflow-y-auto py-2">
                          {quickReplyMatches.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => applyQuickReply(item)}
                              className="flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition hover:bg-slate-50"
                            >
                              <div className="text-sm font-semibold text-slate-900">/{item.shortcut}</div>
                              <div className="max-w-full text-sm text-slate-500">{item.content}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                      {recordingAudio ? (
                        <div className="mt-1.5 pl-3 text-[11px] font-medium text-red-500">
                          Gravando áudio. Clique no microfone vermelho para parar e anexar.
                        </div>
                      ) : null}
                  </div>
                  <div className="order-3 flex items-center gap-2 md:w-auto">
                    <button
                      type="button"
                      aria-label="Agendar mensagem"
                      onClick={() => setShowScheduleModal(true)}
                      disabled={sendLoading || isEditingMessage || (!messageInput.trim() && composerAttachments.length === 0) || shouldDisableComposer}
                      className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-[12px] font-bold uppercase tracking-[0.12em] text-slate-600 transition hover:bg-slate-50 md:h-10 md:flex-none md:text-[13px] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <Clock className="h-4 w-4" />
                      Agendar
                    </button>
                    <button
                      type="submit"
                      aria-label="Enviar mensagem"
                      disabled={sendLoading || (!messageInput.trim() && composerAttachments.length === 0) || shouldDisableComposer}
                      className="inline-flex h-11 min-w-[128px] flex-1 items-center justify-center gap-2 rounded-full bg-[#1A1C32] px-4 text-[12px] font-bold uppercase tracking-[0.12em] text-white transition hover:bg-[#252844] md:h-10 md:min-w-0 md:flex-none md:text-[13px] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                    >
                      <Send className="h-4 w-4" />
                      {sendLoading ? (isEditingMessage ? "Salvando" : "Enviando") : (isEditingMessage ? "Salvar" : "Enviar")}
                    </button>
                  </div>
                </div>
              </form>
              </div>
            </div>

              {showTicketDetails && isMobileViewport ? (
                <div
                  className="fixed inset-0 z-[55] bg-slate-950/18 backdrop-blur-[2px]"
                  onClick={() => setShowTicketDetails(false)}
                />
              ) : null}
              {showTicketDetails ? (
                <aside
                  className={
                    isMobileViewport
                      ? "fixed inset-x-0 bottom-0 top-[60px] z-[60] flex flex-col border-t border-slate-200 bg-white shadow-[0_-18px_60px_rgba(15,23,42,0.18)]"
                      : "hidden w-[320px] shrink-0 border-l border-slate-200 bg-white xl:flex xl:flex-col"
                  }
                >
                  <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <div className="text-lg font-semibold text-[#1A1C32]">{selectedTicket.isGroup ? "Dados do grupo" : "Dados do contato"}</div>
                    <button type="button" onClick={() => setShowTicketDetails(false)} className="text-slate-400 transition hover:text-slate-700">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="space-y-5 overflow-y-auto px-5 py-5">
                    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-5">
                      <SafeAvatar
                        src={selectedTicket.customerAvatarUrl}
                        name={selectedTicket.customerName}
                        alt={`Foto de ${selectedTicket.customerName}`}
                        className="mx-auto grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-slate-200 text-2xl font-semibold text-slate-600"
                      />
                      <div className="mt-4 text-center">
                        <div className="text-xl font-semibold text-slate-900">{selectedTicket.customerName}</div>
                        <div className="mt-4 grid gap-3 text-left">
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <div className="flex items-center justify-between gap-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                              <span>{selectedTicket.isGroup ? "Grupo" : "Nome"}</span>
                              {selectedTicket.isGroup ? (
                                <button
                                  type="button"
                                  onClick={() => setShowGroupNameModal(true)}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:border-slate-300 hover:text-slate-700"
                                  aria-label="Renomear grupo"
                                  title="Renomear grupo"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              ) : selectedCustomer && canManageContacts ? (
                                <button
                                  type="button"
                                  onClick={() => startEditCustomer(selectedCustomer, { preserveWorkspace: true })}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.14em] text-sky-600 transition hover:text-sky-700"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Editar
                                </button>
                              ) : null}
                            </div>
                            <div className="mt-1 text-sm font-semibold text-slate-800">
                              {selectedTicket.isGroup ? selectedTicket.customerName : (selectedCustomer?.name ?? selectedTicket.customerName)}
                            </div>
                          </div>
                          {!selectedTicket.isGroup ? (
                            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Empresa</div>
                                {selectedCustomer && canManageContacts ? (
                                  <button
                                    type="button"
                                    onClick={() => void handleToggleCustomerDashboardVisibility(selectedCustomer, !selectedCustomer.dashboardExcluded)}
                                    disabled={customerLoading}
                                    className={`inline-flex h-7 items-center justify-center rounded-full border px-3 text-[10px] font-bold uppercase tracking-[0.12em] transition ${
                                      selectedCustomer.dashboardExcluded
                                        ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                        : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                                    }`}
                                    title={selectedCustomer.dashboardExcluded ? "Voltar para o dashboard" : "Ignorar no dashboard"}
                                  >
                                    {selectedCustomer.dashboardExcluded ? "Voltar ao dashboard" : "Ignorar no dashboard"}
                                  </button>
                                ) : null}
                              </div>
                              <div className="mt-1 text-sm font-semibold text-slate-800">{selectedCustomer?.companyName ?? "Sem empresa"}</div>
                            </div>
                          ) : null}
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                              {selectedTicket.isGroup
                                ? "Identificador"
                                : isReliablePhoneValue(selectedTicket.externalContactId)
                                  ? "Telefone"
                                  : "Identificador"}
                            </div>
                            <div className="mt-1 break-all text-sm font-semibold text-slate-800">
                              {formatContactIdentity(selectedTicket.externalContactId ?? selectedTicket.externalChatId)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <InfoRow title="Status" subtitle={traduzirStatusTicket(selectedTicket.status)} meta={`não lidos: ${selectedTicket.unreadCount}`} />
                      <InfoRow title={selectedTicket.isGroup ? "Tipo" : "Fila"} subtitle={selectedTicket.isGroup ? "Grupo do WhatsApp" : (selectedTicket.currentQueue?.name ?? "Sem fila")} meta={selectedTicket.isGroup ? (selectedTicket.currentQueue?.name ?? "Sem fila") : "conversa individual"} />
                      <InfoRow title="Responsável" subtitle={selectedTicket.currentAgent?.name ?? "Sem agente"} meta={selectedTicket.isGroup ? "participação compartilhada" : "atendimento individual"} />
                      <InfoRow title={selectedTicket.isGroup ? "Instância" : "Contato"} subtitle={selectedTicket.isGroup ? selectedTicket.whatsappInstance.name : formatContactIdentity(selectedTicket.externalContactId ?? selectedTicket.externalChatId)} meta={selectedTicket.isGroup ? formatContactIdentity(selectedTicket.externalContactId ?? selectedTicket.externalChatId) : selectedTicket.whatsappInstance.name} />
                      <InfoRow title="Atualizado em" subtitle={formatDateTime(selectedTicket.updatedAt)} meta={selectedTicket.status === "closed" ? "ticket encerrado" : "ticket ativo"} />
                      {!selectedTicket.isGroup && selectedCustomer ? (
                        <div className={`rounded-2xl border px-4 py-3 ${selectedCustomer.dashboardExcluded ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                          <div className={`text-[11px] font-bold uppercase tracking-[0.14em] ${selectedCustomer.dashboardExcluded ? "text-amber-600" : "text-emerald-600"}`}>
                            Painel geral
                          </div>
                          <div className={`mt-1 text-sm font-semibold ${selectedCustomer.dashboardExcluded ? "text-amber-900" : "text-emerald-900"}`}>
                            {selectedCustomer.dashboardExcluded ? "Contato ignorado no dashboard" : "Contato contabilizado no dashboard"}
                          </div>
                          <div className={`mt-1 text-xs ${selectedCustomer.dashboardExcluded ? "text-amber-700" : "text-emerald-700"}`}>
                            {selectedCustomer.dashboardExcluded ? "Os tickets deste contato não entram nos números do Painel Geral." : "Os tickets deste contato entram normalmente nos números do Painel Geral."}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </aside>
              ) : null}
            </div>
            {composerDragActive ? (
              <div className="pointer-events-none fixed inset-0 z-[115] flex items-center justify-center bg-slate-950/12 backdrop-blur-[2px]">
                <div className="rounded-[28px] border border-dashed border-sky-300 bg-white px-8 py-6 text-center shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-600">Arrastar e soltar</div>
                  <div className="mt-2 text-lg font-semibold text-[#1A1C32]">Solte o arquivo para anexar na conversa</div>
                  <div className="mt-1 text-sm text-slate-500">Imagens, documentos e áudios são aceitos até 12 MB.</div>
                </div>
              </div>
            ) : null}
            {showTransferPanel && canTransferSelectedTicket ? (
              <div className="absolute inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-950/18 px-4 py-6 backdrop-blur-[2px] sm:py-10">
                <div className="my-auto flex w-full max-w-3xl max-h-[calc(100vh-3rem)] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_32px_80px_rgba(15,23,42,0.22)] sm:max-h-[calc(100vh-5rem)]">
                  <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-600">Transferir atendimento</div>
                      <div className="mt-1 text-lg font-semibold text-[#1A1C32]">{selectedTicket.customerName}</div>
                    </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowTransferPanel(false);
                          setTransferForm({ agentId: "", queueId: "", note: "" });
                        }}
                        className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                      >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <form onSubmit={handleTransferTicket} className="flex min-h-0 flex-1 flex-col">
                      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="block text-sm font-medium text-slate-600">
                          Agente de destino
                          <select
                            value={transferForm.agentId}
                            onChange={(event) => {
                              const nextAgentId = event.target.value;
                              setTransferForm((current) => ({ ...current, agentId: nextAgentId }));
                            }}
                            className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                          >
                          <option value="">Sem agente definido</option>
                          {agents.filter((agent) => !agent.isBotAgent).map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.name}
                            </option>
                          ))}
                        </select>
                      </label>

                        <label className="block text-sm font-medium text-slate-600">
                          Fila de destino
                          <select
                            value={transferForm.queueId}
                            onChange={(event) => setTransferForm((current) => ({ ...current, queueId: event.target.value }))}
                          className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                        >
                          {transferQueues.map((queue) => (
                            <option key={queue.id} value={queue.id}>
                              {queue.name}
                            </option>
                            ))}
                            </select>
                            {transferForm.agentId && transferQueues.length === 0 ? (
                              <div className="mt-2 text-xs text-amber-600">
                                O agente selecionado não possui filas vinculadas.
                              </div>
                            ) : null}
                          </label>
                        </div>
                        <label className="block text-sm font-medium text-slate-600">
                          Observação
                          <textarea
                            value={transferForm.note}
                            onChange={(event) => setTransferForm((current) => ({ ...current, note: event.target.value }))}
                            rows={5}
                            placeholder="Mensagem interna da transferência. Não vai para o cliente."
                            className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-[#fff7c7] px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#d8c458] focus:bg-[#fff9da]"
                          />
                        </label>
                        </div>

                    <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-6 py-5 sm:flex-row sm:justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setShowTransferPanel(false);
                            setTransferForm({ agentId: "", queueId: "", note: "" });
                          }}
                          className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                        >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={transferLoading || !transferForm.queueId}
                        className="inline-flex h-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f766e,#155e75)] px-5 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(14,116,144,0.24)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                      >
                        {transferLoading ? "Transferindo..." : "Confirmar"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : null}
            {ticketHistoryViewer ? (
              <div className="absolute inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-950/18 px-4 py-6 backdrop-blur-[2px] sm:py-10">
                <div className="my-auto flex w-full max-w-3xl max-h-[calc(100vh-3rem)] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_32px_80px_rgba(15,23,42,0.22)] sm:max-h-[calc(100vh-5rem)]">
                  <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-600">Histórico do ticket</div>
                      <div className="mt-1 text-lg font-semibold text-[#1A1C32]">{ticketHistoryViewer.customerName}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTicketHistoryViewer(null)}
                      className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                    {ticketHistoryViewer.loading ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                        Carregando histórico...
                      </div>
                    ) : ticketHistoryViewer.items.length === 0 ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                        Nenhum evento operacional registrado para este ticket.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {ticketHistoryViewer.items.map((item) => (
                          <div key={item.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-slate-900">{item.summary}</div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {item.actorName} • {formatDateTime(item.createdAt)}
                                </div>
                              </div>
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                                {item.type === "created"
                                  ? "Criado"
                                  : item.type === "accepted"
                                    ? "Aceite"
                                    : item.type === "nudged"
                                      ? "Alerta"
                                    : item.type === "transferred"
                                      ? "Transferência"
                                      : item.type === "closed"
                                        ? "Encerrado"
                                        : "Reaberto"}
                              </span>
                            </div>
                            {item.type === "transferred" ? (
                              <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                                <div>
                                  <span className="font-semibold text-slate-700">De:</span>{" "}
                                  {item.fromAgent?.name ?? "Sem agente"}{item.fromQueue?.name ? ` • ${item.fromQueue.name}` : ""}
                                </div>
                                <div>
                                  <span className="font-semibold text-slate-700">Para:</span>{" "}
                                  {item.toAgent?.name ?? "Sem agente"}{item.toQueue?.name ? ` • ${item.toQueue.name}` : ""}
                                </div>
                              </div>
                            ) : null}
                            {item.reason ? (
                              <div className="mt-3 text-sm text-slate-600">
                                <span className="font-semibold text-slate-700">Motivo:</span> {item.reason}
                              </div>
                            ) : null}
                            {item.note ? (
                              <div className="mt-3 rounded-2xl bg-amber-50 px-3 py-3 text-sm text-amber-900">
                                {item.note}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
            {showGroupNameModal && selectedTicket?.isGroup ? (
              <div className="absolute inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-950/18 px-4 py-6 backdrop-blur-[2px] sm:py-10">
                <div className="my-auto flex w-full max-w-lg flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_32px_80px_rgba(15,23,42,0.22)]">
                  <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-600">Renomear grupo</div>
                      <div className="mt-1 text-lg font-semibold text-[#1A1C32]">{selectedTicket.customerName}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowGroupNameModal(false)}
                      className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-4 px-6 py-6">
                    <div className="text-sm text-slate-500">
                      Defina um nome manual para este grupo. Ele terá prioridade sobre o nome recebido pela Evolution.
                    </div>
                    <input
                      value={groupNameInput}
                      onChange={(event) => setGroupNameInput(event.target.value)}
                      placeholder="Ex.: Grupo Comercial"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-5">
                    <button
                      type="button"
                      onClick={() => {
                        setShowGroupNameModal(false);
                        setGroupNameInput(selectedTicket.manualGroupName ?? selectedTicket.customerName ?? "");
                      }}
                      className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSaveSelectedGroupName()}
                      disabled={groupNameSaving}
                      className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#1A1C32] px-5 text-sm font-semibold text-white transition hover:bg-[#111426] disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {groupNameSaving ? "Salvando..." : "Salvar nome"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            {showScheduleModal && selectedTicket ? (
              <div className="absolute inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-950/18 px-4 py-6 backdrop-blur-[2px] sm:py-10">
                <div className="my-auto flex w-full max-w-xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_32px_80px_rgba(15,23,42,0.22)]">
                  <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-600">Agendar mensagem</div>
                      <div className="mt-1 text-lg font-semibold text-[#1A1C32]">{selectedTicketDisplayName}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowScheduleModal(false)}
                      className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-4 px-6 py-6">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Prévia</div>
                      <div className="mt-2 text-sm text-slate-700">
                        {messageInput.trim() || (
                          composerAttachments.length > 0
                            ? composerAttachments.length === 1
                              ? `[${composerAttachments[0]?.kind}] ${composerAttachments[0]?.fileName}`
                              : `${composerAttachments.length} anexos prontos para envio`
                            : "Mensagem vazia"
                        )}
                      </div>
                    </div>
                    <label className="block text-sm font-medium text-slate-600">
                      Enviar em
                      <input
                        type="datetime-local"
                        value={scheduleForm.sendAt}
                        onChange={(event) => setScheduleForm({ sendAt: event.target.value })}
                        className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                      />
                    </label>
                    <div className="text-sm text-slate-500">
                      A mensagem ficará pendente e será enviada automaticamente no horário definido.
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-5">
                    <button
                      type="button"
                      onClick={() => setShowScheduleModal(false)}
                      className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleScheduleMessage()}
                      disabled={scheduleLoading}
                      className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#1A1C32] px-5 text-sm font-semibold text-white transition hover:bg-[#111426] disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {scheduleLoading ? "Agendando..." : "Confirmar agendamento"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            {showForwardModal && forwardSourceMessage ? (
              <div className="absolute inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-950/18 px-4 py-4 backdrop-blur-[2px] sm:py-6">
                <div className="my-auto flex w-full max-w-xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_32px_80px_rgba(15,23,42,0.22)]">
                  <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-600">Encaminhar mensagem</div>
                      <div className="mt-1 text-base font-semibold text-[#1A1C32]">Escolha um ou mais destinos</div>
                    </div>
                    <button
                      type="button"
                      onClick={resetForwardState}
                      className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-3 px-5 py-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Mensagem selecionada</div>
                      <div className="mt-1 line-clamp-2 text-sm text-slate-700">
                        {buildForwardBodyFromMessage(forwardSourceMessage) || (forwardSourceMessage.attachments?.length ? `[${forwardSourceMessage.attachments[0]?.mimeType ?? "arquivo"}] ${forwardSourceMessage.attachments[0]?.fileName ?? "Anexo"}` : "Mensagem sem texto")}
                      </div>
                    </div>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                      <input
                        value={forwardSearch}
                        onChange={(event) => setForwardSearch(event.target.value)}
                        placeholder="Pesquisar nome ou número"
                        className="h-12 w-full rounded-[20px] border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-700 outline-none transition focus:border-emerald-400"
                      />
                    </div>
                    <div className="max-h-[360px] overflow-y-auto rounded-[24px] border border-slate-200 bg-white">
                      {forwardDestinations.length === 0 ? (
                        <div className="px-5 py-8 text-sm text-slate-400">Nenhuma conversa ou contato encontrado.</div>
                      ) : (
                        forwardDestinations.map((destination) => {
                          const selected = selectedForwardDestinationKeys.includes(destination.key);
                          return (
                            <button
                              key={destination.key}
                              type="button"
                              onClick={() => toggleForwardDestinationSelection(destination.key)}
                              className={`flex w-full items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-left transition last:border-b-0 ${
                                selected ? "bg-emerald-50" : "bg-white hover:bg-slate-50"
                              }`}
                            >
                              <div className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border ${
                                selected ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white text-transparent"
                              }`}>
                                <CheckSquare className="h-4 w-4" />
                              </div>
                              <SafeAvatar
                                src={destination.avatarUrl}
                                name={destination.label}
                                alt={destination.label}
                                className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-700"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[15px] font-semibold text-slate-900">{destination.label}</div>
                                <div className="mt-0.5 truncate text-sm text-slate-500">{destination.meta}</div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
                    <div className="text-sm text-slate-500">
                      {selectedForwardDestinationKeys.length > 0
                        ? `${selectedForwardDestinationKeys.length} selecionado(s)`
                        : "Selecione um ou mais destinos"}
                    </div>
                    <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={resetForwardState}
                      className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleConfirmForwardMessage()}
                      disabled={forwardLoading || selectedForwardDestinationKeys.length === 0}
                      className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#1A1C32] px-5 text-sm font-semibold text-white transition hover:bg-[#111426] disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {forwardLoading ? "Encaminhando..." : "Encaminhar"}
                    </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <EmptyCenter />
        )}
        {customerTicketsViewer ? (
          <div className="fixed inset-0 z-[118] flex items-start justify-center overflow-y-auto bg-slate-950/18 px-4 py-6 backdrop-blur-[2px] sm:py-10">
            <div className="my-auto flex w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_32px_80px_rgba(15,23,42,0.22)]">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-600">Contatos</div>
                  <div className="mt-1 text-lg font-semibold text-[#1A1C32]">Tickets vinculados a {customerTicketsViewer.customer.name}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {customerTicketsViewer.loading ? "Carregando histórico..." : `${customerTicketsViewer.tickets.length} ticket(s) encontrados para este contato.`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomerTicketsViewer(null)}
                  className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
                {customerTicketsViewer.loading ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    Carregando tickets deste contato...
                  </div>
                ) : customerTicketsViewer.tickets.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    Nenhum ticket visível encontrado para este contato.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {customerTicketsViewer.tickets.map((ticket) => (
                      <div key={ticket.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="truncate text-sm font-semibold text-slate-900">{ticket.customerName}</div>
                              <StatusChip tone={ticket.status === "open" ? "success" : ticket.status === "pending" ? "warning" : "default"}>
                                {traduzirStatusTicket(ticket.status)}
                              </StatusChip>
                              {ticket.isGroup ? <StatusChip tone="default">Grupo</StatusChip> : null}
                            </div>
                            <div className="mt-2 grid gap-2 text-sm text-slate-500 md:grid-cols-2">
                              <div>Fila: {ticket.currentQueue?.name ?? "Sem fila"}</div>
                              <div>Responsável: {ticket.currentAgent?.name ?? "Sem agente"}</div>
                              <div>Instância: {ticket.whatsappInstance.name}</div>
                              <div>Atualizado em: {formatDateTime(ticket.updatedAt)}</div>
                            </div>
                            <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-600">
                              {ticket.lastMessagePreview?.trim() || "Sem prévia de mensagem."}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-5">
                <button
                  type="button"
                  onClick={() => setCustomerTicketsViewer(null)}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {appDialog ? (
          <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-slate-950/18 px-4 py-6 backdrop-blur-[2px] sm:py-10">
            <div className="my-auto flex w-full max-w-lg flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_32px_80px_rgba(15,23,42,0.22)]">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
                <div>
                  <div className={`text-[11px] font-bold uppercase tracking-[0.16em] ${appDialog.tone === "danger" ? "text-red-500" : "text-sky-600"}`}>
                    {appDialog.kind === "confirm" ? "Confirmação" : "Aviso"}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-[#1A1C32]">{appDialog.title}</div>
                </div>
                <button
                  type="button"
                  onClick={() => resolveAppDialog(false)}
                  className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="px-6 py-6 text-sm leading-7 text-slate-600">{appDialog.description}</div>
              <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-5">
                {appDialog.kind === "confirm" ? (
                  <button
                    type="button"
                    onClick={() => resolveAppDialog(false)}
                    className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    {appDialog.cancelLabel ?? "Cancelar"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => resolveAppDialog(true)}
                  className={`inline-flex h-11 items-center justify-center rounded-2xl px-5 text-sm font-semibold text-white transition disabled:cursor-not-allowed ${appDialog.tone === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-[#1A1C32] hover:bg-[#111426]"}`}
                >
                  {appDialog.confirmLabel ?? "Entendi"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </>
    );
  })();

  const managementModalContent = (() => {
    if (!managementModal) {
      return null;
    }

    if (managementModal === "conversation") {
      if (!canStartConversation) {
        return null;
      }

      return {
        title: "Nova conversa",
        description: "Abra um atendimento manual informando o telefone ou selecionando um contato já existente.",
        content: (
          <form onSubmit={handleCreateConversation} className="space-y-4">
            <div className="grid gap-4">
              <CompactField
                label="Telefone"
                value={formatPhoneInput(conversationForm.phone)}
                onChange={(value) => setConversationForm((current) => ({ ...current, phone: onlyPhoneDigits(value) }))}
                placeholder="+55 (11) 99999-9999"
              />
            </div>
            {existingOpenConversationTicket ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Ja existe um ticket aberto para este numero com <span className="font-semibold">{existingOpenConversationTicket.currentAgent?.name ?? "outro usuario"}</span>. Ao continuar, o sistema abrira o ticket existente.
              </div>
            ) : null}
            <div className="space-y-3">
              <CompactField
                label="Buscar na agenda"
                value={conversationForm.customerSearch}
                onChange={(value) => setConversationForm((current) => ({ ...current, customerSearch: value }))}
                placeholder="Nome, telefone ou empresa"
              />
              {conversationForm.customerSearch.trim().length > 0 && filteredConversationCustomers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  Nenhum contato da agenda encontrado. Você ainda pode abrir o ticket digitando apenas o telefone.
                </div>
              ) : null}
              {matchingConversationCustomer ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  <div className="font-semibold">Contato encontrado</div>
                  <div className="mt-1">{formatCustomerDisplayName(matchingConversationCustomer)}</div>
                  <div className="text-[12px] text-emerald-700">{formatPhoneInput(matchingConversationCustomer.phone ?? "")}</div>
                </div>
              ) : null}
              {!matchingConversationCustomer && filteredConversationCustomers.length > 0 ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  {filteredConversationCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => setConversationForm((current) => ({
                        ...current,
                        customerSearch: formatCustomerDisplayName(customer),
                        phone: onlyPhoneDigits(customer.phone ?? ""),
                      }))}
                      className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{formatCustomerDisplayName(customer)}</div>
                        <div className="truncate text-[12px] text-slate-500">{formatPhoneInput(customer.phone ?? "")}</div>
                      </div>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Usar</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-slate-600">
                Instância
                <select
                  value={conversationForm.whatsappInstanceId}
                  onChange={(event) => {
                    const defaultQueue = getConversationDefaultQueue(event.target.value);
                    setConversationForm((current) => ({
                      ...current,
                      whatsappInstanceId: event.target.value,
                      queueId: defaultQueue.id,
                    }));
                  }}
                  className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                >
                  <option value="">Selecione uma instância</option>
                  {instances.map((instance) => (
                    <option key={instance.id} value={instance.id}>
                      {instance.name} · {traduzirStatusInstancia(instance.status)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-600">
                Fila
                <div className="mt-2 flex h-11 w-full items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700">
                  {getConversationDefaultQueue(conversationForm.whatsappInstanceId).name}
                </div>
                <p className="mt-2 text-xs font-medium text-slate-400">
                  Novos tickets sempre usam a fila padrão da instância selecionada.
                </p>
              </label>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              Depois de criar a conversa, o ticket será aberto automaticamente no atendimento. Se o número já existir na agenda, o nome cadastrado será reaproveitado.
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeManagementModal} className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                Cancelar
              </button>
              <PrimaryAction disabled={conversationLoading} className="sm:w-auto sm:px-6">
                {customerLoading ? "Salvando..." : editingCustomerId ? "Salvar alterações" : "Cadastrar contato"}
              </PrimaryAction>
            </div>
          </form>
        ),
      };
    }

    if (managementModal === "automation") {
      if (!canManageAutomations) {
        return null;
      }

      const weekDayLabels = [
        { value: 0, label: "Dom" },
        { value: 1, label: "Seg" },
        { value: 2, label: "Ter" },
        { value: 3, label: "Qua" },
        { value: 4, label: "Qui" },
        { value: 5, label: "Sex" },
        { value: 6, label: "Sab" },
      ];

      return {
        title: editingAutomationId ? "Editar automação" : "Nova automação",
        description: "Configure gatilho, filtros e ação principal para transformar o módulo em uma operação útil no dia a dia.",
        content: (
          <form onSubmit={handleCreateAutomation} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <CompactField
                label="Nome"
                value={automationForm.name}
                onChange={(value) => setAutomationForm((current) => ({ ...current, name: value }))}
                placeholder="Ex.: Follow-up de inatividade"
              />
              <label className="block text-sm font-medium text-slate-600">
                Status
                <select
                  value={automationForm.status}
                  onChange={(event) =>
                    setAutomationForm((current) => ({
                      ...current,
                      status: event.target.value as "draft" | "active" | "inactive",
                    }))
                  }
                  className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                >
                  <option value="draft">Rascunho</option>
                  <option value="active">Ativa</option>
                  <option value="inactive">Inativa</option>
                </select>
              </label>
            </div>

            <label className="block text-sm font-medium text-slate-600">
              Descrição
              <textarea
                value={automationForm.description}
                onChange={(event) => setAutomationForm((current) => ({ ...current, description: event.target.value }))}
                rows={3}
                placeholder="Explique em uma frase quando esta automação deve agir."
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-300"
              />
            </label>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Gatilho</div>
              <div className="mt-1 text-sm text-slate-500">Defina quando a automação deve ser avaliada.</div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <label className="block text-sm font-medium text-slate-600 md:col-span-2">
                  Tipo de gatilho
                  <select
                    value={automationForm.triggerType}
                    onChange={(event) =>
                      setAutomationForm((current) => ({
                        ...current,
                        triggerType: event.target.value as "message_received" | "ticket_created" | "ticket_inactive" | "scheduled_time",
                      }))
                    }
                    className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                  >
                    <option value="message_received">Nova mensagem recebida</option>
                    <option value="ticket_created">Ticket criado</option>
                    <option value="ticket_inactive">Ticket sem resposta</option>
                    <option value="scheduled_time">Horário agendado</option>
                  </select>
                </label>

                <label className="block text-sm font-medium text-slate-600">
                  Fila
                  <select
                    value={automationForm.queueId}
                    onChange={(event) => setAutomationForm((current) => ({ ...current, queueId: event.target.value }))}
                    className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                  >
                    <option value="">Todas as filas</option>
                    {queues.map((queue) => (
                      <option key={queue.id} value={queue.id}>
                        {queue.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-medium text-slate-600">
                  Instância
                  <select
                    value={automationForm.whatsappInstanceId}
                    onChange={(event) => setAutomationForm((current) => ({ ...current, whatsappInstanceId: event.target.value }))}
                    className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                  >
                    <option value="">Todas as instâncias</option>
                    {instances.map((instance) => (
                      <option key={instance.id} value={instance.id}>
                        {instance.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-medium text-slate-600">
                  Escopo do ticket
                  <select
                    value={automationForm.assignmentScope}
                    onChange={(event) =>
                      setAutomationForm((current) => ({
                        ...current,
                        assignmentScope: event.target.value as "any" | "assigned" | "unassigned",
                      }))
                    }
                    className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                  >
                    <option value="any">Qualquer situação</option>
                    <option value="unassigned">Somente sem agente</option>
                    <option value="assigned">Somente com agente</option>
                  </select>
                </label>
              </div>

              {automationForm.triggerType === "message_received" ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <CompactField
                    label="Palavra-chave"
                    value={automationForm.keyword}
                    onChange={(value) => setAutomationForm((current) => ({ ...current, keyword: value }))}
                    placeholder="Ex.: segunda via"
                  />
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                    Se a palavra-chave ficar vazia, a regra será avaliada para qualquer mensagem recebida.
                  </div>
                </div>
              ) : null}

              {automationForm.triggerType === "ticket_inactive" ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-600">
                    Sem resposta de
                    <select
                      value={automationForm.responsePendingFrom}
                      onChange={(event) =>
                        setAutomationForm((current) => ({
                          ...current,
                          responsePendingFrom: event.target.value as "customer" | "agent",
                        }))
                      }
                      className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                    >
                      <option value="customer">Cliente</option>
                      <option value="agent">Agente responsável</option>
                    </select>
                  </label>
                  <CompactField
                    label={automationForm.responsePendingFrom === "agent" ? "Minutos sem resposta do agente" : "Minutos sem resposta do cliente"}
                    value={automationForm.inactivityMinutes}
                    onChange={(value) => setAutomationForm((current) => ({ ...current, inactivityMinutes: value.replace(/\D/g, "") }))}
                    placeholder="30"
                  />
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                    {automationForm.responsePendingFrom === "agent"
                      ? "A automação será acionada quando a última mensagem do ticket for do cliente e o agente responsável não responder dentro desse tempo."
                      : "A automação será acionada quando a última mensagem do ticket for do agente e o cliente não responder dentro desse tempo."}
                  </div>
                </div>
              ) : null}

              {automationForm.triggerType === "scheduled_time" ? (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block text-sm font-medium text-slate-600">
                      Horário
                      <input
                        type="time"
                        value={automationForm.scheduleTime}
                        onChange={(event) => setAutomationForm((current) => ({ ...current, scheduleTime: event.target.value }))}
                        className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                      />
                    </label>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                      Se nenhum dia for selecionado, a automação será executada todos os dias.
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {weekDayLabels.map((day) => {
                      const active = automationForm.scheduleDaysOfWeek.includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() =>
                            setAutomationForm((current) => ({
                              ...current,
                              scheduleDaysOfWeek: active
                                ? current.scheduleDaysOfWeek.filter((item) => item !== day.value)
                                : [...current.scheduleDaysOfWeek, day.value].sort((a, b) => a - b),
                            }))
                          }
                          className={`inline-flex h-10 items-center justify-center rounded-2xl border px-4 text-sm font-semibold transition ${
                            active
                              ? "border-[#1A1C32] bg-[#1A1C32] text-white"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Ação principal</div>
              <div className="mt-1 text-sm text-slate-500">Escolha o que o sistema deve fazer quando a regra for atendida.</div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-medium text-slate-600">
                  Tipo de ação
                  <select
                    value={automationForm.actionType}
                    onChange={(event) =>
                      setAutomationForm((current) => ({
                        ...current,
                        actionType: event.target.value as "send_message" | "transfer_queue" | "assign_agent" | "close_ticket" | "nudge_ticket" | "webhook",
                      }))
                    }
                    className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                  >
                    <option value="send_message">Enviar mensagem</option>
                    <option value="transfer_queue">Transferir para fila</option>
                    <option value="assign_agent">Atribuir agente</option>
                    <option value="close_ticket">Encerrar ticket</option>
                    <option value="nudge_ticket">Chamar atenção do responsável</option>
                    <option value="webhook">Chamar webhook</option>
                  </select>
                </label>
              </div>

              {automationForm.actionType === "send_message" ? (
                <label className="mt-4 block text-sm font-medium text-slate-600">
                  Mensagem
                  <div className="relative mt-2">
                    <textarea
                      value={automationForm.actionMessage}
                      onChange={(event) => {
                        setAutomationForm((current) => ({ ...current, actionMessage: event.target.value }));
                        setAutomationMessageCursorPosition(event.target.selectionStart);
                      }}
                      onSelect={(event) => setAutomationMessageCursorPosition(event.currentTarget.selectionStart)}
                      onClick={(event) => setAutomationMessageCursorPosition(event.currentTarget.selectionStart)}
                      onKeyUp={(event) => setAutomationMessageCursorPosition(event.currentTarget.selectionStart)}
                      rows={4}
                      placeholder="Digite a mensagem que o ChatFlow deve enviar automaticamente."
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                    />
                    {automationDynamicFieldMatches.length > 0 ? (
                      <div className="absolute bottom-[calc(100%+0.6rem)] left-0 right-0 z-20 overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.12)]">
                        <div className="border-b border-slate-100 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                          Campos dinâmicos
                        </div>
                        <div className="max-h-64 overflow-y-auto py-2">
                          {automationDynamicFieldMatches.map((item) => (
                            <button
                              key={item.token}
                              type="button"
                              onClick={() => applyAutomationDynamicField(item)}
                              className="flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition hover:bg-slate-50"
                            >
                              <div className="text-sm font-semibold text-slate-900">{`{{${item.token}}}`}</div>
                              <div className="text-xs font-medium uppercase tracking-[0.08em] text-slate-400">{item.label}</div>
                              <div className="text-sm text-slate-500">{item.description}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                    Digite <span className="font-semibold text-slate-600">{"{"}</span> para inserir campos dinâmicos como <span className="font-semibold text-slate-600">{`{{firstName}}`}</span>.
                  </div>
                </label>
              ) : null}

              {automationForm.actionType === "transfer_queue" ? (
                <label className="mt-4 block text-sm font-medium text-slate-600">
                  Fila de destino
                  <select
                    value={automationForm.actionQueueId}
                    onChange={(event) => setAutomationForm((current) => ({ ...current, actionQueueId: event.target.value }))}
                    className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                  >
                    <option value="">Selecione a fila</option>
                    {queues.map((queue) => (
                      <option key={queue.id} value={queue.id}>
                        {queue.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {automationForm.actionType === "assign_agent" ? (
                <label className="mt-4 block text-sm font-medium text-slate-600">
                  Agente de destino
                  <select
                    value={automationForm.actionAgentId}
                    onChange={(event) => setAutomationForm((current) => ({ ...current, actionAgentId: event.target.value }))}
                    className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                  >
                    <option value="">Selecione o agente</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {automationForm.actionType === "close_ticket" ? (
                <div className="mt-4">
                  <CompactField
                    label="Motivo do encerramento"
                    value={automationForm.actionCloseReason}
                    onChange={(value) => setAutomationForm((current) => ({ ...current, actionCloseReason: value }))}
                    placeholder="Opcional"
                  />
                </div>
              ) : null}

              {automationForm.actionType === "webhook" ? (
                <div className="mt-4">
                  <CompactField
                    label="URL do webhook"
                    value={automationForm.actionWebhookUrl}
                    onChange={(value) => setAutomationForm((current) => ({ ...current, actionWebhookUrl: value }))}
                    placeholder="https://seu-endpoint.com/webhook"
                  />
                </div>
              ) : null}
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeManagementModal}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <PrimaryAction disabled={automationLoading} className="sm:w-auto sm:px-6">
                {automationLoading ? "Salvando..." : editingAutomationId ? "Salvar automação" : "Criar automação"}
              </PrimaryAction>
            </div>
          </form>
        ),
      };
    }

    if (managementModal === "customer") {
      if (!canManageContacts) {
        return null;
      }

      return {
        title: editingCustomerId ? "Editar contato" : "Adicionar contato",
        description: "Cadastre ou atualize os dados principais do contato para manter a operação organizada.",
        content: (
          <form onSubmit={handleCreateCustomer} className="space-y-4">
            {editingCustomerId ? (
              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                Você está editando um contato existente. Ao salvar, o cadastro atual será atualizado e nenhum novo contato será criado.
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              <CompactField
                label="Nome"
                value={customerForm.name}
                onChange={(value) => setCustomerForm((current) => ({ ...current, name: value }))}
                placeholder="Nome do contato"
              />
              <CompactField
                label="Telefone"
                value={formatPhoneInput(customerForm.phone)}
                onChange={(value) => setCustomerForm((current) => ({ ...current, phone: onlyPhoneDigits(value) }))}
                placeholder="+55 (11) 99999-9999"
              />
              <CompactField
                label="E-mail"
                value={customerForm.email}
                onChange={(value) => setCustomerForm((current) => ({ ...current, email: value }))}
                placeholder="contato@empresa.com"
              />
              <CompactField
                label="Empresa"
                value={customerForm.companyName}
                onChange={(value) => setCustomerForm((current) => ({ ...current, companyName: value }))}
                placeholder="Empresa ou organização"
              />
            </div>

            <label className="block text-sm font-medium text-slate-600">
              Observações
              <textarea
                value={customerForm.notes}
                onChange={(event) => setCustomerForm((current) => ({ ...current, notes: event.target.value }))}
                rows={5}
                placeholder="Anotações internas sobre o contato."
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-300"
              />
            </label>

            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <input
                type="checkbox"
                checked={customerForm.dashboardExcluded}
                onChange={(event) => setCustomerForm((current) => ({ ...current, dashboardExcluded: event.target.checked }))}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-[#1A1C32] focus:ring-[#1A1C32]"
              />
              <div>
                <div className="text-sm font-semibold text-slate-900">Ignorar este contato no Painel Geral</div>
                <div className="mt-1 text-sm text-slate-500">
                  Todos os tickets vinculados a este contato deixam de entrar nos números e alertas do dashboard, sem afetar o atendimento.
                </div>
              </div>
            </label>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              {editingCustomerId ? (
                <button
                  type="button"
                  onClick={() => void handleDeleteCustomer(editingCustomerId)}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                >
                  Excluir contato
                </button>
              ) : null}
              <button type="button" onClick={closeManagementModal} className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                Cancelar
              </button>
              <PrimaryAction disabled={customerLoading || !customerForm.name.trim()} className="sm:w-auto sm:px-6">
                {customerLoading ? "Salvando..." : editingCustomerId ? "Salvar alterações" : "Cadastrar contato"}
              </PrimaryAction>
            </div>
          </form>
        ),
      };
    }

    if (managementModal === "quickReply") {
      if (!canManageQuickReplies) {
        return null;
      }

      return {
        title: editingQuickReplyId ? "Editar resposta rápida" : "Adicionar resposta rápida",
        description: "Cadastre atalhos como /bomdia para preencher mensagens prontas dentro da conversa.",
        content: (
          <form onSubmit={handleCreateQuickReply} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
              <CompactField
                label="Atalho"
                value={quickReplyForm.shortcut}
                onChange={(value) => setQuickReplyForm((current) => ({ ...current, shortcut: value.replace(/^\/+/, "") }))}
                placeholder="bomdia"
              />
              <label className="flex items-end gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={quickReplyForm.isActive}
                  onChange={(event) => setQuickReplyForm((current) => ({ ...current, isActive: event.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <div>
                  <div className="text-sm font-semibold text-slate-700">Atalho ativo</div>
                  <div className="text-xs text-slate-500">Somente respostas ativas aparecem ao digitar barra.</div>
                </div>
              </label>
            </div>
            <label className="block text-sm font-medium text-slate-600">
              Conteúdo da mensagem
              <div className="relative mt-2">
                <textarea
                  value={quickReplyForm.content}
                  onChange={(event) => {
                    setQuickReplyForm((current) => ({ ...current, content: event.target.value }));
                    setQuickReplyCursorPosition(event.target.selectionStart);
                  }}
                  onSelect={(event) => setQuickReplyCursorPosition(event.currentTarget.selectionStart)}
                  onClick={(event) => setQuickReplyCursorPosition(event.currentTarget.selectionStart)}
                  onKeyUp={(event) => setQuickReplyCursorPosition(event.currentTarget.selectionStart)}
                  rows={6}
                  placeholder="Digite aqui a mensagem que será aplicada quando o agente usar /atalho."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                />
                {quickReplyDynamicFieldMatches.length > 0 ? (
                  <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_45px_rgba(15,23,42,0.12)]">
                    <div className="border-b border-slate-100 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                      Campos dinâmicos
                    </div>
                    <div className="max-h-64 overflow-y-auto py-2">
                      {quickReplyDynamicFieldMatches.map((item) => (
                        <button
                          key={item.token}
                          type="button"
                          onClick={() => applyQuickReplyDynamicField(item)}
                          className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                        >
                          <div>
                            <div className="text-sm font-semibold text-slate-700">{item.label}</div>
                            <div className="mt-1 text-xs text-slate-400">{item.token}</div>
                          </div>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Inserir
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="mt-2 text-xs text-slate-400">
                Digite {"{"} para inserir campos dinâmicos como <span className="font-semibold text-slate-500">{'{{firstName}}'}</span>.
              </div>
            </label>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              Exemplo de uso no atendimento: <span className="font-semibold text-slate-700">/{quickReplyForm.shortcut || "bomdia"}</span>
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeManagementModal} className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                Cancelar
              </button>
              <PrimaryAction disabled={quickReplyLoading} className="sm:w-auto sm:px-6">
                {quickReplyLoading ? "Salvando..." : editingQuickReplyId ? "Salvar alterações" : "Cadastrar resposta"}
              </PrimaryAction>
            </div>
          </form>
        ),
      };
    }

    if (managementModal === "instance") {
      if (!canManageInstances) {
        return null;
      }

      return {
        title: editingInstanceId ? "Editar conexão" : "Nova conexão",
        description: "Cadastre ou atualize a instância da Evolution usada pela operação.",
        content: (
          <form onSubmit={handleCreateInstance} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <CompactField label="Nome interno" value={instanceForm.name} onChange={(value) => setInstanceForm((current) => ({ ...current, name: value }))} placeholder="Comercial" />
              <CompactField label="Nome na Evolution" value={instanceForm.evolutionInstanceName} onChange={(value) => setInstanceForm((current) => ({ ...current, evolutionInstanceName: value }))} placeholder="1519-0000" />
              <CompactField label="URL base" value={instanceForm.baseUrl} onChange={(value) => setInstanceForm((current) => ({ ...current, baseUrl: value }))} placeholder={publicUrls.apiBaseUrl} />
              <CompactField label="Chave da API" value={instanceForm.apiKey} onChange={(value) => setInstanceForm((current) => ({ ...current, apiKey: value }))} placeholder="Token da Evolution" />
            </div>
            <label className="block text-sm font-medium text-slate-600">
              Fila padrão da instância
              <select
                value={instanceForm.defaultQueueId}
                onChange={(event) => setInstanceForm((current) => ({ ...current, defaultQueueId: event.target.value }))}
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
              >
                <option value="">Sem fila padrão</option>
                {queues.map((queue) => (
                  <option key={queue.id} value={queue.id}>
                    {queue.name}
                  </option>
                ))}
              </select>
            </label>
            <CompactField label="Segredo do webhook" value={instanceForm.webhookSecret} onChange={(value) => setInstanceForm((current) => ({ ...current, webhookSecret: value }))} placeholder="Opcional" />
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeManagementModal} className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                Cancelar
              </button>
              <PrimaryAction disabled={instanceLoading} className="sm:w-auto sm:px-6">{instanceLoading ? "Salvando..." : editingInstanceId ? "Salvar alterações" : "Cadastrar conexão"}</PrimaryAction>
            </div>
          </form>
        ),
      };
    }

    if (managementModal === "agent") {
      if (!canManageAgents) {
        return null;
      }

      const permissionsByGroup = permissionDefinitions.reduce<Record<string, Array<(typeof permissionDefinitions)[number]>>>((acc, item) => {
        if (!acc[item.group]) {
          acc[item.group] = [];
        }
        acc[item.group].push(item);
        return acc;
      }, {});

      return {
        title: editingAgentId ? "Editar usuário" : duplicatingAgentName ? "Duplicar usuário" : "Adicionar usuário",
        description: duplicatingAgentName
          ? `Criando uma cópia de ${duplicatingAgentName} com as mesmas filas e permissões.`
          : "Cadastre agentes e administradores do painel operacional, com acesso granular por módulo e ação.",
        content: (
          <form onSubmit={handleCreateAgent} className="space-y-4">
            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
              <AdminTab label="Geral" active={managementModalTab === "general"} onClick={() => setManagementModalTab("general")} />
              {!agentForm.isBotAgent ? (
                <AdminTab label="Permissões" active={managementModalTab === "permissions"} onClick={() => setManagementModalTab("permissions")} />
              ) : null}
              {canManageUserAccess && !agentForm.isBotAgent ? (
                <AdminTab label="Acesso" active={managementModalTab === "access"} onClick={() => setManagementModalTab("access")} />
              ) : null}
            </div>

            {managementModalTab === "general" ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <CompactField label="Nome" value={agentForm.name} onChange={(value) => setAgentForm((current) => ({ ...current, name: value }))} placeholder="Nome completo" />
                  {!agentForm.isBotAgent ? (
                    <CompactField label="E-mail" value={agentForm.email} onChange={(value) => setAgentForm((current) => ({ ...current, email: value }))} placeholder="usuario@empresa.com" autoComplete="email" />
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                      Credenciais de login não são necessárias para usuários bot.
                    </div>
                  )}
                  {!agentForm.isBotAgent && (!editingAgentId || canManageAgentPasswords) ? (
                    <>
                      <CompactField label={editingAgentId ? "Nova senha" : "Senha"} type="password" value={agentForm.password} onChange={(value) => setAgentForm((current) => ({ ...current, password: value }))} placeholder={editingAgentId ? "Opcional para manter a atual" : "Senha de acesso"} autoComplete="new-password" />
                      <CompactField label={editingAgentId ? "Confirmar nova senha" : "Confirmar senha"} type="password" value={agentForm.confirmPassword} onChange={(value) => setAgentForm((current) => ({ ...current, confirmPassword: value }))} placeholder="Repita a senha" autoComplete="new-password" />
                    </>
                  ) : !agentForm.isBotAgent ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 md:col-span-2">
                      Você pode editar os dados do usuário, mas a troca de senha exige a permissão <span className="font-semibold">agents.password.manage</span>.
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                      O sistema gera credenciais técnicas internas automaticamente para este agente.
                    </div>
                  )}
                  {!agentForm.isBotAgent ? (
                    <label className="block text-sm font-medium text-slate-600">
                      Perfil
                      <select
                        value={agentForm.role}
                        onChange={(event) => updateAgentRole(event.target.value as "admin" | "agent")}
                        className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                      >
                        <option value="agent">Agente</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </label>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Perfil aplicado</div>
                      <div className="mt-1 font-medium text-slate-800">Agente técnico de automação</div>
                    </div>
                  )}
                  {currentUser.role === "admin" ? (
                    <label className={`flex items-start gap-3 rounded-2xl border px-4 py-4 text-sm transition md:col-span-2 ${agentForm.isBotAgent ? "border-sky-200 bg-sky-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                      <input
                        type="checkbox"
                        checked={agentForm.isBotAgent}
                        onChange={(event) => updateBotAgentMode(event.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      />
                      <span>
                        <span className="block font-medium text-slate-800">Agente de automação (bot)</span>
                        <span className="mt-1 block text-xs text-slate-500">
                          Agentes marcados como bot ficam ocultos da operação manual e continuam disponíveis para API e automações.
                        </span>
                      </span>
                    </label>
                  ) : null}
                </div>

                {agentForm.isBotAgent ? (
                  <div className="rounded-3xl border border-sky-100 bg-sky-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">Configuração automática do bot</div>
                    <div className="mt-1 text-sm text-slate-600">
                      O agente bot já fica preparado para uso técnico com permissões padrão de agente e acesso manual oculto.
                    </div>
                    <div className="mt-4 rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-700">
                      <div className="font-medium text-slate-800">Filas bot vinculadas</div>
                      <div className="mt-1 text-slate-600">
                        {botQueueNames.length > 0 ? botQueueNames.join(", ") : "Nenhuma fila bot cadastrada ainda."}
                      </div>
                    </div>
                  </div>
                ) : canAssignQueues ? (
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">Filas visíveis no atendimento</div>
                    <div className="mt-1 text-sm text-slate-500">
                      Essas filas definem quais tickets o usuário pode enxergar na operação.
                    </div>
                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                      {queues.map((queue) => {
                        const checked = agentForm.role === "admin" || agentForm.queueIds.includes(queue.id);
                        return (
                          <label key={queue.id} className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm transition ${checked ? "border-[#1A1C32]/20 bg-white" : "border-slate-200 bg-white/70 hover:border-slate-300"}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={agentForm.role === "admin"}
                              onChange={() => toggleAgentQueue(queue.id)}
                              className="h-4 w-4 rounded border-slate-300 text-[#1A1C32] focus:ring-[#1A1C32]"
                            />
                            <span className="font-medium text-slate-700">{queue.name}</span>
                          </label>
                        );
                      })}
                    </div>
                    {agentForm.role === "admin" ? (
                      <div className="mt-3 text-xs text-slate-500">
                        Administradores podem visualizar todas as filas automaticamente.
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : managementModalTab === "permissions" && !agentForm.isBotAgent ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    {agentForm.role === "admin"
                      ? "Administradores recebem acesso completo. Você pode revisar a matriz abaixo, mas todas as permissões permanecem habilitadas."
                      : "Defina exatamente quais módulos e ações este usuário poderá acessar no painel."}
                  </div>
                  {agentForm.role !== "admin" ? (
                    <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                      As filas que o usuário pode enxergar vêm das <span className="font-semibold">filas associadas ao agente</span>. As permissões abaixo controlam se ele pode ver tickets de outros usuários e tickets sem fila.
                    </div>
                  ) : null}
                  <div className="grid gap-4 md:grid-cols-2">
                  {Object.entries(permissionsByGroup).map(([group, items]) => (
                    <section key={group} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="mb-3 text-sm font-semibold text-slate-900">{group}</div>
                      <div className="space-y-2">
                        {items.map((permission) => (
                          <label key={permission.key} className={`flex items-start gap-3 rounded-xl border px-3 py-3 text-sm transition ${agentForm.permissions[permission.key] ? "border-[#1A1C32]/20 bg-[#1A1C32]/5" : "border-slate-200 bg-slate-50"} ${agentForm.role === "admin" ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:border-slate-300 hover:bg-white"}`}>
                            <input
                              type="checkbox"
                              checked={agentForm.permissions[permission.key]}
                              disabled={agentForm.role === "admin"}
                              onChange={() => toggleAgentPermission(permission.key)}
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#1A1C32] focus:ring-[#1A1C32]"
                            />
                            <span>
                              <span className="block font-medium text-slate-800">{permission.label}</span>
                              <span className="mt-0.5 block text-xs text-slate-500">{permission.key}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
                </div>
              ) : (
                <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Controle se este usuário pode acessar o painel e, se necessário, limite o uso a uma janela diária de horário.
                </div>

                <label className={`flex items-start gap-3 rounded-2xl border px-4 py-4 text-sm transition ${agentForm.blocked ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                  <input
                    type="checkbox"
                    checked={agentForm.blocked}
                    onChange={(event) => setAgentForm((current) => ({ ...current, blocked: event.target.checked }))}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                  />
                  <span>
                    <span className="block font-medium text-slate-800">Bloquear usuário</span>
                    <span className="mt-1 block text-xs text-slate-500">
                      Usuários bloqueados não conseguem entrar no sistema até serem liberados novamente.
                    </span>
                  </span>
                </label>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={agentForm.accessScheduleEnabled}
                      onChange={(event) =>
                        setAgentForm((current) => ({
                          ...current,
                          accessScheduleEnabled: event.target.checked,
                        }))
                      }
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-[#1A1C32] focus:ring-[#1A1C32]"
                    />
                    <span>
                      <span className="block font-medium text-slate-800">Limitar horário de uso</span>
                      <span className="mt-1 block text-xs text-slate-500">
                        Quando ativo, o login só será permitido dentro do intervalo diário informado abaixo.
                      </span>
                    </span>
                  </label>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="block text-sm font-medium text-slate-600">
                      Horário inicial
                      <input
                        type="time"
                        value={agentForm.accessStartTime}
                        disabled={!agentForm.accessScheduleEnabled}
                        onChange={(event) => setAgentForm((current) => ({ ...current, accessStartTime: event.target.value }))}
                        className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-300 disabled:cursor-not-allowed disabled:bg-slate-100"
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-600">
                      Horário final
                      <input
                        type="time"
                        value={agentForm.accessEndTime}
                        disabled={!agentForm.accessScheduleEnabled}
                        onChange={(event) => setAgentForm((current) => ({ ...current, accessEndTime: event.target.value }))}
                        className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-300 disabled:cursor-not-allowed disabled:bg-slate-100"
                      />
                    </label>
                  </div>

                  <div className="mt-3 text-xs text-slate-500">
                    Se o horário inicial for maior que o final, o sistema considera um intervalo que atravessa a madrugada.
                  </div>
                </div>
              </div>
            )}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeManagementModal} className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                Cancelar
              </button>
              <PrimaryAction disabled={agentLoading} className="sm:w-auto sm:px-6">{agentLoading ? "Salvando..." : editingAgentId ? "Salvar alterações" : "Cadastrar usuário"}</PrimaryAction>
            </div>
          </form>
        ),
      };
    }

    if (!canManageQueues) {
      return null;
    }

    return {
      title: editingQueueId ? "Editar fila" : "Adicionar fila",
      description: "Cadastre filas operacionais para distribuição dos atendimentos.",
      content: (
        <form onSubmit={handleCreateQueue} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
            <CompactField label="Nome da fila" value={queueForm.name} onChange={(value) => setQueueForm((current) => ({ ...current, name: value }))} placeholder="Comercial" />
            <label className="block text-sm font-medium text-slate-600">
              Cor
              <div className="mt-2 flex h-11 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3">
                <input
                  type="color"
                  value={queueForm.color}
                  onChange={(event) => setQueueForm((current) => ({ ...current, color: event.target.value }))}
                  className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                <span className="text-sm text-slate-600">{queueForm.color.toUpperCase()}</span>
              </div>
            </label>
          </div>
          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <input
              type="checkbox"
              checked={queueForm.isBotQueue}
              onChange={(event) => setQueueForm((current) => ({ ...current, isBotQueue: event.target.checked }))}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-[#1A1C32] focus:ring-[#1A1C32]"
            />
            <div>
              <div className="text-sm font-semibold text-slate-900">Fila de automação (bot)</div>
              <div className="mt-1 text-sm text-slate-500">
                Essa fila fica visível apenas para administradores e para usuários com a permissão de visualizar filas de automação.
              </div>
            </div>
          </label>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={closeManagementModal} className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
              Cancelar
            </button>
            <PrimaryAction disabled={queueLoading} className="sm:w-auto sm:px-6">{queueLoading ? "Salvando..." : editingQueueId ? "Salvar alterações" : "Cadastrar fila"}</PrimaryAction>
          </div>
        </form>
      ),
    };
  })();

  if (loadingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#ebf1f4] p-6">
        <div className="flex items-center gap-3 rounded-xl border bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Carregando sessão...
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#eef3f6] px-5 py-10 sm:px-8">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#f9fbfc_0%,#eff4f7_52%,#e8eef2_100%)]" />
        <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(255,255,255,0))]" />
        <div className="absolute left-[-10%] top-[14%] h-56 w-56 rounded-full bg-[#35bc4b]/6 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-6%] h-60 w-60 rounded-full bg-[#084484]/7 blur-3xl" />

        <section className="relative z-10 w-full max-w-[430px]">
          <div className="rounded-[30px] border border-white/80 bg-white/88 px-6 py-7 shadow-[0_18px_48px_rgba(8,68,132,0.08)] backdrop-blur-lg sm:px-7 sm:py-8">
            <div className="flex flex-col items-center text-center">
              <div className="rounded-[20px] border border-[#084484]/7 bg-white/92 px-4 py-3 shadow-[0_8px_20px_rgba(8,68,132,0.04)]">
                <img src={loginBrandImageSrc} alt="Logo da SERMST" className="max-h-11 w-auto object-contain sm:max-h-12" />
              </div>
              <h1 className="mt-5 text-[28px] font-semibold leading-none tracking-[-0.06em] text-[#0f172a]">
                {mode === "login" ? "Acesse sua conta" : "Criar acesso inicial"}
              </h1>
            </div>

            {mode === "login" ? (
              <form onSubmit={handleLogin} className="mt-6 space-y-5">
                  <AuthField
                    label="E-mail"
                    value={loginForm.email}
                    onChange={(value) => setLoginForm((current) => ({ ...current, email: value }))}
                    placeholder="voce@empresa.com.br"
                    leadingIcon={Mail}
                    autoComplete="email"
                  />
                  <AuthField
                    label="Senha"
                    type={showLoginPassword ? "text" : "password"}
                    value={loginForm.password}
                    onChange={(value) => setLoginForm((current) => ({ ...current, password: value }))}
                    placeholder="Digite sua senha"
                    leadingIcon={Lock}
                    autoComplete="current-password"
                    trailing={
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword((current) => !current)}
                        aria-label={showLoginPassword ? "Ocultar senha" : "Mostrar senha"}
                        className="text-slate-400 transition hover:text-slate-600"
                      >
                        {showLoginPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    }
                  />
                  <button type="submit" className="flex h-13 w-full items-center justify-center gap-2 rounded-[18px] bg-[#084484] px-4 text-base font-semibold text-white shadow-[0_12px_24px_rgba(8,68,132,0.16)] transition hover:bg-[#073766] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#35bc4b]/30 focus-visible:ring-offset-2">
                    Entrar
                  </button>
                </form>
              ) : (
                <form onSubmit={handleBootstrap} className="mt-6 space-y-5">
                  <AuthField
                    label="Nome"
                    value={bootstrapForm.name}
                    onChange={(value) => setBootstrapForm((current) => ({ ...current, name: value }))}
                    placeholder="Administrador principal"
                    leadingIcon={User}
                    autoComplete="name"
                  />
                  <AuthField
                    label="E-mail"
                    value={bootstrapForm.email}
                    onChange={(value) => setBootstrapForm((current) => ({ ...current, email: value }))}
                    placeholder="admin@empresa.com.br"
                    leadingIcon={Mail}
                    autoComplete="email"
                  />
                  <AuthField
                    label="Senha"
                    type={showBootstrapPassword ? "text" : "password"}
                    value={bootstrapForm.password}
                    onChange={(value) => setBootstrapForm((current) => ({ ...current, password: value }))}
                    placeholder="Mínimo de 8 caracteres"
                    leadingIcon={Lock}
                    autoComplete="new-password"
                    trailing={
                      <button
                        type="button"
                        onClick={() => setShowBootstrapPassword((current) => !current)}
                        aria-label={showBootstrapPassword ? "Ocultar senha" : "Mostrar senha"}
                        className="text-slate-400 transition hover:text-slate-600"
                      >
                        {showBootstrapPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    }
                  />
                  <button type="submit" className="flex h-13 w-full items-center justify-center gap-2 rounded-[18px] bg-[#084484] px-4 text-base font-semibold text-white shadow-[0_12px_24px_rgba(8,68,132,0.16)] transition hover:bg-[#073766] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#35bc4b]/30 focus-visible:ring-offset-2">
                    Criar administrador
                  </button>
                </form>
              )}

              {(authError || panelMessage) && (
                <div className="mt-5 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {authError ?? panelMessage}
                </div>
              )}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="h-screen overflow-hidden bg-[#ebf1f4] text-slate-800">
      <div className="flex h-screen flex-col overflow-hidden">
        <header className="z-20 flex h-[60px] shrink-0 items-center justify-between bg-[#1A1C32] px-5 text-white shadow-sm">
          <div className="flex items-center gap-6">
            <button
              type="button"
              aria-label={isMobileViewport ? "Abrir menu" : showRail ? "Recolher menu lateral" : "Expandir menu lateral"}
              title={isMobileViewport ? "Abrir menu" : showRail ? "Recolher menu lateral" : "Expandir menu lateral"}
              onClick={() => {
                if (isMobileViewport) {
                  setMobileNavigationOpen(true);
                  return;
                }

                setShowRail((current) => !current);
              }}
              className="text-white/90 transition hover:text-white"
            >
              <Menu className="h-6 w-6" />
            </button>
            {shouldRenderBrandImage ? (
              <div className="flex items-center gap-3">
                <div className="flex h-10 min-w-[180px] items-center px-2">
                  <img src={brandLogoPreview ?? undefined} alt="Logo do painel" className="max-h-8 w-auto object-contain" />
                </div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">{workspaceTitle}</div>
              </div>
            ) : shouldRenderBrandText ? (
              <div className="flex items-center gap-3">
                <div className="flex h-10 min-w-[180px] items-center px-2 text-[24px] font-semibold leading-none tracking-tight text-white">
                  {brandTextLabel}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">{workspaceTitle}</div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-white/10">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-[18px] font-semibold tracking-tight">CHATFLOW</div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">{workspaceTitle}</div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Atualizar dados do painel"
              title="Atualizar dados do painel"
              onClick={() => void refreshAll()}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/15"
            >
              <RefreshCw className={`h-4 w-4 ${ticketLoading || messageLoading ? "animate-spin" : ""}`} />
              Atualizar
            </button>
            <div ref={userMenuRef} className="relative">
              <button
                type="button"
                aria-label="Abrir menu do usuário"
                title="Abrir menu do usuário"
                aria-expanded={userMenuOpen}
                onClick={() => setUserMenuOpen((current) => !current)}
                className="grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-white/10 bg-white/10 text-sm font-semibold uppercase transition hover:bg-white/15"
              >
                <SafeAvatar
                  src={currentUser.avatarUrl}
                  name={currentUser.name}
                  alt={`Avatar de ${currentUser.name}`}
                  className="grid h-full w-full place-items-center overflow-hidden rounded-full text-sm font-semibold uppercase"
                />
              </button>
              {userMenuOpen ? (
                <div className="absolute right-0 top-[calc(100%+0.75rem)] z-40 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white py-2 text-left shadow-[0_20px_50px_rgba(15,23,42,0.18)]">
                  <div className="border-b border-slate-100 px-4 pb-3 pt-2">
                    <div className="text-sm font-semibold text-slate-900">{currentUser.name || "Usuário"}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{currentUser.email}</div>
                  </div>
                  {currentUser.permissions["profile.view"] ? (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveWorkspace("profile");
                        setUserMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-50"
                    >
                      <User className="h-4 w-4 text-slate-400" />
                      Meu perfil
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      void handleLogout();
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm text-red-600 transition hover:bg-red-50"
                  >
                    <LogIn className="h-4 w-4 rotate-180 text-red-400" />
                    Sair do painel
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {isMobileViewport && mobileNavigationOpen ? (
          <div className="fixed inset-0 z-[70] bg-slate-950/28 backdrop-blur-[2px]" onClick={() => setMobileNavigationOpen(false)}>
            <aside
              className="absolute inset-y-0 left-0 flex w-[280px] max-w-[86vw] flex-col justify-between border-r border-slate-200 bg-white px-3 py-4 shadow-[0_24px_60px_rgba(15,23,42,0.24)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between px-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{brandTextLabel}</div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{workspaceTitle}</div>
                  </div>
                  <button
                    type="button"
                    aria-label="Fechar menu"
                    title="Fechar menu"
                    onClick={() => setMobileNavigationOpen(false)}
                    className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  {currentUser.permissions["dashboard.view"] ? <RailButton icon={LayoutGrid} label="Painel geral" expanded active={activeWorkspace === "dashboard"} onClick={() => setActiveWorkspace("dashboard")} /> : null}
                  {currentUser.permissions["tickets.view"] ? (
                    <RailButton
                      icon={WhatsAppIcon}
                      label="Atendimento"
                      expanded
                      active={activeWorkspace === "tickets"}
                      onClick={() => {
                        setShowAllTickets(false);
                        setShowArchivedTickets(false);
                        setActiveTab("atendendo");
                        setActiveWorkspace("tickets");
                        setMobileTicketView(selectedTicketId ? "conversation" : "list");
                      }}
                    />
                  ) : null}
                  {canViewClosedTickets ? (
                    <RailButton
                      icon={Archive}
                      label="Tickets fechados"
                      expanded
                      active={activeWorkspace === "closedTickets"}
                      onClick={() => {
                        setShowAllTickets(false);
                        setActiveWorkspace("closedTickets");
                        setMobileTicketView(selectedTicketId ? "conversation" : "list");
                      }}
                    />
                  ) : null}
                  {currentUser.permissions["quickReplies.view"] ? <RailButton icon={Zap} label="Respostas rápidas" expanded active={activeWorkspace === "quickReplies"} onClick={() => setActiveWorkspace("quickReplies")} /> : null}
                  {currentUser.permissions["api.view"] ? <RailButton icon={Code2} label="API" expanded active={activeWorkspace === "api"} onClick={() => setActiveWorkspace("api")} /> : null}
                  {currentUser.permissions["contacts.view"] ? <RailButton icon={Users} label="Contatos" expanded active={activeWorkspace === "contacts"} onClick={() => setActiveWorkspace("contacts")} /> : null}
                  {currentUser.permissions["calendar.view"] ? <RailButton icon={Calendar} label="Agendamentos" expanded active={activeWorkspace === "calendar"} onClick={() => setActiveWorkspace("calendar")} /> : null}
                  {currentUser.permissions["automations.view"] ? <RailButton icon={Workflow} label="Automações" expanded active={activeWorkspace === "automations"} onClick={() => setActiveWorkspace("automations")} /> : null}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {currentUser.permissions["settings.view"] ? <RailButton icon={Settings} label="Configurações" expanded active={activeWorkspace === "settings"} onClick={() => setActiveWorkspace("settings")} /> : null}
              </div>
            </aside>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <aside className={`hidden h-full shrink-0 border-r border-slate-200 bg-white transition-[width] duration-200 md:flex md:flex-col md:justify-between md:py-4 ${showRail ? "w-[220px]" : "w-14"}`}>
            <div className="flex w-full flex-col gap-1 px-2">
              {currentUser.permissions["dashboard.view"] ? <RailButton icon={LayoutGrid} label="Painel geral" expanded={showRail} active={activeWorkspace === "dashboard"} onClick={() => setActiveWorkspace("dashboard")} /> : null}
{currentUser.permissions["tickets.view"] ? <RailButton icon={WhatsAppIcon} label="Atendimento" expanded={showRail} active={activeWorkspace === "tickets"} onClick={() => { setShowAllTickets(false); setShowArchivedTickets(false); setActiveTab("atendendo"); setActiveWorkspace("tickets"); }} /> : null}
              {canViewClosedTickets ? <RailButton icon={Archive} label="Tickets fechados" expanded={showRail} active={activeWorkspace === "closedTickets"} onClick={() => { setShowAllTickets(false); setActiveWorkspace("closedTickets"); }} /> : null}
              {currentUser.permissions["quickReplies.view"] ? <RailButton icon={Zap} label="Respostas rápidas" expanded={showRail} active={activeWorkspace === "quickReplies"} onClick={() => setActiveWorkspace("quickReplies")} /> : null}
              {currentUser.permissions["api.view"] ? <RailButton icon={Code2} label="API" expanded={showRail} active={activeWorkspace === "api"} onClick={() => setActiveWorkspace("api")} /> : null}
              {currentUser.permissions["contacts.view"] ? <RailButton icon={Users} label="Contatos" expanded={showRail} active={activeWorkspace === "contacts"} onClick={() => setActiveWorkspace("contacts")} /> : null}
              {currentUser.permissions["calendar.view"] ? <RailButton icon={Calendar} label="Agendamentos" expanded={showRail} active={activeWorkspace === "calendar"} onClick={() => setActiveWorkspace("calendar")} /> : null}
              {currentUser.permissions["automations.view"] ? <RailButton icon={Workflow} label="Automações" expanded={showRail} active={activeWorkspace === "automations"} onClick={() => setActiveWorkspace("automations")} /> : null}
            </div>
            <div className="flex w-full flex-col gap-1 px-2">
              {currentUser.permissions["settings.view"] ? <RailButton icon={Settings} label="Configurações" expanded={showRail} active={activeWorkspace === "settings"} onClick={() => setActiveWorkspace("settings")} /> : null}
            </div>
          </aside>

          <section className={`grid min-h-0 min-w-0 flex-1 overflow-hidden ${ticketWorkspaceAtivo ? "xl:grid-cols-[460px_minmax(0,1fr)]" : "xl:grid-cols-[minmax(0,1fr)]"}`}>
              {ticketWorkspaceAtivo && shouldShowTicketListPane ? (
                <div className="flex h-full min-h-0 min-w-0 flex-col border-r border-slate-200 bg-white">
                <div className="space-y-3 border-b border-slate-200 p-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      aria-label="Buscar atendimentos"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Buscar atendimento e mensagens"
                      className="h-11 w-full rounded-full border border-slate-300 bg-white pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-slate-400"
                    />
                  </div>

                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                        {!isClosedTicketsWorkspace && canStartConversation ? (
                          <button
                            type="button"
                            onClick={openCreateConversationModal}
                            className="inline-flex h-8 items-center gap-2 rounded-xl border border-[#1A1C32] bg-white px-3 text-[10px] font-bold uppercase tracking-[0.08em] text-[#1A1C32] transition hover:bg-slate-50"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Novo Ticket
                          </button>
                        ) : null}
                        {canBulkDeleteTickets ? (
                          <SidebarIconButton
                            icon={ticketBulkSelectionMode ? X : Trash2}
                            label={ticketBulkSelectionMode ? "Cancelar seleção de tickets" : "Selecionar tickets para apagar"}
                          active={ticketBulkSelectionMode}
                          onClick={() => {
                            if (ticketBulkSelectionMode) {
                              cancelTicketBulkSelectionMode();
                            } else {
                              startTicketBulkSelectionMode();
                            }
                            }}
                          />
                        ) : null}
                        {!isClosedTicketsWorkspace && canViewClosedTickets ? (
                          <SidebarIconButton
                            icon={Archive}
                            label={showArchivedTickets ? "Ocultar arquivadas" : "Mostrar arquivadas"}
                            active={showArchivedTickets}
                            onClick={() => {
                              setShowArchivedTickets((current) => !current);
                            }}
                          />
                        ) : null}
                        {!isClosedTicketsWorkspace && canViewOtherTickets ? (
                          <SidebarIconButton
                            icon={showAllTickets ? EyeOff : Eye}
                            label={showAllTickets ? "Voltar para minhas mensagens" : "Mostrar todas as mensagens"}
                            active={showAllTickets}
                            onClick={() => {
                              setShowAllTickets((current) => !current);
                              setActiveWorkspace("tickets");
                            }}
                          />
                        ) : null}
                        <SidebarIconButton
                          icon={EyeOff}
                          label="Mostrar apenas não lidos"
                          active={showOnlyUnread}
                          onClick={() => setShowOnlyUnread((current) => !current)}
                        />
                    </div>
                    <div className="relative min-w-0 max-w-full">
                      <select
                        aria-label="Filtrar atendimentos por fila"
                        value={selectedQueueFilter}
                        onChange={(event) => setSelectedQueueFilter(event.target.value)}
                        className="h-9 max-w-full appearance-none rounded-[16px] border border-slate-300 bg-white pl-3 pr-9 text-[11px] text-slate-600 outline-none transition hover:bg-slate-50"
                      >
                        <option value="all">Todas as filas</option>
                        <option value="without-queue">Sem fila</option>
                        {queues.map((queue) => (
                          <option key={queue.id} value={queue.id}>
                            {queue.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>
                </div>

                <div className="border-b border-slate-200 px-3 py-2">
                  {isClosedTicketsWorkspace ? (
                    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2">
                      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600">
                        <Archive className="h-3.5 w-3.5" />
                        Tickets arquivados
                      </div>
                      <span className="rounded-full bg-slate-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        {counters.fechados}
                      </span>
                    </div>
                  ) : (
                    <div className={`grid items-center gap-2 ${canViewGroups ? "grid-cols-3" : "grid-cols-2"}`}>
                      <StatusTab label="ATENDENDO" count={counters.atendendo} active={activeTab === "atendendo"} onClick={() => { setActiveWorkspace("tickets"); setActiveTab("atendendo"); }} icon={<MessageSquare className="h-3 w-3" />} color="bg-red-500" />
                      <StatusTab label="AGUARDANDO" count={counters.aguardando} active={activeTab === "aguardando"} onClick={() => { setActiveWorkspace("tickets"); setActiveTab("aguardando"); }} icon={<Clock className="h-3 w-3" />} color="bg-amber-500" />
                      {canViewGroups ? <StatusTab label="GRUPOS" count={counters.grupos} active={activeTab === "grupos"} onClick={() => { setActiveWorkspace("tickets"); setActiveTab("grupos"); }} icon={<Users className="h-3 w-3" />} color="bg-blue-500" /> : null}
                    </div>
                  )}
                </div>

                {ticketBulkSelectionMode ? (
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        aria-label="Selecionar todos os tickets visíveis"
                        title="Selecionar todos os tickets visíveis"
                        onClick={toggleAllVisibleTicketBulkSelection}
                        className="grid h-5 w-5 place-items-center rounded-md border border-slate-300 bg-white text-slate-500 transition hover:border-slate-400 hover:text-slate-700"
                      >
                        {visibleTickets.length > 0 && visibleTickets.every((ticket) => selectedTicketIdsForBulkDelete.includes(ticket.id)) ? (
                          <CheckSquare className="h-3.5 w-3.5" />
                        ) : (
                          <Square className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {selectedTicketIdsForBulkDelete.length} ticket(s) selecionado(s)
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={cancelTicketBulkSelectionMode}
                        className="inline-flex h-8 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleBulkDeleteTickets()}
                        disabled={bulkDeleteLoading || selectedTicketIdsForBulkDelete.length === 0}
                        className="inline-flex h-8 items-center justify-center rounded-xl bg-rose-600 px-3 text-[11px] font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {bulkDeleteLoading ? "Apagando..." : "Apagar selecionados"}
                      </button>
                    </div>
                  </div>
                ) : null}

                  <div className="flex-1 min-h-0 min-w-0 overflow-y-auto bg-white px-2 py-2">
                  {visibleTickets.length === 0 ? (
                    <div className="p-10 text-center text-xs font-medium text-slate-400">
                      {isClosedTicketsWorkspace
                        ? "Nenhum ticket arquivado para os filtros atuais."
                        : showArchivedTickets
                          ? "Nenhum atendimento ou arquivado para os filtros atuais."
                          : selectedQueueFilter !== "all"
                            ? "Nenhum atendimento encontrado para a fila selecionada nesta categoria."
                            : "Nenhum atendimento nesta categoria."}
                      </div>
                    ) : (
                    visibleTickets.map((ticket) => {
                      const selected = ticket.id === selectedTicketId;
                      const selectedForBulkDelete = selectedTicketIdsForBulkDelete.includes(ticket.id);
                      const compact = ticketDensity === "compact";
                      return (
                        <button
                          key={ticket.id}
                          type="button"
                          onClick={() => {
                            if (ticketBulkSelectionMode) {
                              toggleTicketBulkSelection(ticket.id);
                              return;
                            }

                            setSelectedTicketId(ticket.id);
                            setActiveWorkspace("tickets");
                            setShowTicketDetails(false);
                            if (isMobileViewport) {
                              setMobileTicketView("conversation");
                            }
                          }}
                          className={`group relative mb-1.5 flex w-full min-w-0 items-start gap-2.5 rounded-[18px] border text-left transition ${selected ? "border-slate-300 bg-slate-50 shadow-sm" : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50"} ${compact ? "p-2.5" : "p-3"}`}
                        >
                          {ticketBulkSelectionMode ? (
                            <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border ${selectedForBulkDelete ? "border-rose-600 bg-rose-600 text-white" : "border-slate-300 bg-white text-slate-400"}`}>
                              {selectedForBulkDelete ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                            </span>
                          ) : null}
                          <div className={compact ? "pt-0.5" : "pt-1"}>
                            <SafeAvatar
                              src={ticket.customerAvatarUrl}
                              name={ticket.customerName}
                              alt={`Foto de ${ticket.customerName}`}
                              className={`grid place-items-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-700 ${compact ? "h-11 w-11" : "h-12 w-12"}`}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <Phone className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                                    <p className={`truncate font-semibold text-slate-800 ${compact ? "text-[13px]" : "text-[14px]"}`}>
                                      {formatTicketDisplayName(ticket)}
                                    </p>
                                    {selected ? <span className="rounded-full bg-[#1A1C32] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white">Ativo</span> : null}
                                  </div>
                                  <p className={`mt-0.5 truncate font-medium leading-5 text-slate-600 ${compact ? "text-[12px]" : "text-[13px]"}`}>
                                    {ticket.lastMessagePreview ? formatMessagePreview(ticket.lastMessagePreview) : "Sem mensagem registrada"}
                                  </p>
                                  <p className="mt-1 truncate text-[11px] text-slate-400">
                                    {formatContactIdentity(ticket.externalContactId ?? ticket.externalChatId)}
                                  </p>
                                </div>
                              <span className="whitespace-nowrap text-[11px] font-medium text-slate-400">{formatHour(ticket.lastMessageAt ?? ticket.updatedAt)}</span>
                            </div>

                            <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
                              <div className="flex min-w-0 flex-wrap gap-1 overflow-hidden">
                                <MiniBadge className={statusBadgeClassName(ticket.status)} text={statusBadgeText(ticket.status, ticket.whatsappInstance.name)} />
                                {ticket.isGroup ? (
                                  <MiniBadge className="bg-blue-600 text-white" text="GRUPO" />
                                ) : (
                                  <>
                                    <MiniBadge
                                      className={ticket.currentQueue?.color ? "text-white" : "bg-red-500 text-white"}
                                      text={ticket.currentQueue?.name ?? "SEM FILA"}
                                      style={ticket.currentQueue?.color ? { backgroundColor: ticket.currentQueue.color } : undefined}
                                    />
                  <MiniBadge className="bg-slate-900 text-white" text={ticket.isGroup ? "COMPARTILHADO" : (ticket.currentAgent?.name ?? "SEM AGENTE")} />
                                  </>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                {ticket.unreadCount > 0 ? (
                                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-[10px] font-bold text-white shadow-sm">
                                    {ticket.unreadCount}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ) : null}

            <section className={`${shouldShowWorkspacePane ? "flex" : "hidden"} min-h-0 min-w-0 flex-col overflow-y-auto bg-[linear-gradient(180deg,#edf3f7,#e1eaef)]`}>
              {panelMessage ? (
                <div className="flex items-start justify-between gap-3 border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-800">
                  <div>{panelMessage}</div>
                  <button
                    type="button"
                    aria-label="Fechar aviso"
                    title="Fechar aviso"
                    onClick={() => setPanelMessage(null)}
                    className="rounded-md p-1 text-amber-700 transition hover:bg-amber-100 hover:text-amber-900"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
              {workspacePanel}
            </section>
          </section>
        </div>
      </div>

      {scheduledMessageEditor ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/18 px-4 py-6 backdrop-blur-[2px] sm:py-10">
          <div className="my-auto flex w-full max-w-xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_32px_80px_rgba(15,23,42,0.22)]">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-600">Editar agendamento</div>
                <div className="mt-1 text-lg font-semibold text-[#1A1C32]">{scheduledMessageEditor.title}</div>
              </div>
              <button
                type="button"
                onClick={() => setScheduledMessageEditor(null)}
                className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 px-6 py-6">
              {scheduledMessageEditor.attachmentLabel ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Anexo mantido: {scheduledMessageEditor.attachmentLabel}
                </div>
              ) : null}
              <label className="block text-sm font-medium text-slate-600">
                Mensagem
                <textarea
                  value={scheduledMessageEditor.body}
                  onChange={(event) => setScheduledMessageEditor((current) => current ? { ...current, body: event.target.value } : current)}
                  rows={4}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                />
              </label>
              <label className="block text-sm font-medium text-slate-600">
                Enviar em
                <input
                  type="datetime-local"
                  value={scheduledMessageEditor.sendAt}
                  onChange={(event) => setScheduledMessageEditor((current) => current ? { ...current, sendAt: event.target.value } : current)}
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                />
              </label>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-5">
              <button
                type="button"
                onClick={() => setScheduledMessageEditor(null)}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleSaveScheduledMessageEdit()}
                disabled={scheduleLoading}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#1A1C32] px-5 text-sm font-semibold text-white transition hover:bg-[#111426] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {scheduleLoading ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {scheduledMessageViewer ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/18 px-4 py-6 backdrop-blur-[2px] sm:py-10">
          <div className="my-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_32px_80px_rgba(15,23,42,0.22)]">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-600">Ticket vinculado</div>
                <div className="mt-1 text-lg font-semibold text-[#1A1C32]">{scheduledMessageViewer.ticket?.customerName ?? "Ticket"}</div>
              </div>
              <button
                type="button"
                onClick={() => setScheduledMessageViewer(null)}
                className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-4 px-6 py-6 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Destino</div>
                <div className="mt-2 text-base font-semibold text-slate-900">{scheduledMessageViewer.ticket?.customerName ?? "Ticket"}</div>
                <div className="mt-1 text-sm text-slate-500">
                  {(scheduledMessageViewer.ticket?.currentQueue?.name ?? "Sem fila")} • {(scheduledMessageViewer.ticket?.whatsappInstance.name ?? "Sem instância")}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {scheduledMessageViewer.ticket?.currentAgent?.name ?? "Sem agente responsável"}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Agendamento</div>
                <div className="mt-2 text-sm text-slate-700">{formatScheduledMessagePreview(scheduledMessageViewer)}</div>
                <div className="mt-2 text-sm text-slate-500">Agendado para {formatDateTime(scheduledMessageViewer.sendAt)}</div>
                <div className="mt-1 text-sm text-slate-500">Criado por {scheduledMessageViewer.createdBy.name}</div>
                {scheduledMessageViewer.errorMessage ? <div className="mt-2 text-xs text-red-500">{scheduledMessageViewer.errorMessage}</div> : null}
              </div>
            </div>
            <div className="flex items-center justify-end border-t border-slate-200 px-6 py-5">
              <button
                type="button"
                onClick={() => setScheduledMessageViewer(null)}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {scheduledMessageDeleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/18 px-4 py-6 backdrop-blur-[2px] sm:py-10">
          <div className="my-auto flex w-full max-w-lg flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_32px_80px_rgba(15,23,42,0.22)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-red-500">Confirmação</div>
                <div className="mt-1 text-lg font-semibold text-[#1A1C32]">Excluir mensagem agendada</div>
              </div>
              <button
                type="button"
                onClick={() => setScheduledMessageDeleteTarget(null)}
                className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-6 text-sm leading-7 text-slate-600">
              A mensagem agendada para <strong>{scheduledMessageDeleteTarget.ticket?.customerName ?? "este ticket"}</strong> não será mais enviada automaticamente.
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-5">
              <button
                type="button"
                onClick={() => setScheduledMessageDeleteTarget(null)}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteScheduledMessageFromAgenda(scheduledMessageDeleteTarget)}
                disabled={scheduleLoading}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {scheduleLoading ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {managementModalContent ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 px-4 py-6 sm:py-8">
          <div className="absolute inset-0" onClick={closeManagementModal} aria-hidden="true" />
          <section className="relative z-10 my-auto flex w-full max-w-3xl max-h-[calc(100vh-3rem)] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_25px_80px_rgba(15,23,42,0.28)] sm:max-h-[calc(100vh-4rem)]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Cadastro</div>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-900">{managementModalContent.title}</h2>
                <p className="mt-2 text-sm text-slate-500">{managementModalContent.description}</p>
              </div>
              <button
                type="button"
                onClick={closeManagementModal}
                aria-label="Fechar popup"
                title="Fechar"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {managementModalContent.content}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function traduzirStatusMensagemAgendada(status: ScheduledMessageItem["status"]) {
  switch (status) {
    case "pending":
      return "Agendada";
    case "processing":
      return "Processando";
    case "failed":
      return "Falhou";
    case "sent":
      return "Enviada";
    case "canceled":
      return "Cancelada";
    default:
      return status;
  }
}

function tomMensagemAgendada(status: ScheduledMessageItem["status"]): "default" | "success" | "warning" | "danger" {
  switch (status) {
    case "sent":
      return "success";
    case "failed":
      return "danger";
    case "canceled":
      return "default";
    default:
      return "warning";
  }
}

function AuthField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  leadingIcon?: React.ComponentType<{ className?: string }>;
  trailing?: React.ReactNode;
}) {
  const LeadingIcon = props.leadingIcon;

  return (
    <label className="block text-sm font-medium text-slate-600">
      <span className="mb-2 block px-1 text-sm text-slate-500">{props.label}</span>
      <div className="flex h-14 items-center gap-3 rounded-[18px] border border-slate-200 bg-white px-4 transition focus-within:border-slate-300 focus-within:shadow-[0_0_0_4px_rgba(148,163,184,0.12)]">
        {LeadingIcon ? <LeadingIcon className="h-5 w-5 shrink-0 text-slate-400" /> : null}
        <input
          type={props.type ?? "text"}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          placeholder={props.placeholder}
          autoComplete={props.autoComplete}
          className="h-full w-full border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-300"
        />
        {props.trailing ? <div className="shrink-0">{props.trailing}</div> : null}
      </div>
    </label>
  );
}

function WhatsAppIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={props.className} fill="none">
      <path
        d="M12 3.25C7.17 3.25 3.25 7.08 3.25 11.8c0 1.74.54 3.43 1.56 4.87L3.5 20.75l4.22-1.28a8.87 8.87 0 0 0 4.28 1.08c4.83 0 8.75-3.83 8.75-8.75S16.83 3.25 12 3.25Z"
        className="fill-emerald-500/12 stroke-current"
        strokeWidth="1.5"
      />
      <path
        d="M8.96 8.63c.18-.41.37-.42.54-.43.15-.01.33-.01.5-.01.16 0 .42.06.64.3.22.24.83.81.83 1.97 0 1.15-.85 2.27-.97 2.42-.12.15-.24.35-.1.56.14.21.63 1.02 1.36 1.65.94.82 1.73 1.07 1.98 1.19.25.12.4.1.55-.06.15-.16.62-.71.78-.95.16-.24.33-.2.56-.12.23.08 1.45.68 1.7.81.25.12.41.18.47.29.06.11.06.64-.15 1.26-.21.62-1.24 1.18-1.72 1.22-.44.04-.99.06-1.6-.13-.37-.12-.85-.28-1.46-.54-2.57-1.11-4.25-3.81-4.38-3.99-.12-.18-1.04-1.39-1.04-2.65 0-1.26.66-1.88.89-2.13Z"
        className="fill-current"
      />
    </svg>
  );
}

function RailButton(props: { icon: React.ComponentType<{ className?: string }>; label: string; expanded?: boolean; active?: boolean; onClick?: () => void }) {
  const Icon = props.icon;
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-label={props.label}
      title={props.label}
      className={`flex items-center rounded-lg transition ${props.active ? "bg-slate-100 text-[#1A1C32]" : "text-slate-400 hover:bg-slate-50 hover:text-slate-700"} ${props.expanded ? "gap-3 px-3 py-2.5" : "h-10 w-10 justify-center self-center"} ${props.active && props.expanded ? "border-l-2 border-[#1A1C32]" : ""} ${props.active && !props.expanded ? "border-l-2 border-[#1A1C32]" : ""}`}
    >
      <Icon className="h-5 w-5" />
      {props.expanded ? <span className="text-sm font-medium">{props.label}</span> : null}
    </button>
  );
}

function SidebarIconButton(props: { icon: React.ComponentType<{ className?: string }>; label: string; active?: boolean; onClick?: () => void }) {
  const Icon = props.icon;
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-label={props.label}
      title={props.label}
      aria-pressed={props.active ? "true" : "false"}
      className={`grid h-8 w-8 place-items-center rounded-xl border transition ${props.active ? "border-[#1A1C32] bg-white text-[#1A1C32]" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"}`}
    >
      <Icon className="h-3 w-3" />
    </button>
  );
}

function StatusTab(props: { label: string; count: number; active: boolean; onClick: () => void; icon: React.ReactNode; color: string }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`relative flex min-w-0 items-center justify-center gap-1.5 rounded-[14px] border px-2 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] transition-all ${props.active ? "border-[#1A1C32] bg-[#1A1C32] text-white" : "border-transparent text-slate-400 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-700"}`}
    >
      <div className="relative">
        {props.icon}
        {props.count > 0 ? <span className={`absolute -right-2 -top-2 min-w-[14px] rounded-full px-1 text-[8px] text-white ${props.color}`}>{props.count}</span> : null}
      </div>
      <span className="min-w-0 truncate">{props.label}</span>
    </button>
  );
}

function MiniBadge(props: { text: string; className: string; style?: React.CSSProperties }) {
  return <span style={props.style} className={`inline-flex max-w-full truncate rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] ${props.className}`}>{props.text}</span>;
}

function statusBadgeClassName(status: "open" | "pending" | "closed") {
  if (status === "open") return "bg-emerald-600 text-white";
  if (status === "pending") return "bg-amber-500 text-white";
  return "bg-slate-500 text-white";
}

function statusBadgeText(status: "open" | "pending" | "closed", instanceName?: string | null) {
  const normalizedInstanceName = typeof instanceName === "string" ? instanceName.trim() : "";
  if (normalizedInstanceName) {
    return normalizedInstanceName.toUpperCase();
  }

  return status === "open" ? "EM ATENDIMENTO" : status === "pending" ? "SEM INSTANCIA" : "FECHADO";
}

function AudioMessagePlayer(props: {
  src: string;
}) {
  return (
    <div className="chatflow-audio-player w-full min-w-[260px] max-w-full overflow-hidden bg-white md:min-w-[320px]">
      <audio className="chatflow-audio-element" controls preload="metadata" src={props.src}>
        Seu navegador nao suporta audio embutido.
      </audio>
    </div>
  );
}

function EmptyCenter() {
  return (
    <div className="grid flex-1 place-items-center px-6 py-10 text-center">
      <div className="max-w-xl">
        <div className="mx-auto grid h-24 w-24 place-items-center rounded-[28px] border border-white/60 bg-[radial-gradient(circle_at_top,#ffffff,#d8e3ec)] text-slate-700 shadow-[0_24px_60px_rgba(148,163,184,0.3)]">
          <MessageSquare className="h-9 w-9" />
        </div>
        <h3 className="mt-8 text-4xl font-semibold tracking-[-0.04em] text-slate-700">Selecione uma conversa</h3>
        <p className="mt-3 text-lg leading-8 text-slate-500">Abra um ticket da fila lateral para responder, assumir o atendimento e acompanhar o histórico em tempo real.</p>
      </div>
    </div>
  );
}

function EmptyMessages() {
  return (
    <div className="grid flex-1 place-items-center px-6 py-10 text-center">
      <div className="max-w-lg">
        <div className="mx-auto grid h-24 w-24 place-items-center rounded-[28px] border border-white/70 bg-[radial-gradient(circle_at_top,#ffffff,#dde7ef)] text-slate-600 shadow-[0_24px_60px_rgba(148,163,184,0.28)]">
          <MessageSquare className="h-9 w-9" />
        </div>
        <h3 className="mt-8 text-3xl font-semibold tracking-[-0.04em] text-slate-700">Conversa pronta para começar</h3>
        <p className="mt-3 text-lg leading-8 text-slate-500">Assim que a primeira mensagem chegar, o histórico aparece aqui com contexto, horário e responsável.</p>
      </div>
    </div>
  );
}

function AdminTab(props: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`rounded-lg px-3 py-2 text-xs font-bold uppercase transition ${props.active ? "bg-[#1A1C32] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
    >
      {props.label}
    </button>
  );
}

function AdminPanelCard(props: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  const Icon = props.icon;
  return (
    <section className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[#1A1C32] shadow-sm">
          <Icon className="h-5 w-5" />
        </span>
        <h3 className="text-sm font-semibold text-slate-900">{props.title}</h3>
      </div>
      {props.children}
    </section>
  );
}

function CompactField(props: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; autoComplete?: string }) {
  return (
    <label className="block text-sm font-medium text-slate-600">
      {props.label}
      <input
        type={props.type ?? "text"}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        autoComplete={props.autoComplete}
        className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
      />
    </label>
  );
}

function PrimaryAction(props: { disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="submit"
      disabled={props.disabled}
      className={`w-full rounded-2xl bg-[#1A1C32] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#111426] disabled:cursor-not-allowed disabled:bg-slate-300 ${props.className ?? ""}`}
    >
      {props.children}
    </button>
  );
}

function InfoRow(props: { title: string; subtitle: string; meta: string }) {
  return (
    <div className="rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff,#f8fbfd)] px-4 py-4 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{props.title}</div>
      <div className="mt-2 text-sm font-semibold text-slate-900">{props.subtitle}</div>
      <div className="mt-2 text-[11px] uppercase tracking-[0.08em] text-slate-500">{props.meta}</div>
    </div>
  );
}


function WorkspaceSection(props: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-900">{props.title}</h3>
        <p className="mt-1 text-sm text-slate-500">{props.description}</p>
      </div>
      <div className="space-y-4">{props.children}</div>
    </section>
  );
}

function WorkspaceStatCard(props: { title: string; value: string; description: string; accent: "emerald" | "amber" | "blue" | "slate" }) {
  const accentClass = props.accent === "emerald" ? "bg-emerald-500" : props.accent === "amber" ? "bg-amber-500" : props.accent === "blue" ? "bg-blue-500" : "bg-slate-500";

  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-600">{props.title}</div>
        <span className={`h-3 w-3 rounded-full ${accentClass}`} />
      </div>
      <div className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">{props.value}</div>
      <div className="mt-2 text-sm text-slate-500">{props.description}</div>
    </article>
  );
}

function ModuleToolbar(props: {
  title: string;
  count?: number;
  searchValue: string;
  searchPlaceholder: string;
  onSearchChange: (value: string) => void;
  actionLabel?: string;
  onActionClick?: () => void;
  actionIcon?: React.ComponentType<{ className?: string }>;
}) {
  const ActionIcon = props.actionIcon;

  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h3 className="text-[30px] font-semibold leading-tight text-slate-900">
          {props.title}
          {typeof props.count === "number" ? <span className="text-slate-500"> ({props.count})</span> : null}
        </h3>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative block min-w-[280px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={props.searchValue}
            onChange={(event) => props.onSearchChange(event.target.value)}
            placeholder={props.searchPlaceholder}
            className="h-11 w-full rounded-md border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
          />
        </label>

        {props.actionLabel && props.onActionClick ? (
          <button
            type="button"
            onClick={props.onActionClick}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#1A1C32] px-5 text-sm font-semibold uppercase tracking-[0.04em] text-white transition hover:bg-[#111426]"
          >
            {ActionIcon ? <ActionIcon className="h-4 w-4" /> : null}
            {props.actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DataTable(props: { columns: string[]; emptyMessage: string; children: React.ReactNode; compact?: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full border-collapse">
        <thead className="bg-slate-50">
          <tr>
            {props.columns.map((column) => (
              <th key={column} className="border-b border-slate-200 px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={props.compact ? "text-sm" : "text-[15px]"}>{props.children}</tbody>
      </table>
      {!props.children ? <div className="px-5 py-8 text-sm text-slate-500">{props.emptyMessage}</div> : null}
    </div>
  );
}

function DataRow(props: { children: React.ReactNode }) {
  return <tr className="border-b border-slate-200 last:border-b-0">{props.children}</tr>;
}

function DataCell(props: { children: React.ReactNode; subtle?: boolean }) {
  return <td className={`px-5 py-4 align-middle ${props.subtle ? "text-sm text-slate-500" : "text-slate-800"}`}>{props.children}</td>;
}

function StatusChip(props: { children: React.ReactNode; tone?: "default" | "success" | "warning" | "danger" }) {
  const toneClass =
    props.tone === "success"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : props.tone === "warning"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : props.tone === "danger"
          ? "bg-red-50 text-red-700 border-red-200"
          : "bg-slate-100 text-slate-700 border-slate-200";

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClass}`}>{props.children}</span>;
}

function QueueEditor(props: {
  queue: QueueItem;
  agents: AgentItem[];
  loading: boolean;
  canEdit: boolean;
  onSave: (queueId: string, agentIds: string[]) => Promise<void>;
  onChange: React.Dispatch<React.SetStateAction<QueueItem[]>>;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-900">{props.queue.name}</div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.05em] text-slate-400">{props.queue.openTicketCount} ticket(s) abertos</div>
        </div>
        <span className="h-4 w-4 rounded-full border border-white shadow" style={{ backgroundColor: props.queue.color ?? "#1A1C32" }} />
      </div>

      <div className="mt-4 grid gap-2">
        {props.agents.length === 0 ? (
          <p className="text-xs text-slate-400">Crie agentes para vincular a esta fila.</p>
        ) : (
          props.agents.map((agent) => {
            const selectedIds = props.queue.agents.map((item) => item.id);
            const checked = selectedIds.includes(agent.id);
            return (
              <label key={agent.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!props.canEdit}
                  onChange={(event) => {
                    const next = event.target.checked ? [...selectedIds, agent.id] : selectedIds.filter((id) => id !== agent.id);
                    props.onChange((current) =>
                      current.map((item) =>
                        item.id === props.queue.id
                          ? {
                              ...item,
                              agents: props.agents
                                .filter((candidate) => next.includes(candidate.id))
                                .map((candidate) => ({ id: candidate.id, name: candidate.name })),
                            }
                          : item,
                      ),
                    );
                  }}
                  className="h-4 w-4 rounded border-slate-300"
                />
                {agent.name}
              </label>
            );
          })
        )}
      </div>

      <button
        type="button"
        onClick={() => void props.onSave(props.queue.id, props.queue.agents.map((agent) => agent.id))}
        disabled={props.loading || !props.canEdit}
        className="mt-4 w-full rounded-2xl bg-[#1A1C32] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#111426] disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {props.loading ? "Salvando membros..." : props.canEdit ? "Salvar membros da fila" : "Sem permissão para editar membros"}
      </button>
    </div>
  );
}





