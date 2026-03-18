"use client";

import * as React from "react";
import { io, type Socket } from "socket.io-client";
import {
  Activity,
  ArrowRightLeft,
  Cable,
  Calendar,
  CheckSquare,
  ChevronDown,
  Clock,
  Code2,
  Database,
  Eye,
  EyeOff,
  Info,
  LayoutGrid,
  LayoutList,
  LogIn,
  Menu,
  MessageSquare,
  Monitor,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Smartphone,
  User,
  UserCog,
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
  createdAt: string;
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

const API_URL = "/api-proxy";
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? null;

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
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

  const [ticketLoading, setTicketLoading] = React.useState(false);
  const [messageLoading, setMessageLoading] = React.useState(false);
  const [sendLoading, setSendLoading] = React.useState(false);
  const [instanceLoading, setInstanceLoading] = React.useState(false);
  const [agentLoading, setAgentLoading] = React.useState(false);
  const [queueLoading, setQueueLoading] = React.useState(false);
  const [assignmentLoading, setAssignmentLoading] = React.useState<string | null>(null);
  const [editingInstanceId, setEditingInstanceId] = React.useState<string | null>(null);
  const [editingAgentId, setEditingAgentId] = React.useState<string | null>(null);
  const [editingQueueId, setEditingQueueId] = React.useState<string | null>(null);

  const [messageInput, setMessageInput] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<"atendendo" | "aguardando" | "grupos">("atendendo");
  const [activeWorkspace, setActiveWorkspace] = React.useState<"dashboard" | "tickets" | "channels" | "team" | "api" | "profile" | "activity" | "calendar" | "automations" | "settings">("tickets");
  const [adminSection, setAdminSection] = React.useState<"instances" | "agents" | "queues">("instances");
  const [showRail, setShowRail] = React.useState(false);
  const [ticketDensity, setTicketDensity] = React.useState<"comfortable" | "compact">("comfortable");
  const [showOnlyUnread, setShowOnlyUnread] = React.useState(false);
  const [showOnlyMine, setShowOnlyMine] = React.useState(false);
  const [showTicketDetails, setShowTicketDetails] = React.useState(false);

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
  });
  const [queueForm, setQueueForm] = React.useState({ name: "", color: "#1A1C32" });
  const socketRef = React.useRef<Socket | null>(null);

  const selectedTicket = React.useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? null,
    [tickets, selectedTicketId],
  );

  const currentUser: AuthUser = user ?? {
    id: "",
    email: "",
    role: "agent",
    name: "",
  };

  const canAcceptSelectedTicket = Boolean(selectedTicket && selectedTicket.status !== "closed" && selectedTicket.currentAgent?.id !== user?.id);
  const canCloseSelectedTicket = Boolean(selectedTicket && selectedTicket.status !== "closed");
  const canSendToSelectedTicket = Boolean(selectedTicket && selectedTicket.status !== "closed");

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
  }, [activeTab, searchQuery, showOnlyMine, showOnlyUnread, tickets, user?.id]);

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
    setShowTicketDetails(false);
  }, [selectedTicketId]);

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

  const refreshMessages = React.useCallback(async (ticketId: string) => {
    if (!user) return;
    setMessageLoading(true);
    try {
      const payload = await apiFetch<{ items: MessageItem[] }>(`/tickets/${ticketId}/messages`, { method: "GET" });
      setMessages(payload.items);
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao carregar mensagens.");
    } finally {
      setMessageLoading(false);
    }
  }, [user]);

  const refreshInstances = React.useCallback(async () => {
    if (!user || user.role !== "admin") return;
    try {
      const payload = await apiFetch<{ items: InstanceItem[] }>("/whatsapp/instances", { method: "GET" });
      setInstances(payload.items);
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao carregar instâncias.");
    }
  }, [user]);

  const refreshAgents = React.useCallback(async () => {
    if (!user || user.role !== "admin") return;
    try {
      const payload = await apiFetch<{ items: AgentItem[] }>("/agents", { method: "GET" });
      setAgents(payload.items);
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao carregar agentes.");
    }
  }, [user]);

  const refreshQueues = React.useCallback(async () => {
    if (!user || user.role !== "admin") return;
    try {
      const payload = await apiFetch<{ items: QueueItem[] }>("/queues", { method: "GET" });
      setQueues(payload.items);
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao carregar filas.");
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
  }, [refreshAgents, refreshInstances, refreshMessages, refreshQueues, refreshTickets, selectedTicketId]);

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
      setSelectedTicketId(null);
      return;
    }

    void refreshTickets();
    if (user.role === "admin") {
      void refreshInstances();
      void refreshAgents();
      void refreshQueues();
    }
  }, [refreshAgents, refreshInstances, refreshQueues, refreshTickets, user]);

  React.useEffect(() => {
    if (!selectedTicketId || !user) {
      setMessages([]);
      return;
    }

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
        void refreshMessages(payload.ticketId);
      }
    };

    socket.on("connect_error", () => {
      setPanelMessage("Conexão em tempo real indisponível. O painel continua funcionando por atualização periódica.");
    });
    socket.on("ticket.updated", refreshForTicket);
    socket.on("ticket.closed", refreshForTicket);
    socket.on("message.created", refreshForTicket);
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
      if (selectedTicketId) {
        void refreshMessages(selectedTicketId);
      }

      if (user.role === "admin") {
        void refreshInstances();
        void refreshAgents();
        void refreshQueues();
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [refreshAgents, refreshInstances, refreshMessages, refreshQueues, refreshTickets, selectedTicketId, user]);

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
    await apiFetch("/auth/logout", { method: "POST" });
      setPanelMessage("Sessão encerrada.");
    await refreshAuth();
  }

  async function handleSendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTicketId || !messageInput.trim()) return;

    setSendLoading(true);
    try {
      await apiFetch(`/tickets/${selectedTicketId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: messageInput.trim() }),
      });
      setMessageInput("");
      await refreshMessages(selectedTicketId);
      await refreshTickets();
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao enviar mensagem.");
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
    setAgentForm({ name: "", email: "", password: "", role: "agent" });
  }

  function resetQueueForm() {
    setEditingQueueId(null);
    setQueueForm({ name: "", color: "#1A1C32" });
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
    setActiveWorkspace("channels");
  }

  function startEditAgent(agent: AgentItem) {
    setEditingAgentId(agent.id);
    setAgentForm({
      name: agent.name,
      email: agent.email,
      password: "",
      role: agent.role,
    });
    setActiveWorkspace("team");
    setAdminSection("agents");
  }

  function startEditQueue(queue: QueueItem) {
    setEditingQueueId(queue.id);
    setQueueForm({
      name: queue.name,
      color: queue.color ?? "#1A1C32",
    });
    setActiveWorkspace("team");
    setAdminSection("queues");
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
        body: JSON.stringify({ ...agentForm, queueIds: [] }),
      });
      resetAgentForm();
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
      setPanelMessage(editingQueueId ? "Fila atualizada." : "Fila criada.");
      await refreshQueues();
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao criar fila.");
    } finally {
      setQueueLoading(false);
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
          : activeWorkspace === "team"
            ? "Equipe e filas"
            : activeWorkspace === "api"
              ? "API"
            : activeWorkspace === "profile"
              ? "Perfil"
              : activeWorkspace === "activity"
                ? "Atividade operacional"
                : activeWorkspace === "calendar"
                  ? "Agenda operacional"
                  : activeWorkspace === "automations"
                    ? "Automações"
                    : "Configurações";

  const workspaceDescription =
    activeWorkspace === "dashboard"
      ? "Resumo rápido do que está acontecendo no atendimento."
      : activeWorkspace === "tickets"
        ? "Caixa de entrada de conversas com a operação em tempo real."
        : activeWorkspace === "channels"
          ? "Instâncias Evolution e orientações de conexão."
          : activeWorkspace === "team"
            ? "Gestão de agentes e distribuição por filas."
            : activeWorkspace === "api"
              ? "Endpoints, autenticação e testes rápidos da API própria."
            : activeWorkspace === "profile"
              ? "Dados da sessão e atalhos pessoais."
              : activeWorkspace === "activity"
                ? "Leitura operacional do volume e das pendências."
                : activeWorkspace === "calendar"
                  ? "Passos operacionais e rotinas de acompanhamento."
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
              actionLabel={currentUser.role === "admin" ? "Nova conexão" : undefined}
              onActionClick={currentUser.role === "admin" ? resetInstanceForm : undefined}
              actionIcon={Plus}
            />

            {currentUser.role === "admin" ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-4 text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">Cadastro rápido</div>
                <form onSubmit={handleCreateInstance} className="grid gap-3 xl:grid-cols-[1.1fr_1.1fr_1.2fr_1fr_1fr_auto] xl:items-end">
                  <CompactField label="Nome interno" value={instanceForm.name} onChange={(value) => setInstanceForm((current) => ({ ...current, name: value }))} />
                  <CompactField label="Nome na Evolution" value={instanceForm.evolutionInstanceName} onChange={(value) => setInstanceForm((current) => ({ ...current, evolutionInstanceName: value }))} />
                  <CompactField label="URL base" value={instanceForm.baseUrl} onChange={(value) => setInstanceForm((current) => ({ ...current, baseUrl: value }))} placeholder="https://evolution.seudominio.com" />
                  <CompactField label="Chave da API" value={instanceForm.apiKey} onChange={(value) => setInstanceForm((current) => ({ ...current, apiKey: value }))} />
                  <CompactField label="Segredo do webhook" value={instanceForm.webhookSecret} onChange={(value) => setInstanceForm((current) => ({ ...current, webhookSecret: value }))} placeholder="Opcional" />
                  <div className="xl:w-[180px]">
                    <PrimaryAction disabled={instanceLoading}>{instanceLoading ? "Salvando..." : editingInstanceId ? "Salvar edição" : "Adicionar"}</PrimaryAction>
                  </div>
                </form>
                {editingInstanceId ? (
                  <button type="button" onClick={resetInstanceForm} className="mt-3 text-sm font-medium text-slate-500 transition hover:text-slate-800">
                    Cancelar edição
                  </button>
                ) : null}
              </div>
            ) : null}

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
                      {currentUser.role === "admin" ? (
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
              <InfoRow title="Webhook sugerido" subtitle="Endpoint público para eventos da Evolution" meta="https://chatflow-api.qqruew.easypanel.host/api/webhooks/evolution" />
              <InfoRow title="Frontend publicado" subtitle="URL operacional do painel" meta="https://chatflow-web.qqruew.easypanel.host" />
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
                actionLabel={currentUser.role === "admin" ? "Adicionar usuário" : undefined}
                onActionClick={currentUser.role === "admin" ? resetAgentForm : undefined}
                actionIcon={UserPlus}
              />

              {currentUser.role === "admin" ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <form onSubmit={handleCreateAgent} className="grid gap-3 xl:grid-cols-[1.1fr_1.2fr_1fr_220px_auto] xl:items-end">
                    <CompactField label="Nome" value={agentForm.name} onChange={(value) => setAgentForm((current) => ({ ...current, name: value }))} />
                    <CompactField label="E-mail" value={agentForm.email} onChange={(value) => setAgentForm((current) => ({ ...current, email: value }))} />
                    <CompactField label="Senha" type="password" value={agentForm.password} onChange={(value) => setAgentForm((current) => ({ ...current, password: value }))} />
                    <label className="block text-sm font-medium text-slate-600">
                      Perfil
                      <select value={agentForm.role} onChange={(event) => setAgentForm((current) => ({ ...current, role: event.target.value as "admin" | "agent" }))} className="mt-2 h-11 w-full rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none">
                        <option value="agent">Agente</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </label>
                    <div className="xl:w-[180px]">
                      <PrimaryAction disabled={agentLoading}>{agentLoading ? "Salvando..." : editingAgentId ? "Salvar edição" : "Adicionar"}</PrimaryAction>
                    </div>
                  </form>
                  {editingAgentId ? (
                    <button type="button" onClick={resetAgentForm} className="mt-3 text-sm font-medium text-slate-500 transition hover:text-slate-800">
                      Cancelar edição
                    </button>
                  ) : null}
                </div>
              ) : null}

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
                        {currentUser.role === "admin" ? (
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
                actionLabel={currentUser.role === "admin" ? "Adicionar fila" : undefined}
                onActionClick={currentUser.role === "admin" ? resetQueueForm : undefined}
                actionIcon={Workflow}
              />

              {currentUser.role === "admin" ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <form onSubmit={handleCreateQueue} className="grid gap-3 xl:grid-cols-[1fr_220px_auto] xl:items-end">
                    <CompactField label="Nome da fila" value={queueForm.name} onChange={(value) => setQueueForm((current) => ({ ...current, name: value }))} />
                    <CompactField label="Cor" value={queueForm.color} onChange={(value) => setQueueForm((current) => ({ ...current, color: value }))} placeholder="#1A1C32" />
                    <div className="xl:w-[180px]">
                      <PrimaryAction disabled={queueLoading}>{queueLoading ? "Salvando..." : editingQueueId ? "Salvar edição" : "Adicionar"}</PrimaryAction>
                    </div>
                  </form>
                  {editingQueueId ? (
                    <button type="button" onClick={resetQueueForm} className="mt-3 text-sm font-medium text-slate-500 transition hover:text-slate-800">
                      Cancelar edição
                    </button>
                  ) : null}
                </div>
              ) : null}

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
                        {currentUser.role === "admin" ? (
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
                  <QueueEditor key={queue.id} queue={queue} agents={agents} loading={assignmentLoading === queue.id} onSave={handleAssignQueueAgents} onChange={setQueues} />
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
                <DataCell subtle>https://chatflow-api.qqruew.easypanel.host</DataCell>
              </DataRow>
              <DataRow>
                <DataCell>Webhook Evolution</DataCell>
                <DataCell subtle>https://chatflow-api.qqruew.easypanel.host/api/webhooks/evolution</DataCell>
              </DataRow>
              <DataRow>
                <DataCell>Frontend publicado</DataCell>
                <DataCell subtle>https://chatflow-web.qqruew.easypanel.host</DataCell>
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

    if (activeWorkspace === "profile") {
      return (
        <div className="flex h-full flex-col gap-4 p-6">
          <WorkspaceSection title="Meu perfil" description="Informações da sessão atual e atalhos pessoais.">
            <div className="grid gap-4">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="grid h-20 w-20 place-items-center rounded-full bg-[#1A1C32] text-2xl font-bold text-white">{initials(currentUser.name) || "CF"}</div>
                <div className="mt-4 text-xl font-semibold text-slate-900">{currentUser.name}</div>
                <div className="mt-1 text-sm text-slate-500">{currentUser.email}</div>
                <div className="mt-4 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-600">{traduzirPerfil(currentUser.role)}</div>
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
          <WorkspaceSection title="Rotina operacional" description="Checklist simples para o uso interno do sistema.">
            <DataTable columns={["Etapa", "Objetivo", "Checklist"]} emptyMessage="Nenhuma rotina cadastrada.">
              <DataRow>
                <DataCell>Início do turno</DataCell>
                <DataCell subtle>Conferir login, socket e instâncias</DataCell>
                <DataCell subtle>1. abrir painel | 2. validar saúde da API | 3. conferir instâncias</DataCell>
              </DataRow>
              <DataRow>
                <DataCell>Durante o atendimento</DataCell>
                <DataCell subtle>Monitorar aguardando e não lidos</DataCell>
                <DataCell subtle>1. assumir tickets | 2. responder | 3. encerrar quando concluir</DataCell>
              </DataRow>
              <DataRow>
                <DataCell>Evolution</DataCell>
                <DataCell subtle>Validar webhook e telefone vinculado</DataCell>
                <DataCell subtle>URL pública + segredo opcional</DataCell>
              </DataRow>
              <DataRow>
                <DataCell>Encerramento</DataCell>
                <DataCell subtle>Revisar tickets fechados e pendentes</DataCell>
                <DataCell subtle>Registrar ajustes ou incidentes</DataCell>
              </DataRow>
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
          <div className="flex flex-wrap gap-2">
            <AdminTab label="Instâncias" active={adminSection === "instances"} onClick={() => setAdminSection("instances")} />
            <AdminTab label="Agentes" active={adminSection === "agents"} onClick={() => setAdminSection("agents")} />
            <AdminTab label="Filas" active={adminSection === "queues"} onClick={() => setAdminSection("queues")} />
          </div>

          <WorkspaceSection title="Central administrativa" description="Módulo dedicado para configuração operacional e manutenção do ambiente.">
            <DataTable columns={["Área", "Resumo", "Detalhe"]} emptyMessage="Sem dados administrativos.">
              {adminSection === "instances"
                ? filteredInstances.map((instance) => (
                    <DataRow key={instance.id}>
                      <DataCell>{instance.name}</DataCell>
                      <DataCell subtle>{instance.evolutionInstanceName}</DataCell>
                      <DataCell subtle>{`${traduzirStatusInstancia(instance.status)} | ${instance.phoneNumber ?? "Sem telefone"}`}</DataCell>
                    </DataRow>
                  ))
                : adminSection === "agents"
                  ? filteredAgents.map((agent) => (
                      <DataRow key={agent.id}>
                        <DataCell>{agent.name}</DataCell>
                        <DataCell subtle>{agent.email}</DataCell>
                        <DataCell subtle>{`${traduzirPerfil(agent.role)} | ${agent.queues.map((queue) => queue.name).join(", ") || "Sem filas"}`}</DataCell>
                      </DataRow>
                    ))
                  : filteredQueues.map((queue) => (
                      <DataRow key={queue.id}>
                        <DataCell>{queue.name}</DataCell>
                        <DataCell subtle>{`${queue.agents.length} agente(s)`}</DataCell>
                        <DataCell subtle>{`${queue.openTicketCount} ticket(s) abertos | ${queue.color ?? "#1A1C32"}`}</DataCell>
                      </DataRow>
                    ))}
            </DataTable>

            <DataTable columns={["Ação", "Destino"]} emptyMessage="Sem atalhos disponíveis.">
              <DataRow>
                <DataCell>Gerenciar instâncias</DataCell>
                <DataCell subtle>Abrir canais e revisar Evolution</DataCell>
              </DataRow>
              <DataRow>
                <DataCell>Gerenciar equipe</DataCell>
                <DataCell subtle>Abrir agentes e filas</DataCell>
              </DataRow>
              <DataRow>
                <DataCell>API publicada</DataCell>
                <DataCell subtle>chatflow-api.qqruew.easypanel.host</DataCell>
              </DataRow>
              <DataRow>
                <DataCell>Frontend publicado</DataCell>
                <DataCell subtle>chatflow-web.qqruew.easypanel.host</DataCell>
              </DataRow>
            </DataTable>
          </WorkspaceSection>
        </div>
      );
    }

    return (
      <>
        {selectedTicket ? (
          <>
            <div className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full border bg-slate-100 text-sm font-semibold text-slate-700">
                  {initials(selectedTicket.customerName) || "C"}
                </div>
                <div>
                  <h3 className="text-sm font-semibold uppercase leading-none text-[#1A1C32]">{selectedTicket.customerName}</h3>
                  <span className="text-[10px] font-bold uppercase text-[#1A9C68]">
                    {selectedTicket.currentAgent?.name ?? (selectedTicket.isGroup ? "Conversa de grupo" : "Aguardando atendente")}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button type="button" aria-label="Assumir atendimento selecionado" title="Assumir atendimento" onClick={() => void handleAcceptTicket()} disabled={!canAcceptSelectedTicket} className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-bold uppercase text-white shadow-sm transition disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 bg-green-600 hover:bg-green-700">
                  <CheckSquare className="h-4 w-4" />
                  {selectedTicket.currentAgent?.id === currentUser.id ? "Em atendimento" : selectedTicket.status === "closed" ? "Atendimento fechado" : "Aceitar atendimento"}
                </button>
                <button type="button" aria-label="Fechar atendimento selecionado" title="Fechar atendimento" onClick={() => void handleCloseTicket()} disabled={!canCloseSelectedTicket} className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-red-500 transition hover:text-red-600 disabled:cursor-not-allowed disabled:text-slate-400">
                  <X className="h-3.5 w-3.5" />
                  {selectedTicket.status === "closed" ? "Fechado" : "Fechar"}
                </button>
                <button type="button" aria-label={showTicketDetails ? "Ocultar detalhes do atendimento" : "Mostrar detalhes do atendimento"} title={showTicketDetails ? "Ocultar detalhes" : "Mostrar detalhes"} onClick={() => setShowTicketDetails((current) => !current)} className="text-slate-400 transition hover:text-slate-600">
                  <Info className="h-4 w-4" />
                </button>
              </div>
            </div>

            {showTicketDetails ? (
              <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <InfoRow title="Status" subtitle={traduzirStatusTicket(selectedTicket.status)} meta={`não lidos: ${selectedTicket.unreadCount}`} />
                  <InfoRow title="Fila" subtitle={selectedTicket.currentQueue?.name ?? "Sem fila"} meta={selectedTicket.isGroup ? "conversa em grupo" : "conversa individual"} />
                  <InfoRow title="Responsável" subtitle={selectedTicket.currentAgent?.name ?? "Sem agente"} meta={selectedTicket.externalChatId} />
                  <InfoRow title="Canal" subtitle={selectedTicket.whatsappInstance.name} meta={formatDateTime(selectedTicket.updatedAt)} />
                </div>
              </div>
            ) : null}

            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="scrollbar-hide flex-1 overflow-y-auto px-6 py-6">
                <div className="mx-auto flex max-w-4xl flex-col gap-4">
                  {messageLoading ? (
                    <div className="text-center text-sm text-slate-500">Carregando mensagens...</div>
                  ) : messages.length === 0 ? (
                    <EmptyMessages />
                  ) : (
                    messages.map((message) => {
                      const outgoing = message.direction === "outbound";
                      const system = message.direction === "system";

                      if (system) {
                        return (
                          <div key={message.id} className="self-center rounded-full bg-slate-200 px-4 py-2 text-[11px] font-bold uppercase text-slate-500">
                            {message.body ?? "Evento interno"}
                          </div>
                        );
                      }

                      return (
                        <div key={message.id} className={`flex flex-col ${outgoing ? "items-end" : "items-start"}`}>
                          <article className={`max-w-[80%] rounded-2xl p-3 text-sm shadow-sm ${outgoing ? "border border-[#C6E9AD] bg-[#DCF8C6] text-slate-800" : "rounded-tl-none border border-slate-200 bg-white text-slate-800"}`}>
                            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-400">
                              {message.senderName ?? (outgoing ? currentUser.name : selectedTicket.customerName)}
                            </div>
                            <div className="whitespace-pre-wrap text-sm leading-6">{message.body ?? `[${message.contentType}]`}</div>
                            <div className="mt-2 text-right text-[10px] text-slate-400">{formatDateTime(message.createdAt)}</div>
                          </article>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <form onSubmit={handleSendMessage} className="border-t border-slate-200 bg-white px-6 py-4">
                <div className="flex items-center gap-3">
                  <textarea
                    value={messageInput}
                    onChange={(event) => setMessageInput(event.target.value)}
                    rows={2}
                    placeholder={canSendToSelectedTicket ? "Digite uma mensagem" : "Ticket fechado para envio"}
                    disabled={!canSendToSelectedTicket}
                    className="min-h-[52px] flex-1 resize-none rounded-full border border-slate-200 bg-slate-50 px-5 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  />
                  <button
                    type="submit"
                    aria-label="Enviar mensagem"
                    disabled={sendLoading || !messageInput.trim() || !canSendToSelectedTicket}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#1A1C32] px-5 text-sm font-bold uppercase text-white transition hover:bg-[#111426] disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <Send className="h-4 w-4" />
                    {sendLoading ? "Enviando" : "Enviar"}
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <EmptyCenter />
        )}
      </>
    );
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
    <main className="min-h-screen bg-[#ebf1f4] text-slate-800">
      <div className="flex min-h-screen flex-col">
        <header className="flex h-[60px] items-center justify-between bg-[#1A1C32] px-5 text-white shadow-sm">
          <div className="flex items-center gap-6">
            <button type="button" aria-label={showRail ? "Recolher menu lateral" : "Expandir menu lateral"} title={showRail ? "Recolher menu lateral" : "Expandir menu lateral"} onClick={() => setShowRail((current) => !current)} className="text-white/90 transition hover:text-white">
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-white/10">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div>
                <div className="text-[18px] font-semibold tracking-tight">CHATFLOW</div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">{workspaceTitle}</div>
              </div>
            </div>
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
            <button type="button" aria-label="Abrir perfil" title="Abrir perfil" onClick={() => setActiveWorkspace("profile")} className="grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-white/10 bg-white/10 text-sm font-semibold uppercase transition hover:bg-white/15">
              {initials(currentUser.name) || "CF"}
            </button>
          </div>
        </header>

        <div className="flex min-h-[calc(100vh-60px)]">
          <aside className={`hidden shrink-0 border-r border-slate-200 bg-white transition-[width] duration-200 md:flex md:flex-col md:justify-between md:py-4 ${showRail ? "w-[220px]" : "w-14"}`}>
            <div className="flex w-full flex-col gap-1 px-2">
              <RailButton icon={LayoutGrid} label="Painel geral" expanded={showRail} active={activeWorkspace === "dashboard"} onClick={() => setActiveWorkspace("dashboard")} />
              <RailButton icon={Phone} label="Atendimento" expanded={showRail} active={activeWorkspace === "tickets"} onClick={() => setActiveWorkspace("tickets")} />
              <RailButton icon={Cable} label="Canais e instâncias" expanded={showRail} active={activeWorkspace === "channels"} onClick={() => { setActiveWorkspace("channels"); setAdminSection("instances"); }} />
              <RailButton icon={UserCog} label="Equipe e filas" expanded={showRail} active={activeWorkspace === "team"} onClick={() => { setActiveWorkspace("team"); setAdminSection("agents"); }} />
              <RailButton icon={Code2} label="API" expanded={showRail} active={activeWorkspace === "api"} onClick={() => setActiveWorkspace("api")} />
              <RailButton icon={User} label="Perfil" expanded={showRail} active={activeWorkspace === "profile"} onClick={() => setActiveWorkspace("profile")} />
              <RailButton icon={Activity} label="Atividade operacional" expanded={showRail} active={activeWorkspace === "activity"} onClick={() => setActiveWorkspace("activity")} />
              <RailButton icon={Calendar} label="Agenda operacional" expanded={showRail} active={activeWorkspace === "calendar"} onClick={() => setActiveWorkspace("calendar")} />
              <RailButton icon={Workflow} label="Automações" expanded={showRail} active={activeWorkspace === "automations"} onClick={() => setActiveWorkspace("automations")} />
            </div>
            <div className="flex w-full flex-col gap-1 px-2">
              <RailButton icon={Settings} label="Configurações" expanded={showRail} active={activeWorkspace === "settings"} onClick={() => setActiveWorkspace("settings")} />
              <button
                type="button"
                aria-label="Encerrar sessão"
                title="Encerrar sessão"
                onClick={() => void handleLogout()}
                className={`flex items-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-slate-700 ${showRail ? "gap-3 px-3 py-2.5" : "h-10 w-10 justify-center self-center"}`}
              >
                <LogIn className="h-5 w-5 rotate-180" />
                {showRail ? <span className="text-sm font-medium text-slate-600">Sair</span> : null}
              </button>
            </div>
          </aside>

          <section className={`grid min-w-0 flex-1 ${ticketWorkspaceAtivo ? "xl:grid-cols-[380px_minmax(0,1fr)]" : "xl:grid-cols-[minmax(0,1fr)]"}`}>
            {ticketWorkspaceAtivo ? (
              <div className="flex h-full flex-col border-r border-slate-200 bg-white">
                <div className="space-y-3 border-b border-slate-200 p-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{workspaceTitle}</div>
                    <div className="mt-1 text-sm text-slate-500">{workspaceDescription}</div>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      aria-label="Buscar atendimentos"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Buscar atendimento e mensagens"
                      className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50/60 p-1">
                      <SidebarIconButton icon={Eye} label="Limpar filtros e voltar à caixa de entrada" active={!showOnlyUnread && !showOnlyMine} onClick={() => { setShowOnlyUnread(false); setShowOnlyMine(false); setSearchQuery(""); setActiveWorkspace("tickets"); }} />
                      <SidebarIconButton icon={Plus} label="Abrir canais e instâncias" active={false} onClick={() => { setActiveWorkspace(currentUser.role === "admin" ? "channels" : "tickets"); if (currentUser.role === "admin") setAdminSection("instances"); }} />
                      <SidebarIconButton icon={LayoutList} label="Usar lista compacta" active={ticketDensity === "compact"} onClick={() => setTicketDensity("compact")} />
                      <SidebarIconButton icon={Monitor} label="Usar lista confortável" active={ticketDensity === "comfortable"} onClick={() => setTicketDensity("comfortable")} />
                      <SidebarIconButton icon={CheckSquare} label="Mostrar apenas meus atendimentos" active={showOnlyMine} onClick={() => setShowOnlyMine((current) => !current)} />
                      <SidebarIconButton icon={EyeOff} label="Mostrar apenas não lidos" active={showOnlyUnread} onClick={() => setShowOnlyUnread((current) => !current)} />
                    </div>
                    <button type="button" aria-label="Abrir gestão de filas" title="Abrir gestão de filas" onClick={() => { setActiveWorkspace("team"); setAdminSection("queues"); }} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-500 transition hover:bg-slate-100">
                      Filas
                      <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center border-b border-slate-200 px-2">
                  <StatusTab label="ATENDENDO" count={counters.atendendo} active={activeTab === "atendendo"} onClick={() => { setActiveWorkspace("tickets"); setActiveTab("atendendo"); }} icon={<MessageSquare className="h-3 w-3" />} color="bg-red-500" />
                  <StatusTab label="AGUARDANDO" count={counters.aguardando} active={activeTab === "aguardando"} onClick={() => { setActiveWorkspace("tickets"); setActiveTab("aguardando"); }} icon={<Clock className="h-3 w-3" />} color="bg-amber-500" />
                  <StatusTab label="GRUPOS" count={counters.grupos} active={activeTab === "grupos"} onClick={() => { setActiveWorkspace("tickets"); setActiveTab("grupos"); }} icon={<Users className="h-3 w-3" />} color="bg-blue-500" />
                </div>

                <div className="scrollbar-hide flex-1 overflow-y-auto bg-slate-50/30">
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
                          className={`group relative flex w-full items-start gap-3 border-b border-slate-200 text-left transition ${selected ? "bg-white shadow-[inset_4px_0_0_0_#1A1C32]" : "bg-white/50 hover:bg-slate-100"} ${compact ? "p-2.5" : "p-3"}`}
                        >
                          <div className={compact ? "pt-0.5" : "pt-1"}>
                            <div className={`grid place-items-center rounded-full border bg-[linear-gradient(135deg,#dbe6ef,#bfcbd8)] text-sm font-semibold text-slate-700 shadow-sm ${compact ? "h-10 w-10" : "h-12 w-12"}`}>
                              {initials(ticket.customerName) || "C"}
                            </div>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <Phone className="h-3.5 w-3.5 shrink-0 text-green-500" />
                                  <p className={`truncate font-bold text-slate-800 ${compact ? "text-[13px]" : "text-[14px]"}`}>{ticket.customerName}</p>
                                  <Eye className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                                </div>
                                <p className={`mt-0.5 truncate font-bold text-slate-900 ${compact ? "text-[12px]" : "text-[13px]"}`}>
                                  {ticket.lastMessagePreview ?? "Sem mensagem registrada"}
                                </p>
                              </div>
                              <span className="whitespace-nowrap text-[11px] font-bold text-green-700">{formatHour(ticket.updatedAt)}</span>
                            </div>

                            <div className="mt-2 flex items-center justify-between gap-2">
                              <div className="flex flex-wrap gap-1">
                                <MiniBadge className="bg-[#00e676] text-white" text={ticket.externalChatId || "SEM INSTÂNCIA"} />
                                {ticket.isGroup ? (
                                  <MiniBadge className="bg-blue-600 text-white" text="GRUPO" />
                                ) : (
                                  <>
                                    <MiniBadge className="bg-red-600 text-white" text={ticket.currentQueue?.name ?? "SEM FILA"} />
                                    <MiniBadge className="bg-black text-white" text={ticket.currentAgent?.name ?? "SEM AGENTE"} />
                                  </>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                {ticket.unreadCount > 0 ? (
                                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-[10px] font-bold text-white shadow-sm">
                                    {ticket.unreadCount}
                                  </span>
                                ) : null}
                                <ArrowRightLeft className="h-4 w-4 text-blue-500 transition group-hover:text-blue-700" />
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

            <section className="flex min-w-0 flex-col bg-[#ebf1f4]">
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
      className={`rounded p-1 transition ${props.active ? "border bg-white shadow-sm" : "hover:bg-slate-100"}`}
    >
      <Icon className="h-3.5 w-3.5 text-slate-500" />
    </button>
  );
}

function StatusTab(props: { label: string; count: number; active: boolean; onClick: () => void; icon: React.ReactNode; color: string }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`relative flex flex-1 items-center justify-center gap-1.5 py-3 text-[10px] font-bold tracking-tight transition-colors ${props.active ? "text-[#1A1C32]" : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"}`}
    >
      <div className="relative">
        {props.icon}
        {props.count > 0 ? <span className={`absolute -right-2 -top-2 min-w-[14px] rounded-full px-1 text-[8px] text-white ${props.color}`}>{props.count}</span> : null}
      </div>
      {props.label}
      {props.active ? <div className="absolute bottom-0 left-0 h-0.5 w-full bg-[#1A1C32]" /> : null}
    </button>
  );
}

function MiniBadge(props: { text: string; className: string }) {
  return <span className={`rounded-sm px-1 py-0.5 text-[9px] font-bold uppercase ${props.className}`}>{props.text}</span>;
}

function EmptyCenter() {
  return (
    <div className="grid flex-1 place-items-center px-6 py-10 text-center">
      <div>
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-slate-300 text-white">
          <MessageSquare className="h-9 w-9" />
        </div>
        <h3 className="mt-6 text-4xl font-semibold uppercase tracking-[0.12em] text-slate-400">Aguardando seleção</h3>
        <p className="mt-3 text-lg text-slate-400">Escolha um atendimento para começar.</p>
      </div>
    </div>
  );
}

function EmptyMessages() {
  return (
    <div className="grid flex-1 place-items-center px-6 py-10 text-center">
      <div>
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-slate-200 text-slate-500">
          <MessageSquare className="h-9 w-9" />
        </div>
        <h3 className="mt-6 text-3xl font-semibold uppercase tracking-[0.12em] text-slate-400">Sem mensagens ainda</h3>
        <p className="mt-3 text-lg text-slate-400">Este atendimento ainda não possui histórico de conversa.</p>
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

function PrimaryAction(props: { disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={props.disabled}
      className="w-full rounded-2xl bg-[#1A1C32] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#111426] disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      {props.children}
    </button>
  );
}

function InfoRow(props: { title: string; subtitle: string; meta: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="font-semibold text-slate-900">{props.title}</div>
      <div className="mt-1 text-sm text-slate-500">{props.subtitle}</div>
      <div className="mt-2 text-[11px] uppercase tracking-[0.05em] text-slate-400">{props.meta}</div>
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
        disabled={props.loading}
        className="mt-4 w-full rounded-2xl bg-[#1A1C32] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#111426] disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {props.loading ? "Salvando membros..." : "Salvar membros da fila"}
      </button>
    </div>
  );
}





