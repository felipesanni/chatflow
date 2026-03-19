"use client";

import * as React from "react";
import { io, type Socket } from "socket.io-client";
import {
  Activity,
  ArrowRightLeft,
  Calendar,
  CheckSquare,
  ChevronDown,
  Clock,
  Code2,
  Database,
  Eye,
  EyeOff,
  FileAudio,
  FileImage,
  FileText,
  Info,
  LayoutGrid,
  LogIn,
  Menu,
  MessageSquare,
  Mic,
  Pause,
  Pencil,
  Phone,
  Paperclip,
  Play,
  Plus,
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
  customerName: string;
  externalChatId: string;
  externalContactId?: string | null;
  customerAvatarUrl?: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  isGroup: boolean;
  updatedAt: string;
  currentAgent: { id: string; name: string } | null;
  currentQueue: { id: string; name: string } | null;
  whatsappInstance: { id: string; name: string };
};

type MessageItem = {
  id: string;
  direction: "inbound" | "outbound" | "system";
  contentType: string;
  body: string | null;
  senderName: string | null;
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

type ComposerAttachment = {
  kind: "image" | "audio" | "document";
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
};

type InstanceItem = {
  id: string;
  name: string;
  evolutionInstanceName: string;
  baseUrl: string;
  status: string;
  phoneNumber: string | null;
  createdAt: string;
};

type AgentItem = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "agent";
  permissions: PermissionMap;
  presence: string;
  queues: Array<{ id: string; name: string }>;
  createdAt: string;
};

type QueueItem = {
  id: string;
  name: string;
  color: string | null;
  isActive: boolean;
  openTicketCount: number;
  agents: Array<{ id: string; name: string }>;
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
  createdAt: string;
  updatedAt: string;
  lastTicket: {
    id: string;
    status: "open" | "pending" | "closed";
    updatedAt: string;
    queueName: string | null;
  } | null;
};

type QuickReplyItem = {
  id: string;
  shortcut: string;
  content: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const permissionDefinitions = [
  { key: "dashboard.view", group: "Painel geral", label: "Visualizar painel geral" },
  { key: "tickets.view", group: "Atendimento", label: "Visualizar atendimento" },
  { key: "tickets.viewAll", group: "Atendimento", label: "Visualizar todos os tickets" },
  { key: "tickets.accept", group: "Atendimento", label: "Aceitar atendimentos" },
  { key: "tickets.reply", group: "Atendimento", label: "Responder mensagens" },
  { key: "tickets.close", group: "Atendimento", label: "Encerrar atendimentos" },
  { key: "tickets.groups", group: "Atendimento", label: "Visualizar grupos" },
  { key: "channels.view", group: "Canais e instâncias", label: "Visualizar canais e instâncias" },
  { key: "channels.manage", group: "Canais e instâncias", label: "Cadastrar e editar instâncias" },
  { key: "quickReplies.view", group: "Respostas rápidas", label: "Visualizar respostas rápidas" },
  { key: "quickReplies.manage", group: "Respostas rápidas", label: "Cadastrar e editar respostas rápidas" },
  { key: "team.view", group: "Equipe e filas", label: "Visualizar equipe e filas" },
  { key: "agents.manage", group: "Equipe e filas", label: "Cadastrar e editar usuários" },
  { key: "queues.manage", group: "Equipe e filas", label: "Cadastrar e editar filas" },
  { key: "queues.assign", group: "Equipe e filas", label: "Associar agentes às filas" },
  { key: "api.view", group: "API", label: "Visualizar módulo de API" },
  { key: "contacts.view", group: "Contatos", label: "Visualizar contatos" },
  { key: "contacts.manage", group: "Contatos", label: "Cadastrar e editar contatos" },
  { key: "profile.view", group: "Perfil", label: "Visualizar perfil" },
  { key: "activity.view", group: "Atividade", label: "Visualizar atividade operacional" },
  { key: "calendar.view", group: "Agenda", label: "Visualizar agenda operacional" },
  { key: "automations.view", group: "Automações", label: "Visualizar automações" },
  { key: "settings.view", group: "Configurações", label: "Visualizar configurações" },
] as const;

type PermissionKey = (typeof permissionDefinitions)[number]["key"];
type PermissionMap = Record<PermissionKey, boolean>;
type WorkspaceKey = "dashboard" | "tickets" | "channels" | "quickReplies" | "team" | "api" | "contacts" | "profile" | "activity" | "calendar" | "automations" | "settings";

const permissionKeys = permissionDefinitions.map((item) => item.key) as PermissionKey[];
const workspacePermissions: Record<WorkspaceKey, PermissionKey> = {
  dashboard: "dashboard.view",
  tickets: "tickets.view",
  channels: "channels.view",
  quickReplies: "quickReplies.view",
  team: "team.view",
  api: "api.view",
  contacts: "contacts.view",
  profile: "profile.view",
  activity: "activity.view",
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
    "tickets.accept": true,
    "tickets.reply": true,
    "tickets.close": true,
    "tickets.groups": true,
    "channels.view": true,
    "channels.manage": false,
    "quickReplies.view": true,
    "quickReplies.manage": false,
    "team.view": false,
    "agents.manage": false,
    "queues.manage": false,
    "queues.assign": false,
    "api.view": false,
    "contacts.view": true,
    "contacts.manage": false,
    "profile.view": true,
    "activity.view": true,
    "calendar.view": true,
    "automations.view": false,
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
    throw new Error(payload?.message ?? "Falha na requisição.");
  }

  return payload as T;
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

function formatAudioTime(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return "0:00";
  }

  const safeSeconds = Math.floor(totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
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
  return "Mensagem";
}

function resolveAttachmentUrl(ticketId: string, attachment: AttachmentItem) {
  if (attachment.publicUrl?.startsWith("data:")) {
    return attachment.publicUrl;
  }

  return `${API_URL}/tickets/${ticketId}/attachments/${attachment.id}/content`;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
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

  const [ticketLoading, setTicketLoading] = React.useState(false);
  const [messageLoading, setMessageLoading] = React.useState(false);
  const [sendLoading, setSendLoading] = React.useState(false);
  const [instanceLoading, setInstanceLoading] = React.useState(false);
  const [agentLoading, setAgentLoading] = React.useState(false);
  const [queueLoading, setQueueLoading] = React.useState(false);
  const [quickReplyLoading, setQuickReplyLoading] = React.useState(false);
  const [customerLoading, setCustomerLoading] = React.useState(false);
  const [conversationLoading, setConversationLoading] = React.useState(false);
  const [assignmentLoading, setAssignmentLoading] = React.useState<string | null>(null);
  const [editingInstanceId, setEditingInstanceId] = React.useState<string | null>(null);
  const [editingAgentId, setEditingAgentId] = React.useState<string | null>(null);
  const [editingQueueId, setEditingQueueId] = React.useState<string | null>(null);
  const [editingQuickReplyId, setEditingQuickReplyId] = React.useState<string | null>(null);
  const [editingCustomerId, setEditingCustomerId] = React.useState<string | null>(null);
  const [managementModal, setManagementModal] = React.useState<null | "instance" | "agent" | "queue" | "conversation" | "quickReply" | "customer">(null);
  const [managementModalTab, setManagementModalTab] = React.useState<"general" | "permissions">("general");

  const [messageInput, setMessageInput] = React.useState("");
  const [editingMessageId, setEditingMessageId] = React.useState<string | null>(null);
  const [replyToMessageId, setReplyToMessageId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<"atendendo" | "aguardando" | "grupos">("atendendo");
  const [activeWorkspace, setActiveWorkspace] = React.useState<"dashboard" | "tickets" | "channels" | "quickReplies" | "team" | "api" | "contacts" | "profile" | "activity" | "calendar" | "automations" | "settings">("tickets");
  const [adminSection, setAdminSection] = React.useState<"instances" | "agents" | "queues">("instances");
  const [showRail, setShowRail] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [showOnlyUnread, setShowOnlyUnread] = React.useState(false);
  const [showOnlyMine, setShowOnlyMine] = React.useState(false);
  const [selectedQueueFilter, setSelectedQueueFilter] = React.useState<string>("all");
  const [showTicketDetails, setShowTicketDetails] = React.useState(false);
  const [showTransferPanel, setShowTransferPanel] = React.useState(false);
  const [profileName, setProfileName] = React.useState("");
  const [profileAvatarPreview, setProfileAvatarPreview] = React.useState<string | null>(null);
  const [brandLogoPreview, setBrandLogoPreview] = React.useState<string | null>(null);
  const [brandMode, setBrandMode] = React.useState<"default" | "image" | "text">("default");
  const [brandText, setBrandText] = React.useState("CHATFLOW");
  const [composerAttachment, setComposerAttachment] = React.useState<ComposerAttachment | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
  const [recordingAudio, setRecordingAudio] = React.useState(false);
  const [openMessageMenuId, setOpenMessageMenuId] = React.useState<string | null>(null);
  const [publicUrls, setPublicUrls] = React.useState(resolvePublicUrls);
  const [profileSaving, setProfileSaving] = React.useState(false);
  const [transferLoading, setTransferLoading] = React.useState(false);

  const [loginForm, setLoginForm] = React.useState({ email: "", password: "" });
  const [bootstrapForm, setBootstrapForm] = React.useState({ name: "", email: "", password: "" });
  const [instanceForm, setInstanceForm] = React.useState({
    name: "",
    evolutionInstanceName: "",
    baseUrl: "",
    apiKey: "",
    webhookSecret: "",
  });
  const [agentForm, setAgentForm] = React.useState({
    name: "",
    email: "",
    password: "",
    role: "agent" as "admin" | "agent",
    permissions: defaultPermissionsForRole("agent"),
  });
  const [queueForm, setQueueForm] = React.useState({ name: "", color: "#1A1C32" });
  const [quickReplyForm, setQuickReplyForm] = React.useState({ shortcut: "", content: "", isActive: true });
  const [conversationForm, setConversationForm] = React.useState({
    customerName: "",
    phone: "",
    whatsappInstanceId: "",
    queueId: "",
  });
  const [customerForm, setCustomerForm] = React.useState({
    name: "",
    phone: "",
    email: "",
    companyName: "",
    notes: "",
  });
  const [transferForm, setTransferForm] = React.useState({
    agentId: "",
    queueId: "",
    reason: "",
  });
  const socketRef = React.useRef<Socket | null>(null);
  const userMenuRef = React.useRef<HTMLDivElement | null>(null);
  const attachmentUploadRef = React.useRef<HTMLInputElement | null>(null);
  const messagesViewportRef = React.useRef<HTMLDivElement | null>(null);
  const shouldStickMessagesToBottomRef = React.useRef(true);
  const audioRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioStreamRef = React.useRef<MediaStream | null>(null);
  const audioChunksRef = React.useRef<BlobPart[]>([]);

  const selectedTicket = React.useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? null,
    [tickets, selectedTicketId],
  );
  const editingMessage = React.useMemo(
    () => messages.find((message) => message.id === editingMessageId) ?? null,
    [editingMessageId, messages],
  );
  const replyToMessage = React.useMemo(
    () => messages.find((message) => message.id === replyToMessageId) ?? null,
    [messages, replyToMessageId],
  );

  const currentUser: AuthUser = user ?? {
    id: "",
    email: "",
    role: "agent",
    name: "",
    avatarUrl: null,
    permissions: defaultPermissionsForRole("agent"),
  };

  const canViewGroups = currentUser.permissions["tickets.groups"];
  const canViewChannels = currentUser.permissions["channels.view"];
  const canViewQuickReplies = currentUser.permissions["quickReplies.view"];
  const canViewTeam = currentUser.permissions["team.view"];
  const canManageInstances = currentUser.permissions["channels.manage"];
  const canManageQuickReplies = currentUser.permissions["quickReplies.manage"];
  const canManageAgents = currentUser.permissions["agents.manage"];
  const canManageQueues = currentUser.permissions["queues.manage"];
  const canAssignQueues = currentUser.permissions["queues.assign"];
  const canStartConversation = currentUser.permissions["tickets.reply"];
  const canViewContacts = currentUser.permissions["contacts.view"];
  const canManageContacts = currentUser.permissions["contacts.manage"];

  const isSelectedTicketOwnedByCurrentUser = Boolean(selectedTicket && selectedTicket.currentAgent?.id === user?.id);
  const canAcceptSelectedTicket = Boolean(
    selectedTicket &&
    selectedTicket.status !== "closed" &&
    selectedTicket.currentAgent?.id !== user?.id &&
    currentUser.permissions["tickets.accept"] &&
    !selectedTicket.currentAgent,
  );
  const canCloseSelectedTicket = Boolean(
    selectedTicket &&
    selectedTicket.status !== "closed" &&
    currentUser.permissions["tickets.close"] &&
    isSelectedTicketOwnedByCurrentUser,
  );
  const canSendToSelectedTicket = Boolean(
    selectedTicket &&
    selectedTicket.status !== "closed" &&
    currentUser.permissions["tickets.reply"] &&
    isSelectedTicketOwnedByCurrentUser,
  );
  const isSelectedTicketClosed = Boolean(selectedTicket?.status === "closed");
  const shouldDisableComposer = Boolean(!selectedTicket || !canSendToSelectedTicket);
  const isEditingMessage = Boolean(editingMessageId);
  const composerPlaceholder = !selectedTicket
    ? "Selecione um ticket para conversar"
    : isSelectedTicketClosed
      ? "Ticket fechado para envio"
      : isEditingMessage
        ? "Edite a mensagem"
        : "Aceite o atendimento para responder";
  const canTransferSelectedTicket = Boolean(
    selectedTicket &&
    selectedTicket.status !== "closed" &&
    canViewTeam &&
    currentUser.permissions["tickets.accept"] &&
    isSelectedTicketOwnedByCurrentUser,
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

  const visibleTickets = React.useMemo(() => {
    const search = searchQuery.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const matchesTab =
        activeTab === "grupos"
          ? ticket.isGroup
          : activeTab === "aguardando"
            ? ticket.status === "pending" && !ticket.isGroup
            : ticket.status === "open" && !ticket.isGroup;

      if (!matchesTab) {
        return false;
      }

      if (showOnlyUnread && ticket.unreadCount === 0) {
        return false;
      }

      if (showOnlyMine && ticket.currentAgent?.id !== user?.id) {
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
        ticket.externalChatId,
        ticket.lastMessagePreview ?? "",
        ticket.currentAgent?.name ?? "",
        ticket.currentQueue?.name ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(search);
    });
  }, [activeTab, searchQuery, selectedQueueFilter, showOnlyMine, showOnlyUnread, tickets, user?.id]);

  const counters = React.useMemo(
    () => ({
      atendendo: tickets.filter((ticket) => ticket.status === "open" && !ticket.isGroup).length,
      aguardando: tickets.filter((ticket) => ticket.status === "pending" && !ticket.isGroup).length,
      grupos: tickets.filter((ticket) => ticket.isGroup).length,
    }),
    [tickets],
  );

  const managementSearch = searchQuery.trim().toLowerCase();

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

  const agendaItems = React.useMemo(() => {
    return tickets
      .filter((ticket) => ticket.status !== "closed")
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map((ticket) => ({
        id: ticket.id,
        contato: ticket.customerName,
        fila: ticket.currentQueue?.name ?? "Sem fila",
        responsavel: ticket.currentAgent?.name ?? "Sem agente",
        status: traduzirStatusTicket(ticket.status),
        proximaAcao:
          ticket.status === "pending"
            ? "Assumir atendimento"
            : ticket.unreadCount > 0
              ? "Responder cliente"
              : "Acompanhar conversa",
        atualizadoEm: ticket.updatedAt,
      }))
      .filter((item) =>
        !managementSearch
          ? true
          : [item.contato, item.fila, item.responsavel, item.status, item.proximaAcao].join(" ").toLowerCase().includes(managementSearch),
      );
  }, [managementSearch, tickets]);

  React.useEffect(() => {
    if (visibleTickets.length === 0) {
      setSelectedTicketId(null);
      return;
    }

    if (!selectedTicketId || !visibleTickets.some((ticket) => ticket.id === selectedTicketId)) {
      setSelectedTicketId(visibleTickets[0]?.id ?? null);
    }
  }, [selectedTicketId, visibleTickets]);

  React.useEffect(() => {
    if (activeWorkspace !== "tickets" && showTicketDetails) {
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
      "dashboard",
      "channels",
      "quickReplies",
      "team",
      "api",
      "contacts",
      "profile",
      "activity",
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
    const handlePointerDown = () => {
      setOpenMessageMenuId(null);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  React.useEffect(() => {
    setShowTransferPanel(false);
    setTransferForm({
      agentId: selectedTicket?.currentAgent?.id ?? "",
      queueId: selectedTicket?.currentQueue?.id ?? "",
      reason: "",
    });
  }, [selectedTicket?.currentAgent?.id, selectedTicket?.currentQueue?.id, selectedTicketId]);

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
    if (!user) return;
    setTicketLoading(true);
    try {
      const payload = await apiFetch<{ items: TicketItem[] }>("/tickets", { method: "GET" });
      setTickets(payload.items);
      setSelectedTicketId((current) => {
        if (current && payload.items.some((ticket) => ticket.id === current)) {
          return current;
        }
        return payload.items[0]?.id ?? null;
      });
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao carregar tickets.");
    } finally {
      setTicketLoading(false);
    }
  }, [user]);

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
    if (!user || !normalizePermissions(user.role, user.permissions)["team.view"]) return;
    try {
      const payload = await apiFetch<{ items: AgentItem[] }>("/agents", { method: "GET" });
      setAgents(payload.items);
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao carregar agentes.");
    }
  }, [user]);

  const refreshQueues = React.useCallback(async () => {
    if (!user || !normalizePermissions(user.role, user.permissions)["team.view"]) return;
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

  const refreshAll = React.useCallback(async () => {
    await refreshTickets();
    if (selectedTicketId) {
      await refreshMessages(selectedTicketId);
    }
    await refreshInstances();
    await refreshAgents();
    await refreshQueues();
    await refreshCustomers();
    await refreshQuickReplies();
  }, [refreshAgents, refreshCustomers, refreshInstances, refreshMessages, refreshQueues, refreshQuickReplies, refreshTickets, selectedTicketId]);

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
      setSelectedTicketId(null);
      return;
    }

    void refreshTickets();
    if (canViewChannels) {
      void refreshInstances();
    }
    if (canViewTeam) {
      void refreshAgents();
      void refreshQueues();
    }
    if (canViewContacts) {
      void refreshCustomers();
    }
    if (canViewQuickReplies) {
      void refreshQuickReplies();
    }
  }, [canViewChannels, canViewContacts, canViewQuickReplies, canViewTeam, refreshAgents, refreshCustomers, refreshInstances, refreshQueues, refreshQuickReplies, refreshTickets, user]);

  React.useEffect(() => {
    if (!selectedTicketId || !user) {
      setMessages([]);
      return;
    }

    shouldStickMessagesToBottomRef.current = true;
    void refreshMessages(selectedTicketId);
  }, [refreshMessages, selectedTicketId, user]);

  React.useEffect(() => {
    if (!user || !SOCKET_URL) return;

    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    const refreshForTicket = (payload?: { ticketId?: string }) => {
      void refreshTickets();
      if (payload?.ticketId && payload.ticketId === selectedTicketId) {
        void refreshMessages(payload.ticketId, { silent: true });
      }
    };

    socket.on("connect_error", () => {
      setPanelMessage("Conexão em tempo real indisponível. O painel continua funcionando por atualização periódica.");
    });
    socket.on("ticket.updated", refreshForTicket);
    socket.on("ticket.closed", refreshForTicket);
    socket.on("message.created", refreshForTicket);
    socket.on("message.updated", refreshForTicket);
    socket.on("instance.updated", () => void refreshInstances());
    socket.on("agent.updated", () => void refreshAgents());
    socket.on("queue.updated", () => void refreshQueues());

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [refreshAgents, refreshInstances, refreshMessages, refreshQueues, refreshTickets, selectedTicketId, user]);

  React.useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      void refreshTickets();
      if (selectedTicketId && !socketRef.current?.connected) {
        void refreshMessages(selectedTicketId, { silent: true });
      }

      if (user.role === "admin") {
        void refreshInstances();
        void refreshAgents();
        void refreshQueues();
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [refreshAgents, refreshInstances, refreshMessages, refreshQueues, refreshTickets, selectedTicketId, user]);

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
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao encerrar a sessão.");
      return;
    }
    setUser(null);
    setMessages([]);
    setTickets([]);
    setSelectedTicketId(null);
    setActiveWorkspace("tickets");
    setUserMenuOpen(false);
    setAuthError(null);
      setPanelMessage("Sessão encerrada.");
    await refreshAuth();
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

  async function handleComposerAttachmentChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";

    if (!file) return;
    if (isEditingMessage) {
      setPanelMessage("Finalize a edição atual antes de anexar um arquivo.");
      return;
    }

    if (file.size > 12_000_000) {
      setPanelMessage("O arquivo deve ter no máximo 12 MB.");
      return;
    }

    const attachment = await buildComposerAttachmentFromFile(file);

    setComposerAttachment(attachment);

    setPanelMessage(
        attachment.kind === "image"
          ? "Imagem pronta para envio."
          : attachment.kind === "audio"
            ? "Áudio pronto para envio."
            : "Arquivo pronto para envio.",
    );
  }

  function clearComposerAttachment() {
    setComposerAttachment(null);
  }

  function handleStartEditingMessage(message: MessageItem) {
    if (!canSendToSelectedTicket) {
      return;
    }

    setReplyToMessageId(null);
    setEditingMessageId(message.id);
    setComposerAttachment(null);
    setShowEmojiPicker(false);
    setMessageInput(stripAgentSignature((message.body ?? "").trim(), currentUser.name).trim());
    setPanelMessage("Modo de edição ativado.");
  }

  function handleStartReplyingToMessage(message: MessageItem) {
    if (!canSendToSelectedTicket || message.direction === "system") {
      return;
    }

    setEditingMessageId(null);
    setReplyToMessageId(message.id);
    setShowEmojiPicker(false);
    setPanelMessage("Respondendo mensagem.");
  }

  function cancelEditingMessage() {
    setEditingMessageId(null);
    setMessageInput("");
    setPanelMessage("Edição cancelada.");
  }

  function cancelReplyToMessage() {
    setReplyToMessageId(null);
    setPanelMessage("Resposta cancelada.");
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
        setComposerAttachment(attachment);
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
    if (!trimmedInput && !composerAttachment) return;
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
        await apiFetch(`/tickets/${selectedTicketId}/messages`, {
          method: "POST",
          body: JSON.stringify({
            body: resolvedBody,
            replyToMessageId: replyToMessageId ?? undefined,
            attachment: composerAttachment
              ? {
                  kind: composerAttachment.kind,
                  fileName: composerAttachment.fileName,
                  mimeType: composerAttachment.mimeType,
                  sizeBytes: composerAttachment.sizeBytes,
                  dataUrl: composerAttachment.dataUrl,
                }
              : undefined,
          }),
        });
      }

      setEditingMessageId(null);
      setReplyToMessageId(null);
      setMessageInput("");
      setComposerAttachment(null);
      await refreshMessages(selectedTicketId);
      await refreshTickets();
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : editingMessageId ? "Falha ao editar mensagem." : "Falha ao enviar mensagem.");
    } finally {
      setSendLoading(false);
    }
  }

  async function handleAcceptTicket() {
    if (!selectedTicketId) return;

    try {
      await apiFetch(`/tickets/${selectedTicketId}/accept`, { method: "POST" });
      await refreshTickets();
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
          reason: transferForm.reason.trim() || undefined,
        }),
      });

      await refreshTickets();
      setShowTransferPanel(false);
      setTransferForm((current) => ({ ...current, reason: "" }));
      setPanelMessage("Ticket transferido com sucesso.");
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao transferir ticket.");
    } finally {
      setTransferLoading(false);
    }
  }

  function applyQuickReply(item: QuickReplyItem) {
    setMessageInput((current) => current.replace(/(?:^|\s)\/([a-z0-9_-]*)$/i, (match) => match.replace(/\/([a-z0-9_-]*)$/i, item.content)));
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

    if (typeof window !== "undefined" && !window.confirm("Apagar esta mensagem para todos?")) {
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

    if (typeof window !== "undefined" && !window.confirm("Apagar esta mensagem apenas para você?")) {
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
      if (!sendLoading && canSendToSelectedTicket && (messageInput.trim() || composerAttachment)) {
        void handleSendMessage(event as unknown as React.FormEvent<HTMLFormElement>);
      }
    }
  }

  function resetInstanceForm() {
    setEditingInstanceId(null);
    setInstanceForm({
      name: "",
      evolutionInstanceName: "",
      baseUrl: "",
      apiKey: "",
      webhookSecret: "",
    });
  }

  function resetAgentForm() {
    setEditingAgentId(null);
    setAgentForm({ name: "", email: "", password: "", role: "agent", permissions: defaultPermissionsForRole("agent") });
    setManagementModalTab("general");
  }

  function resetQueueForm() {
    setEditingQueueId(null);
    setQueueForm({ name: "", color: "#1A1C32" });
  }

  function resetQuickReplyForm() {
    setEditingQuickReplyId(null);
    setQuickReplyForm({ shortcut: "", content: "", isActive: true });
  }

  function resetCustomerForm() {
    setEditingCustomerId(null);
    setCustomerForm({
      name: "",
      phone: "",
      email: "",
      companyName: "",
      notes: "",
    });
  }

  function resetConversationForm() {
    setConversationForm({
      customerName: "",
      phone: "",
      whatsappInstanceId: instances[0]?.id ?? "",
      queueId: "",
    });
  }

  function startEditInstance(instance: InstanceItem) {
    setEditingInstanceId(instance.id);
    setInstanceForm({
      name: instance.name,
      evolutionInstanceName: instance.evolutionInstanceName,
      baseUrl: instance.baseUrl,
      apiKey: "",
      webhookSecret: "",
    });
    setActiveWorkspace("settings");
    setAdminSection("instances");
    setManagementModal("instance");
  }

  function startEditAgent(agent: AgentItem) {
    setEditingAgentId(agent.id);
    setAgentForm({
      name: agent.name,
      email: agent.email,
      password: "",
      role: agent.role,
      permissions: normalizePermissions(agent.role, agent.permissions),
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

  function startEditCustomer(customer: CustomerItem) {
    setEditingCustomerId(customer.id);
    setCustomerForm({
      name: customer.name,
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      companyName: customer.companyName ?? "",
      notes: customer.notes ?? "",
    });
    setActiveWorkspace("contacts");
    setManagementModal("customer");
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
    setEditingQueueId(null);
    setEditingQuickReplyId(null);
    setEditingCustomerId(null);
    setInstanceForm({
      name: "",
      evolutionInstanceName: "",
      baseUrl: "",
      apiKey: "",
      webhookSecret: "",
    });
    setAgentForm({
      name: "",
      email: "",
      password: "",
      role: "agent",
      permissions: defaultPermissionsForRole("agent"),
    });
    setQueueForm({ name: "", color: "#1A1C32" });
    setQuickReplyForm({ shortcut: "", content: "", isActive: true });
    setCustomerForm({
      name: "",
      phone: "",
      email: "",
      companyName: "",
      notes: "",
    });
    setConversationForm({
      customerName: "",
      phone: "",
      whatsappInstanceId: instances[0]?.id ?? "",
      queueId: "",
    });
  }

  function updateAgentRole(role: "admin" | "agent") {
    setAgentForm((current) => ({
      ...current,
      role,
      permissions: defaultPermissionsForRole(role),
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

  async function handleCreateInstance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInstanceLoading(true);
    try {
      await apiFetch(editingInstanceId ? `/whatsapp/instances/${editingInstanceId}` : "/whatsapp/instances", {
        method: editingInstanceId ? "PUT" : "POST",
        body: JSON.stringify(instanceForm),
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
    setAgentLoading(true);
    try {
      await apiFetch(editingAgentId ? `/agents/${editingAgentId}` : "/agents", {
        method: editingAgentId ? "PUT" : "POST",
        body: JSON.stringify({ ...agentForm, queueIds: [], permissions: agentForm.permissions }),
      });
      resetAgentForm();
      closeManagementModal();
      setPanelMessage(editingAgentId ? "Agente atualizado." : "Agente criado.");
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

  async function handleCreateConversation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConversationLoading(true);
    try {
      const payload = await apiFetch<CreateConversationResponse>("/tickets", {
        method: "POST",
        body: JSON.stringify({
          customerName: conversationForm.customerName,
          phone: onlyPhoneDigits(conversationForm.phone),
          whatsappInstanceId: conversationForm.whatsappInstanceId,
          queueId: conversationForm.queueId || null,
        }),
      });

      closeManagementModal();
      await refreshTickets();
      setSelectedTicketId(payload.item.id);
      setActiveWorkspace("tickets");
      setPanelMessage(payload.created ? "Nova conversa iniciada." : "Conversa existente aberta.");
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao iniciar conversa.");
    } finally {
      setConversationLoading(false);
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

  const ticketWorkspaceAtivo = activeWorkspace === "tickets";

  const workspaceTitle =
    activeWorkspace === "dashboard"
      ? "Painel geral"
      : activeWorkspace === "tickets"
        ? "Atendimento"
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
              : activeWorkspace === "activity"
                ? "Atividade operacional"
                : activeWorkspace === "calendar"
                  ? "Agendamentos"
                  : activeWorkspace === "automations"
                    ? "Automações"
                    : "Configurações";
  const trimmedBrandText = brandText.trim();
  const shouldRenderBrandImage = brandMode === "image" && Boolean(brandLogoPreview);
  const shouldRenderBrandText = brandMode === "text" && trimmedBrandText.length > 0;
  const brandTextLabel = trimmedBrandText.length > 0 ? trimmedBrandText : "CHATFLOW";

  const workspaceDescription =
    activeWorkspace === "dashboard"
      ? "Resumo rápido do que está acontecendo no atendimento."
      : activeWorkspace === "tickets"
        ? "Caixa de entrada de conversas com a operação em tempo real."
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
              : activeWorkspace === "activity"
                ? "Leitura operacional do volume e das pendências."
                : activeWorkspace === "calendar"
                  ? "Lista operacional de acompanhamentos e próximos passos."
                  : activeWorkspace === "automations"
                    ? "Webhook, tempo real e fluxo da integração."
                    : "Ajustes administrativos e visão de ambiente.";

  const workspacePanel = (() => {
    if (activeWorkspace === "dashboard") {
      return (
        <div className="flex h-full flex-col gap-4 p-6">
          <div className="grid gap-4">
            <WorkspaceStatCard title="Atendendo" value={String(counters.atendendo)} accent="emerald" description="Conversas com agente responsável." />
            <WorkspaceStatCard title="Aguardando" value={String(counters.aguardando)} accent="amber" description="Tickets novos sem responsável." />
            <WorkspaceStatCard title="Grupos" value={String(counters.grupos)} accent="blue" description="Conversas coletivas monitoradas." />
          </div>
          <WorkspaceSection title="Últimos tickets" description="Atalhos rápidos para voltar à caixa de entrada.">
            <div className="grid gap-3">
              {tickets.slice(0, 6).map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => {
                    setActiveWorkspace("tickets");
                    setSelectedTicketId(ticket.id);
                    setShowTicketDetails(false);
                  }}
                  className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">{ticket.customerName}</div>
                    <span className="text-[11px] font-bold uppercase text-slate-400">{traduzirStatusTicket(ticket.status)}</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-500">{ticket.lastMessagePreview ?? "Sem mensagem registrada."}</div>
                  <div className="mt-3 text-[11px] uppercase tracking-[0.05em] text-slate-400">{ticket.currentQueue?.name ?? "Sem fila"} | {formatHour(ticket.updatedAt)}</div>
                </button>
              ))}
            </div>
          </WorkspaceSection>
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

            <DataTable columns={["Nome", "Evolution", "Status", "Telefone", "URL base", "Criado em", "Ações"]} emptyMessage="Nenhuma instância cadastrada.">
              {filteredInstances.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-sm text-slate-500">
                    Nenhuma instância cadastrada.
                  </td>
                </tr>
              ) : (
                filteredInstances.map((instance) => (
                  <DataRow key={instance.id}>
                    <DataCell>{instance.name}</DataCell>
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

              <DataTable columns={["Nome", "E-mail", "Perfil", "Presença", "Filas", "Ações"]} emptyMessage="Nenhum agente cadastrado.">
                {filteredAgents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-sm text-slate-500">
                      Nenhum agente cadastrado.
                    </td>
                  </tr>
                ) : (
                  filteredAgents.map((agent) => (
                    <DataRow key={agent.id}>
                      <DataCell>{agent.name}</DataCell>
                      <DataCell subtle>{agent.email}</DataCell>
                      <DataCell>
                        <StatusChip tone={agent.role === "admin" ? "default" : "success"}>{traduzirPerfil(agent.role)}</StatusChip>
                      </DataCell>
                      <DataCell subtle>{agent.presence}</DataCell>
                      <DataCell subtle>{agent.queues.map((queue) => queue.name).join(", ") || "Sem filas"}</DataCell>
                      <DataCell>
                        {canManageAgents ? (
                          <button type="button" onClick={() => startEditAgent(agent)} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900">
                            <Pencil className="h-4 w-4" />
                            Editar
                          </button>
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

              <DataTable columns={["Fila", "Cor", "Agentes", "Tickets abertos", "Ações"]} emptyMessage="Nenhuma fila cadastrada.">
                {filteredQueues.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-sm text-slate-500">
                      Nenhuma fila cadastrada.
                    </td>
                  </tr>
                ) : (
                  filteredQueues.map((queue) => (
                    <DataRow key={queue.id}>
                      <DataCell>{queue.name}</DataCell>
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

    if (activeWorkspace === "api") {
      const apiRows = [
        ["GET", "/api/health", "Saúde do backend", "Usado no monitoramento e verificação de deploy"],
        ["POST", "/api/auth/login", "Entrar no painel", "Autenticação com cookie seguro"],
        ["GET", "/api/tickets", "Listar atendimentos", "Base da caixa de entrada do módulo Atendimento"],
        ["POST", "/api/tickets/:ticketId/messages", "Enviar resposta", "Usa a instância vinculada ao ticket"],
        ["GET", "/api/quick-replies", "Listar respostas rápidas", "Base usada pelos atalhos com barra no atendimento"],
        ["POST", "/api/quick-replies", "Criar resposta rápida", "Cadastro administrativo de atalhos"],
        ["POST", "/api/webhooks/evolution", "Receber eventos", "Webhook público da Evolution"],
      ].filter((row) => row.join(" ").toLowerCase().includes(managementSearch || row.join(" ").toLowerCase()));

      return (
        <div className="flex h-full flex-col gap-4 p-6">
          <WorkspaceSection title="API própria" description="Consulta rápida dos endpoints operacionais e parâmetros principais.">
            <ModuleToolbar
              title="Referência da API"
              count={apiRows.length}
              searchValue={searchQuery}
              searchPlaceholder="Pesquisar rota, método ou uso"
              onSearchChange={setSearchQuery}
            />

            <DataTable columns={["Método", "Rota", "Uso", "Observação"]} emptyMessage="Nenhum endpoint disponível.">
              {apiRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-sm text-slate-500">
                    Nenhum endpoint disponível.
                  </td>
                </tr>
              ) : (
                apiRows.map(([method, route, usage, note]) => (
                  <DataRow key={route}>
                    <DataCell>
                      <StatusChip tone={method === "GET" ? "success" : "default"}>{method}</StatusChip>
                    </DataCell>
                    <DataCell subtle>{route}</DataCell>
                    <DataCell>{usage}</DataCell>
                    <DataCell subtle>{note}</DataCell>
                  </DataRow>
                ))
              )}
            </DataTable>

            <DataTable columns={["Item", "Valor"]} emptyMessage="Sem dados de ambiente.">
              <DataRow>
                <DataCell>Base pública da API</DataCell>
                <DataCell subtle>{publicUrls.apiBaseUrl}</DataCell>
              </DataRow>
              <DataRow>
                <DataCell>Webhook Evolution</DataCell>
                <DataCell subtle>{publicUrls.webhookUrl}</DataCell>
              </DataRow>
              <DataRow>
                <DataCell>Frontend publicado</DataCell>
                <DataCell subtle>{publicUrls.webBaseUrl}</DataCell>
              </DataRow>
              <DataRow>
                <DataCell>Tempo real</DataCell>
                <DataCell subtle>{SOCKET_URL ?? "NEXT_PUBLIC_SOCKET_URL não configurada"}</DataCell>
              </DataRow>
            </DataTable>
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
              columns={
                canManageContacts
                  ? ["Nome", "Telefone", "E-mail", "Empresa", "Ultimo ticket", "Atualizado em", "Ações"]
                  : ["Nome", "Telefone", "E-mail", "Empresa", "Ultimo ticket", "Atualizado em"]
              }
              emptyMessage="Nenhum contato encontrado."
            >
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={canManageContacts ? 7 : 6} className="px-5 py-8 text-sm text-slate-500">
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
                    {canManageContacts ? (
                      <DataCell>
                        <button type="button" onClick={() => startEditCustomer(customer)} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900">
                          <Pencil className="h-4 w-4" />
                          Editar
                        </button>
                      </DataCell>
                    ) : null}
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

    if (activeWorkspace === "activity") {
      return (
        <div className="flex h-full flex-col gap-4 p-6">
          <div className="grid gap-4">
            <WorkspaceStatCard title="Tickets visíveis" value={String(visibleTickets.length)} accent="slate" description="Resultado da busca e dos filtros atuais." />
            <WorkspaceStatCard title="Não lidos" value={String(tickets.filter((ticket) => ticket.unreadCount > 0).length)} accent="emerald" description="Conversas pedindo resposta rápida." />
            <WorkspaceStatCard title="Com agente" value={String(tickets.filter((ticket) => ticket.currentAgent).length)} accent="blue" description="Atendimentos já distribuídos." />
            <WorkspaceStatCard title="Sem fila" value={String(tickets.filter((ticket) => !ticket.currentQueue).length)} accent="amber" description="Conversas ainda sem classificação." />
          </div>
          <WorkspaceSection title="Leitura operacional" description="Últimos movimentos do atendimento.">
            <DataTable columns={["Cliente", "Status", "Responsável", "Atualização"]} emptyMessage="Nenhum movimento recente.">
              {tickets.slice(0, 8).map((ticket) => (
                <DataRow key={ticket.id}>
                  <DataCell>{ticket.customerName}</DataCell>
                  <DataCell>
                    <StatusChip tone={ticket.status === "open" ? "success" : ticket.status === "pending" ? "warning" : "default"}>
                      {traduzirStatusTicket(ticket.status)}
                    </StatusChip>
                  </DataCell>
                  <DataCell subtle>{ticket.currentAgent?.name ?? "Sem agente"}</DataCell>
                  <DataCell subtle>{formatDateTime(ticket.updatedAt)}</DataCell>
                </DataRow>
              ))}
            </DataTable>
          </WorkspaceSection>
        </div>
      );
    }

    if (activeWorkspace === "calendar") {
      return (
        <div className="flex h-full flex-col gap-4 p-6">
          <WorkspaceSection title="Agendamentos" description="Lista operacional de acompanhamentos e proximas acoes do dia.">
            <ModuleToolbar
              title="Agendamentos"
              count={agendaItems.length}
              searchValue={searchQuery}
              searchPlaceholder="Pesquisar contato, fila ou responsavel"
              onSearchChange={setSearchQuery}
            />
            <DataTable columns={["Contato", "Fila", "Responsavel", "Status", "Proxima acao", "Atualizado em"]} emptyMessage="Nenhum agendamento operacional encontrado.">
              {agendaItems.map((item) => (
                <DataRow key={item.id}>
                  <DataCell>{item.contato}</DataCell>
                  <DataCell subtle>{item.fila}</DataCell>
                  <DataCell subtle>{item.responsavel}</DataCell>
                  <DataCell>
                    <StatusChip tone={item.status === "Atendendo" ? "success" : "warning"}>{item.status}</StatusChip>
                  </DataCell>
                  <DataCell subtle>{item.proximaAcao}</DataCell>
                  <DataCell subtle>{formatDateTime(item.atualizadoEm)}</DataCell>
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
          <WorkspaceSection title="Fluxo da integração" description="Como a operação conversa com a API e com a Evolution.">
            <DataTable columns={["Etapa", "Canal", "Detalhe"]} emptyMessage="Nenhum fluxo configurado.">
              <DataRow>
                <DataCell>Entrada</DataCell>
                <DataCell subtle>Webhook da Evolution</DataCell>
                <DataCell subtle>POST /api/webhooks/evolution</DataCell>
              </DataRow>
              <DataRow>
                <DataCell>Saída</DataCell>
                <DataCell subtle>Envio via API própria</DataCell>
                <DataCell subtle>POST /api/tickets/:ticketId/messages</DataCell>
              </DataRow>
              <DataRow>
                <DataCell>Tempo real</DataCell>
                <DataCell subtle>Socket.IO</DataCell>
                <DataCell subtle>{SOCKET_URL ?? "Configure a variável NEXT_PUBLIC_SOCKET_URL"}</DataCell>
              </DataRow>
              <DataRow>
                <DataCell>Proxy</DataCell>
                <DataCell subtle>Frontend</DataCell>
                <DataCell subtle>/api-proxy mantendo segredos no backend</DataCell>
              </DataRow>
            </DataTable>
          </WorkspaceSection>
        </div>
      );
    }

    if (activeWorkspace === "settings") {
      return (
        <div className="flex h-full flex-col gap-4 p-6">
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

          <div className="flex flex-wrap gap-2">
            <AdminTab label="Instâncias" active={adminSection === "instances"} onClick={() => setAdminSection("instances")} />
            <AdminTab label="Agentes" active={adminSection === "agents"} onClick={() => setAdminSection("agents")} />
            <AdminTab label="Filas" active={adminSection === "queues"} onClick={() => setAdminSection("queues")} />
          </div>

          {adminSection === "instances" ? (
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

              <DataTable columns={["Nome", "Evolution", "Status", "Telefone", "URL base", "Criado em", "Ações"]} emptyMessage="Nenhuma instância cadastrada.">
                {filteredInstances.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-sm text-slate-500">
                      Nenhuma instância cadastrada.
                    </td>
                  </tr>
                ) : (
                  filteredInstances.map((instance) => (
                    <DataRow key={instance.id}>
                      <DataCell>{instance.name}</DataCell>
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

              <DataTable columns={["Nome", "E-mail", "Perfil", "Presença", "Filas", "Ações"]} emptyMessage="Nenhum agente cadastrado.">
                {filteredAgents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-sm text-slate-500">
                      Nenhum agente cadastrado.
                    </td>
                  </tr>
                ) : (
                  filteredAgents.map((agent) => (
                    <DataRow key={agent.id}>
                      <DataCell>{agent.name}</DataCell>
                      <DataCell subtle>{agent.email}</DataCell>
                      <DataCell>
                        <StatusChip tone={agent.role === "admin" ? "default" : "success"}>{traduzirPerfil(agent.role)}</StatusChip>
                      </DataCell>
                      <DataCell subtle>{agent.presence}</DataCell>
                      <DataCell subtle>{agent.queues.map((queue) => queue.name).join(", ") || "Sem filas"}</DataCell>
                      <DataCell>
                        {canManageAgents ? (
                          <button type="button" onClick={() => startEditAgent(agent)} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900">
                            <Pencil className="h-4 w-4" />
                            Editar
                          </button>
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

              <DataTable columns={["Fila", "Cor", "Agentes", "Tickets abertos", "Ações"]} emptyMessage="Nenhuma fila cadastrada.">
                {filteredQueues.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-sm text-slate-500">
                      Nenhuma fila cadastrada.
                    </td>
                  </tr>
                ) : (
                  filteredQueues.map((queue) => (
                    <DataRow key={queue.id}>
                      <DataCell>{queue.name}</DataCell>
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
            <div className="border-b border-slate-200 bg-white px-5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-700">
                    {selectedTicket.customerAvatarUrl ? (
                      <img src={selectedTicket.customerAvatarUrl} alt={`Foto de ${selectedTicket.customerName}`} className="h-full w-full object-cover" />
                    ) : (
                      initials(selectedTicket.customerName) || "C"
                    )}
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowTicketDetails(true)}
                      className="text-left transition hover:opacity-80"
                    >
                      <h3 className="text-[16px] font-semibold leading-tight tracking-[-0.02em] text-[#1A1C32]">{selectedTicket.customerName}</h3>
                    </button>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-slate-500">
                      <span>{selectedTicket.whatsappInstance.name}</span>
                      <span className="text-slate-300">•</span>
                      <span>{selectedTicket.currentAgent?.name ?? (selectedTicket.isGroup ? "Conversa de grupo" : "Aguardando atendente")}</span>
                      <span className="text-slate-300">•</span>
                      <span>{formatPhoneInput(selectedTicket.externalContactId ?? selectedTicket.externalChatId)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button type="button" aria-label="Assumir atendimento selecionado" title="Assumir atendimento" onClick={() => void handleAcceptTicket()} disabled={!canAcceptSelectedTicket} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#e7eff8] px-4 text-[11px] font-bold uppercase tracking-[0.12em] text-[#385a7a] transition hover:bg-[#dbe7f3] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500">
                    <CheckSquare className="h-4 w-4" />
                    {selectedTicket.currentAgent?.id === currentUser.id ? "Em atendimento" : selectedTicket.status === "closed" ? "Atendimento fechado" : "Aceitar atendimento"}
                  </button>
                  {canTransferSelectedTicket ? (
                    <button
                      type="button"
                      aria-label={showTransferPanel ? "Fechar popup de transferência" : "Transferir atendimento"}
                      title="Transferir atendimento"
                      onClick={() => setShowTransferPanel(true)}
                      className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[11px] font-bold uppercase tracking-[0.12em] transition ${showTransferPanel ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                      Transferir
                    </button>
                  ) : null}
                  <button type="button" aria-label="Fechar atendimento selecionado" title="Fechar atendimento" onClick={() => void handleCloseTicket()} disabled={!canCloseSelectedTicket} className="inline-flex h-10 items-center gap-2 rounded-full border border-red-200 bg-white px-4 text-[11px] font-bold uppercase tracking-[0.12em] text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400">
                    <X className="h-3.5 w-3.5" />
                    {selectedTicket.status === "closed" ? "Fechado" : "Fechar"}
                  </button>
                  <button type="button" aria-label={showTicketDetails ? "Ocultar detalhes do atendimento" : "Mostrar detalhes do atendimento"} title={showTicketDetails ? "Ocultar detalhes" : "Mostrar detalhes"} onClick={() => setShowTicketDetails((current) => !current)} className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-700">
                    <Info className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 overflow-hidden">
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
                  {messageLoading ? (
                    <div className="text-center text-sm text-slate-500">Carregando mensagens...</div>
                  ) : messages.length === 0 ? (
                    <EmptyMessages />
                  ) : (
                      messages.map((message) => {
                        const outgoing = message.direction === "outbound";
                        const system = message.direction === "system";
                        const isDeletedMessage = Boolean(message.deleted?.isDeleted);
                        const hasAttachment = Boolean(message.attachments?.length);
                        const normalizedBody = (message.body ?? "").trim();
                        const shouldShowInboundGroupSender =
                          Boolean(selectedTicket?.isGroup) &&
                          !outgoing &&
                          !system &&
                          Boolean(message.senderName?.trim());
                        const canEditMessage = outgoing && canSendToSelectedTicket && !hasAttachment && Boolean(normalizedBody) && !isDeletedMessage;
                        const canDeleteMessage = outgoing && canSendToSelectedTicket && !isDeletedMessage;
                        const canDeleteMessageForMe = !system;
                        const canReplyToMessage = !system && canSendToSelectedTicket && !isEditingMessage && !isDeletedMessage;
                        const groupedReactions = (message.reactions ?? []).reduce<Record<string, number>>((acc, reaction) => {
                          acc[reaction.emoji] = (acc[reaction.emoji] ?? 0) + 1;
                          return acc;
                        }, {});
                        const messageAttachments = message.attachments ?? [];
                        const shouldHideMessageBody =
                          messageAttachments.length > 0 &&
                          (
                            !normalizedBody
                          || /^(imagem|audio|documento|video) recebido$/i.test(normalizedBody)
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
                            <div className={`flex items-start gap-2 ${outgoing ? "flex-row-reverse" : ""}`}>
                              <div className={`flex max-w-[85%] flex-col md:max-w-[70%] ${outgoing ? "items-end" : "items-start"}`}>
                              <article className={`w-full rounded-[18px] px-4 py-3 text-sm shadow-sm ${outgoing ? "border border-[#cfe9ad] bg-[#dcf8c6] text-slate-800" : "rounded-tl-[8px] border border-[#ece4d8] bg-white text-slate-800"}`}>
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
                                    <div className="mt-1 truncate text-sm text-slate-700">
                                      {summarizeQuotedMessage(message.replyToMessage)}
                                    </div>
                                  </div>
                                ) : null}
                                {shouldRenderAttachments ? (
                                  <div className={`${message.body && !shouldHideMessageBody ? "mb-3" : ""} space-y-3 ${isDeletedMessage ? "opacity-55 saturate-0" : ""}`}>
                                    {messageAttachments.map((attachment) => (
                                      <div key={attachment.id} className="overflow-hidden rounded-[20px] border border-slate-200/80 bg-white/70">
                                      {attachment.mimeType.startsWith("image/") ? (
                                        <a href={resolveAttachmentUrl(selectedTicket.id, attachment)} target="_blank" rel="noreferrer" className="block">
                                          <img src={resolveAttachmentUrl(selectedTicket.id, attachment)} alt={attachment.fileName ?? "Imagem"} className="max-h-72 w-full object-cover" />
                                        </a>
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
                                {message.body && !shouldHideMessageBody ? (
                                  <div className={`whitespace-pre-wrap text-[15px] leading-6 ${isDeletedMessage ? "text-slate-400 line-through decoration-2" : ""}`}>
                                    {message.body}
                                  </div>
                                ) : null}
                                {!message.body && messageAttachments.length === 0 ? (
                                  <div className={`whitespace-pre-wrap text-[15px] leading-6 ${isDeletedMessage ? "text-slate-400 line-through decoration-2" : ""}`}>
                                    {`[${message.contentType}]`}
                                  </div>
                                ) : null}
                                {message.editedAt && !shouldHideMessageBody && !isDeletedMessage ? <div className="mt-2 text-[11px] font-medium italic text-slate-400">Editada</div> : null}
                                {isDeletedMessage ? <div className="mt-2 text-[11px] font-medium italic text-slate-400">Mensagem apagada para todos</div> : null}
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
                              {canEditMessage || canDeleteMessage || canDeleteMessageForMe || canReplyToMessage ? (
                                <div className="relative mt-1">
                                  <button
                                    type="button"
                                    aria-label="Abrir ações da mensagem"
                                    title="Mais opções"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setOpenMessageMenuId((current) => current === message.id ? null : message.id);
                                    }}
                                    className={`grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition hover:bg-slate-50 hover:text-slate-700 ${openMessageMenuId === message.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                                  >
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  </button>

                                  {openMessageMenuId === message.id ? (
                                    <div
                                      onClick={(event) => event.stopPropagation()}
                                      className={`absolute z-20 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_48px_rgba(15,23,42,0.16)] ${outgoing ? "right-0" : "left-0"}`}
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

              <form onSubmit={handleSendMessage} className="border-t border-slate-200 bg-white px-4 py-2.5 md:px-5">
                <input ref={attachmentUploadRef} type="file" className="hidden" onChange={(event) => void handleComposerAttachmentChange(event)} />
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
                {composerAttachment ? (
                  <div className="mb-3 flex items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-white/90 px-4 py-3 shadow-[0_14px_40px_rgba(148,163,184,0.1)]">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-2xl bg-slate-100 text-slate-500">
                        {composerAttachment.kind === "image" ? (
                          <img src={composerAttachment.dataUrl} alt={composerAttachment.fileName} className="h-full w-full object-cover" />
                        ) : composerAttachment.kind === "audio" ? (
                          <FileAudio className="h-4 w-4" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-800">{composerAttachment.fileName}</div>
                        <div className="text-xs text-slate-400">{composerAttachment.mimeType}</div>
                      </div>
                    </div>
                    <button type="button" onClick={clearComposerAttachment} className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400 transition hover:text-slate-700">
                      Remover
                    </button>
                  </div>
                ) : null}
                <div className="flex items-end gap-3">
                  <div className="flex items-center gap-2 pb-0.5">
                    <div className="relative">
                      <button type="button" aria-label="Biblioteca de emoji" title="Emoji" onClick={() => setShowEmojiPicker((current) => !current)} disabled={shouldDisableComposer || sendLoading} className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
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
                                className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-50 text-xl transition hover:bg-slate-100"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <button type="button" aria-label="Anexar arquivo" title="Anexar arquivo" onClick={() => attachmentUploadRef.current?.click()} disabled={shouldDisableComposer || sendLoading || isEditingMessage} className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
                      <Paperclip className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={recordingAudio ? "Parar gravação" : "Gravar áudio"}
                      title={recordingAudio ? "Parar gravação" : "Gravar áudio"}
                      onClick={() => void handleToggleAudioRecording()}
                      disabled={shouldDisableComposer || sendLoading || isEditingMessage}
                      className={`grid h-10 w-10 place-items-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        recordingAudio
                          ? "border-red-200 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600"
                          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                      }`}
                    >
                      {recordingAudio ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="relative flex-1">
                    <textarea
                      value={messageInput}
                      onChange={(event) => setMessageInput(event.target.value)}
                      onKeyDown={handleComposerKeyDown}
                      rows={1}
                      placeholder={canSendToSelectedTicket ? (isEditingMessage ? "Edite a mensagem" : "Digite uma mensagem ou use /atalho") : composerPlaceholder}
                      disabled={shouldDisableComposer}
                      className="min-h-[44px] max-h-28 w-full resize-none rounded-[24px] border border-slate-200 bg-[#f8fafc] px-5 py-2.5 text-sm leading-5 text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    />
                    {quickReplyMatches.length > 0 && canSendToSelectedTicket && !isEditingMessage ? (
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
                  <button
                    type="submit"
                    aria-label="Enviar mensagem"
                    disabled={sendLoading || (!messageInput.trim() && !composerAttachment) || shouldDisableComposer}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#1A1C32] px-5 text-sm font-bold uppercase tracking-[0.12em] text-white transition hover:bg-[#252844] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                  >
                    <Send className="h-4 w-4" />
                    {sendLoading ? (isEditingMessage ? "Salvando" : "Enviando") : (isEditingMessage ? "Salvar" : "Enviar")}
                  </button>
                </div>
              </form>
              </div>

              {showTicketDetails ? (
                <aside className="hidden w-[320px] shrink-0 border-l border-slate-200 bg-white xl:flex xl:flex-col">
                  <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <div className="text-lg font-semibold text-[#1A1C32]">Dados do contato</div>
                    <button type="button" onClick={() => setShowTicketDetails(false)} className="text-slate-400 transition hover:text-slate-700">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="space-y-5 overflow-y-auto px-5 py-5">
                    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-5">
                      <div className="mx-auto grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-slate-200 text-2xl font-semibold text-slate-600">
                        {selectedTicket.customerAvatarUrl ? (
                          <img src={selectedTicket.customerAvatarUrl} alt={`Foto de ${selectedTicket.customerName}`} className="h-full w-full object-cover" />
                        ) : (
                          initials(selectedTicket.customerName) || "C"
                        )}
                      </div>
                      <div className="mt-4 text-center">
                        <div className="text-xl font-semibold text-slate-900">{selectedTicket.customerName}</div>
                        <div className="mt-4 grid gap-3 text-left">
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Nome</div>
                            <div className="mt-1 text-sm font-semibold text-slate-800">{selectedTicket.customerName}</div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Telefone</div>
                            <div className="mt-1 text-sm font-semibold text-slate-800">{formatPhoneInput(selectedTicket.externalContactId ?? selectedTicket.externalChatId)}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <InfoRow title="Status" subtitle={traduzirStatusTicket(selectedTicket.status)} meta={`não lidos: ${selectedTicket.unreadCount}`} />
                      <InfoRow title="Fila" subtitle={selectedTicket.currentQueue?.name ?? "Sem fila"} meta={selectedTicket.isGroup ? "conversa em grupo" : "conversa individual"} />
                      <InfoRow title="Responsável" subtitle={selectedTicket.currentAgent?.name ?? "Sem agente"} meta={selectedTicket.whatsappInstance.name} />
                      <InfoRow title="Atualizado em" subtitle={formatDateTime(selectedTicket.updatedAt)} meta={formatPhoneInput(selectedTicket.externalContactId ?? selectedTicket.externalChatId)} />
                    </div>
                  </div>
                </aside>
              ) : null}
            </div>
            {showTransferPanel && canTransferSelectedTicket ? (
              <div className="absolute inset-0 z-40 flex items-start justify-center bg-slate-950/18 px-4 py-20 backdrop-blur-[2px]">
                <div className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_32px_80px_rgba(15,23,42,0.22)]">
                  <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-600">Transferir atendimento</div>
                      <div className="mt-1 text-lg font-semibold text-[#1A1C32]">{selectedTicket.customerName}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowTransferPanel(false)}
                      className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <form onSubmit={handleTransferTicket} className="space-y-5 px-6 py-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block text-sm font-medium text-slate-600">
                        Agente de destino
                        <select
                          value={transferForm.agentId}
                          onChange={(event) => setTransferForm((current) => ({ ...current, agentId: event.target.value }))}
                          className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                        >
                          <option value="">Sem agente definido</option>
                          {agents.map((agent) => (
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
                          <option value="">Sem fila</option>
                          {queues.map((queue) => (
                            <option key={queue.id} value={queue.id}>
                              {queue.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="block text-sm font-medium text-slate-600">
                      Motivo
                      <input
                        value={transferForm.reason}
                        onChange={(event) => setTransferForm((current) => ({ ...current, reason: event.target.value }))}
                        placeholder="Ex.: redistribuição, escalonamento..."
                        className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                      />
                    </label>

                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={() => setShowTransferPanel(false)}
                        className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={transferLoading || (!transferForm.agentId && !transferForm.queueId)}
                        className="inline-flex h-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f766e,#155e75)] px-5 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(14,116,144,0.24)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                      >
                        {transferLoading ? "Transferindo..." : "Confirmar"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <EmptyCenter />
        )}
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
        description: "Abra um atendimento manual informando contato, instância e fila opcional.",
        content: (
          <form onSubmit={handleCreateConversation} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <CompactField
                label="Nome do contato"
                value={conversationForm.customerName}
                onChange={(value) => setConversationForm((current) => ({ ...current, customerName: value }))}
                placeholder="Nome do cliente"
              />
              <CompactField
                label="Telefone"
                value={formatPhoneInput(conversationForm.phone)}
                onChange={(value) => setConversationForm((current) => ({ ...current, phone: onlyPhoneDigits(value) }))}
                placeholder="+55 (11) 99999-9999"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-slate-600">
                Instância
                <select
                  value={conversationForm.whatsappInstanceId}
                  onChange={(event) => setConversationForm((current) => ({ ...current, whatsappInstanceId: event.target.value }))}
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
                <select
                  value={conversationForm.queueId}
                  onChange={(event) => setConversationForm((current) => ({ ...current, queueId: event.target.value }))}
                  className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                >
                  <option value="">Sem fila inicial</option>
                  {queues.map((queue) => (
                    <option key={queue.id} value={queue.id}>
                      {queue.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              Depois de criar a conversa, o ticket será aberto automaticamente no atendimento para você enviar a primeira mensagem.
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeManagementModal} className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                Cancelar
              </button>
              <PrimaryAction disabled={conversationLoading} className="sm:w-auto sm:px-6">
                {conversationLoading ? "Iniciando..." : "Iniciar conversa"}
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

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
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
              <textarea
                value={quickReplyForm.content}
                onChange={(event) => setQuickReplyForm((current) => ({ ...current, content: event.target.value }))}
                rows={6}
                placeholder="Digite aqui a mensagem que será aplicada quando o agente usar /atalho."
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-300"
              />
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
        title: editingAgentId ? "Editar usuário" : "Adicionar usuário",
        description: "Cadastre agentes e administradores do painel operacional, com acesso granular por módulo e ação.",
        content: (
          <form onSubmit={handleCreateAgent} className="space-y-4">
            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
              <AdminTab label="Geral" active={managementModalTab === "general"} onClick={() => setManagementModalTab("general")} />
              <AdminTab label="Permissões" active={managementModalTab === "permissions"} onClick={() => setManagementModalTab("permissions")} />
            </div>

            {managementModalTab === "general" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <CompactField label="Nome" value={agentForm.name} onChange={(value) => setAgentForm((current) => ({ ...current, name: value }))} placeholder="Nome completo" />
                <CompactField label="E-mail" value={agentForm.email} onChange={(value) => setAgentForm((current) => ({ ...current, email: value }))} placeholder="usuario@empresa.com" />
                <CompactField label={editingAgentId ? "Nova senha" : "Senha"} type="password" value={agentForm.password} onChange={(value) => setAgentForm((current) => ({ ...current, password: value }))} placeholder={editingAgentId ? "Opcional para manter a atual" : "Senha de acesso"} />
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
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  {agentForm.role === "admin"
                    ? "Administradores recebem acesso completo. Você pode revisar a matriz abaixo, mas todas as permissões permanecem habilitadas."
                    : "Defina exatamente quais módulos e ações este usuário poderá acessar no painel."}
                </div>
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
      <main className="min-h-screen bg-[#ebf1f4] px-6 py-8">
        <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.1)] lg:grid-cols-[1.1fr_0.9fr]">
          <section className="bg-[#1A1C32] px-8 py-10 text-white lg:px-12 lg:py-12">
            <div className="inline-flex items-center gap-3 text-xl font-semibold">
              <span className="grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-white/10">
                <ShieldCheck className="h-5 w-5" />
              </span>
              CHATFLOW
            </div>
            <div className="mt-12 max-w-xl space-y-5">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-white/60">Painel interno</p>
              <h1 className="text-5xl font-semibold leading-[1.02] tracking-[-0.04em]">
                Atendimento com cara de operação real.
              </h1>
              <p className="text-base leading-8 text-white/72">
                Backend próprio, PostgreSQL e Evolution com uma interface mais próxima do sistema original, mas sem voltar Firebase nem dependências antigas.
              </p>
            </div>
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              <FeatureCard icon={Database} title="Banco novo" description="Tickets, mensagens e filas agora vivem no PostgreSQL." />
              <FeatureCard icon={Zap} title="Evolution" description="Webhook e envio centralizados pela API própria." />
              <FeatureCard icon={Workflow} title="Operação" description="Layout administrativo inspirado no sistema anterior." />
            </div>
          </section>

          <section className="flex items-center bg-[#f7fafc] p-6 lg:p-10">
            <div className="w-full rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm lg:p-8">
              <div className="mb-8 flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Acesso</div>
                  <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-900">
                    {mode === "login" ? "Entrar no painel" : "Criar administrador inicial"}
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label={mode === "login" ? "Abrir primeiro acesso" : "Voltar para login"}
                  onClick={() => setMode((current) => (current === "login" ? "bootstrap" : "login"))}
                  className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-white"
                >
                  {mode === "login" ? "Primeiro acesso" : "Voltar"}
                </button>
              </div>

              {mode === "login" ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <AuthField label="E-mail" value={loginForm.email} onChange={(value) => setLoginForm((current) => ({ ...current, email: value }))} placeholder="admin@chatflow.local" />
                  <AuthField label="Senha" type="password" value={loginForm.password} onChange={(value) => setLoginForm((current) => ({ ...current, password: value }))} placeholder="Sua senha" />
                  <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#19c37d] px-4 py-3 text-base font-semibold text-slate-950 transition hover:bg-[#14b26f]">
                    <LogIn className="h-4 w-4" />
                    Entrar
                  </button>
                </form>
              ) : (
                <form onSubmit={handleBootstrap} className="space-y-4">
                  <AuthField label="Nome" value={bootstrapForm.name} onChange={(value) => setBootstrapForm((current) => ({ ...current, name: value }))} placeholder="Administrador ChatFlow" />
                  <AuthField label="E-mail" value={bootstrapForm.email} onChange={(value) => setBootstrapForm((current) => ({ ...current, email: value }))} placeholder="admin@chatflow.local" />
                  <AuthField label="Senha" type="password" value={bootstrapForm.password} onChange={(value) => setBootstrapForm((current) => ({ ...current, password: value }))} placeholder="Minimo de 8 caracteres" />
                  <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#19c37d] px-4 py-3 text-base font-semibold text-slate-950 transition hover:bg-[#14b26f]">
                    <ShieldCheck className="h-4 w-4" />
                    Criar administrador
                  </button>
                </form>
              )}

              {(authError || panelMessage) && (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {authError ?? panelMessage}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen overflow-hidden bg-[#ebf1f4] text-slate-800">
      <div className="flex h-screen flex-col overflow-hidden">
        <header className="z-20 flex h-[60px] shrink-0 items-center justify-between bg-[#1A1C32] px-5 text-white shadow-sm">
          <div className="flex items-center gap-6">
            <button type="button" aria-label={showRail ? "Recolher menu lateral" : "Expandir menu lateral"} title={showRail ? "Recolher menu lateral" : "Expandir menu lateral"} onClick={() => setShowRail((current) => !current)} className="text-white/90 transition hover:text-white">
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
                {currentUser.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt={`Avatar de ${currentUser.name}`} className="h-full w-full object-cover" />
                ) : (
                  initials(currentUser.name) || "CF"
                )}
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

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <aside className={`hidden h-full shrink-0 border-r border-slate-200 bg-white transition-[width] duration-200 md:flex md:flex-col md:justify-between md:py-4 ${showRail ? "w-[220px]" : "w-14"}`}>
            <div className="flex w-full flex-col gap-1 px-2">
              {currentUser.permissions["dashboard.view"] ? <RailButton icon={LayoutGrid} label="Painel geral" expanded={showRail} active={activeWorkspace === "dashboard"} onClick={() => setActiveWorkspace("dashboard")} /> : null}
              {currentUser.permissions["tickets.view"] ? <RailButton icon={WhatsAppIcon} label="Atendimento" expanded={showRail} active={activeWorkspace === "tickets"} onClick={() => setActiveWorkspace("tickets")} /> : null}
              {currentUser.permissions["quickReplies.view"] ? <RailButton icon={Zap} label="Respostas rápidas" expanded={showRail} active={activeWorkspace === "quickReplies"} onClick={() => setActiveWorkspace("quickReplies")} /> : null}
              {currentUser.permissions["api.view"] ? <RailButton icon={Code2} label="API" expanded={showRail} active={activeWorkspace === "api"} onClick={() => setActiveWorkspace("api")} /> : null}
              {currentUser.permissions["contacts.view"] ? <RailButton icon={Users} label="Contatos" expanded={showRail} active={activeWorkspace === "contacts"} onClick={() => setActiveWorkspace("contacts")} /> : null}
              {currentUser.permissions["activity.view"] ? <RailButton icon={Activity} label="Atividade operacional" expanded={showRail} active={activeWorkspace === "activity"} onClick={() => setActiveWorkspace("activity")} /> : null}
              {currentUser.permissions["calendar.view"] ? <RailButton icon={Calendar} label="Agendamentos" expanded={showRail} active={activeWorkspace === "calendar"} onClick={() => setActiveWorkspace("calendar")} /> : null}
              {currentUser.permissions["automations.view"] ? <RailButton icon={Workflow} label="Automações" expanded={showRail} active={activeWorkspace === "automations"} onClick={() => setActiveWorkspace("automations")} /> : null}
            </div>
            <div className="flex w-full flex-col gap-1 px-2">
              {currentUser.permissions["settings.view"] ? <RailButton icon={Settings} label="Configurações" expanded={showRail} active={activeWorkspace === "settings"} onClick={() => setActiveWorkspace("settings")} /> : null}
            </div>
          </aside>

          <section className={`grid min-h-0 min-w-0 flex-1 overflow-hidden ${ticketWorkspaceAtivo ? "xl:grid-cols-[400px_minmax(0,1fr)]" : "xl:grid-cols-[minmax(0,1fr)]"}`}>
            {ticketWorkspaceAtivo ? (
              <div className="flex h-full min-w-0 flex-col border-r border-slate-200 bg-white">
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
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 rounded-[16px] border border-slate-200 bg-slate-50 p-1">
                      <SidebarIconButton icon={Eye} label="Limpar filtros e voltar à caixa de entrada" active={!showOnlyUnread && !showOnlyMine && selectedQueueFilter === "all"} onClick={() => { setShowOnlyUnread(false); setShowOnlyMine(false); setSelectedQueueFilter("all"); setSearchQuery(""); setActiveWorkspace("tickets"); }} />
                      {canStartConversation ? <SidebarIconButton icon={Plus} label="Iniciar nova conversa" active={false} onClick={openCreateConversationModal} /> : null}
                      <SidebarIconButton icon={CheckSquare} label="Mostrar apenas meus atendimentos" active={showOnlyMine} onClick={() => setShowOnlyMine((current) => !current)} />
                      <SidebarIconButton icon={EyeOff} label="Mostrar apenas não lidos" active={showOnlyUnread} onClick={() => setShowOnlyUnread((current) => !current)} />
                    </div>
                    <div className="relative min-w-0 max-w-full">
                      <select
                        aria-label="Filtrar atendimentos por fila"
                        value={selectedQueueFilter}
                        onChange={(event) => setSelectedQueueFilter(event.target.value)}
                        className="h-10 max-w-full appearance-none rounded-[16px] border border-slate-300 bg-white pl-3 pr-9 text-[11px] text-slate-600 outline-none transition hover:bg-slate-50"
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
                  <div className={`grid items-center gap-2 ${canViewGroups ? "grid-cols-3" : "grid-cols-2"}`}>
                  <StatusTab label="ATENDENDO" count={counters.atendendo} active={activeTab === "atendendo"} onClick={() => { setActiveWorkspace("tickets"); setActiveTab("atendendo"); }} icon={<MessageSquare className="h-3 w-3" />} color="bg-red-500" />
                  <StatusTab label="AGUARDANDO" count={counters.aguardando} active={activeTab === "aguardando"} onClick={() => { setActiveWorkspace("tickets"); setActiveTab("aguardando"); }} icon={<Clock className="h-3 w-3" />} color="bg-amber-500" />
                  {canViewGroups ? <StatusTab label="GRUPOS" count={counters.grupos} active={activeTab === "grupos"} onClick={() => { setActiveWorkspace("tickets"); setActiveTab("grupos"); }} icon={<Users className="h-3 w-3" />} color="bg-blue-500" /> : null}
                  </div>
                </div>

                <div className="scrollbar-hide flex-1 min-w-0 overflow-y-auto bg-white px-2 py-2">
                  {visibleTickets.length === 0 ? (
                    <div className="p-10 text-center text-xs font-medium text-slate-400">Nenhum atendimento nesta categoria.</div>
                  ) : (
                    visibleTickets.map((ticket) => {
                      const selected = ticket.id === selectedTicketId;
                      const compact = ticketDensity === "compact";
                      return (
                        <button
                          key={ticket.id}
                          type="button"
                          onClick={() => { setSelectedTicketId(ticket.id); setActiveWorkspace("tickets"); setShowTicketDetails(false); }}
                          className={`group relative mb-1.5 flex w-full min-w-0 items-start gap-2.5 rounded-[18px] border text-left transition ${selected ? "border-slate-300 bg-slate-50 shadow-sm" : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50"} ${compact ? "p-2.5" : "p-3"}`}
                        >
                          <div className={compact ? "pt-0.5" : "pt-1"}>
                            <div className={`grid place-items-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-700 ${compact ? "h-11 w-11" : "h-12 w-12"}`}>
                              {ticket.customerAvatarUrl ? (
                                <img src={ticket.customerAvatarUrl} alt={`Foto de ${ticket.customerName}`} className="h-full w-full object-cover" />
                              ) : (
                                initials(ticket.customerName) || "C"
                              )}
                            </div>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <Phone className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                                  <p className={`truncate font-semibold text-slate-800 ${compact ? "text-[13px]" : "text-[14px]"}`}>{ticket.customerName}</p>
                                  {selected ? <span className="rounded-full bg-[#1A1C32] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white">Ativo</span> : null}
                                </div>
                                <p className={`mt-0.5 truncate font-medium leading-5 text-slate-600 ${compact ? "text-[12px]" : "text-[13px]"}`}>
                                  {ticket.lastMessagePreview ?? "Sem mensagem registrada"}
                                </p>
                                <p className="mt-1 truncate text-[11px] text-slate-400">
                                  {formatPhoneInput(ticket.externalContactId ?? ticket.externalChatId)}
                                </p>
                              </div>
                              <span className="whitespace-nowrap text-[11px] font-medium text-slate-400">{formatHour(ticket.updatedAt)}</span>
                            </div>

                            <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
                              <div className="flex min-w-0 flex-wrap gap-1 overflow-hidden">
                                <MiniBadge className="bg-emerald-500 text-white" text={ticket.whatsappInstance.name || "SEM INSTÂNCIA"} />
                                {ticket.isGroup ? (
                                  <MiniBadge className="bg-blue-600 text-white" text="GRUPO" />
                                ) : (
                                  <>
                                    <MiniBadge className="bg-red-500 text-white" text={ticket.currentQueue?.name ?? "SEM FILA"} />
                                    <MiniBadge className="bg-slate-900 text-white" text={ticket.currentAgent?.name ?? "SEM AGENTE"} />
                                  </>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                {ticket.unreadCount > 0 ? (
                                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-[10px] font-bold text-white shadow-sm">
                                    {ticket.unreadCount}
                                  </span>
                                ) : null}
                                <ArrowRightLeft className="h-4 w-4 text-slate-400 transition group-hover:text-slate-700" />
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

            <section className="flex min-h-0 min-w-0 flex-col overflow-y-auto bg-[linear-gradient(180deg,#edf3f7,#e1eaef)]">
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

      {managementModalContent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8">
          <div className="absolute inset-0" onClick={closeManagementModal} aria-hidden="true" />
          <section className="relative z-10 w-full max-w-3xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_25px_80px_rgba(15,23,42,0.28)]">
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
            {managementModalContent.content}
          </section>
        </div>
      ) : null}
    </main>
  );
}

function FeatureCard(props: { icon: React.ComponentType<{ className?: string }>; title: string; description: string }) {
  const Icon = props.icon;
  return (
    <article className="rounded-[22px] border border-white/12 bg-white/10 p-5 backdrop-blur-sm">
      <Icon className="h-5 w-5 text-emerald-200" />
      <h3 className="mt-4 text-lg font-semibold text-white">{props.title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/72">{props.description}</p>
    </article>
  );
}

function AuthField(props: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block text-sm font-medium text-slate-600">
      {props.label}
      <input
        type={props.type ?? "text"}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white"
      />
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
      className={`grid h-9 w-9 place-items-center rounded-xl border transition ${props.active ? "border-[#1A1C32] bg-white text-[#1A1C32]" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"}`}
    >
      <Icon className="h-3.5 w-3.5" />
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

function MiniBadge(props: { text: string; className: string }) {
  return <span className={`inline-flex max-w-full truncate rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] ${props.className}`}>{props.text}</span>;
}

function AudioMessagePlayer(props: {
  src: string;
}) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [duration, setDuration] = React.useState(0);
  const [currentTime, setCurrentTime] = React.useState(0);

  const waveform = React.useMemo(
    () => [4, 7, 10, 8, 5, 6, 9, 12, 14, 11, 8, 6, 5, 7, 9, 13, 16, 12, 8, 6, 5, 7, 10, 12, 9, 7, 5, 6, 8, 11, 9, 6],
    [],
  );

  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const syncDuration = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const syncTime = () => setCurrentTime(audio.currentTime || 0);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(audio.duration || 0);
    };
    const handlePause = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);

    audio.addEventListener("loadedmetadata", syncDuration);
    audio.addEventListener("loadeddata", syncDuration);
    audio.addEventListener("durationchange", syncDuration);
    audio.addEventListener("canplay", syncDuration);
    audio.addEventListener("timeupdate", syncTime);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("play", handlePlay);

    if (audio.readyState >= 1) {
      syncDuration();
      syncTime();
    }

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", syncDuration);
      audio.removeEventListener("loadeddata", syncDuration);
      audio.removeEventListener("durationchange", syncDuration);
      audio.removeEventListener("canplay", syncDuration);
      audio.removeEventListener("timeupdate", syncTime);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("play", handlePlay);
    };
  }, []);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setIsPlaying(false);
      }
      return;
    }

    audio.pause();
  }

  function handleSeek(event: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const nextTime = Number(event.target.value);
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  return (
    <div
      className="relative overflow-hidden rounded-[24px] border border-[#e8dfd3] bg-white px-3 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.08)]"
    >
      <audio ref={audioRef} preload="metadata" src={props.src}>
        Seu navegador não suporta áudio.
      </audio>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={isPlaying ? "Pausar áudio" : "Reproduzir áudio"}
          onClick={() => void togglePlayback()}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#25d366] text-white shadow-[0_10px_24px_rgba(37,211,102,0.28)] transition hover:scale-[1.02] hover:brightness-105"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="relative">
            <div className="pointer-events-none flex h-8 items-center gap-[3px]">
              {waveform.map((height, index) => (
                <span
                  key={`${props.src}-${index}`}
                  className={`block w-[3px] rounded-full transition-colors ${
                    index / (waveform.length - 1) <= progress ? "bg-[#25d366]" : "bg-slate-300"
                  }`}
                  style={{ height: `${height + 8}px` }}
                />
              ))}
            </div>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(currentTime, duration || 0)}
              onChange={handleSeek}
              aria-label="Progresso do áudio"
              className="absolute inset-0 h-8 w-full cursor-pointer opacity-0"
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>{formatAudioTime(currentTime)}</span>
            <span>{formatAudioTime(duration)}</span>
          </div>
        </div>
      </div>
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

function CompactField(props: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block text-sm font-medium text-slate-600">
      {props.label}
      <input
        type={props.type ?? "text"}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
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





