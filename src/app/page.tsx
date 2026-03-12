"use client";

import * as React from "react";
import { io, type Socket } from "socket.io-client";
import {
  Database,
  LogIn,
  MessageSquareText,
  PlugZap,
  RefreshCw,
  Send,
  ShieldCheck,
  UserPlus,
  Users,
  Workflow,
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

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.message ?? "Request failed");
  }

  return payload as T;
}

function formatDate(value: string) {
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

function cardClassName(extra?: string) {
  return `rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20 backdrop-blur ${extra ?? ""}`;
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

  const [messageInput, setMessageInput] = React.useState("");
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
  const [queueForm, setQueueForm] = React.useState({ name: "", color: "#16a34a" });
  const socketRef = React.useRef<Socket | null>(null);

  const selectedTicket = React.useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? null,
    [tickets, selectedTicketId],
  );

  const refreshAuth = React.useCallback(async () => {
    setLoadingAuth(true);
    try {
      const payload = await apiFetch<AuthResponse>("/auth/me", { method: "GET" });
      setUser(payload.authenticated ? payload.user ?? null : null);
      setAuthError(null);
    } catch (error) {
      setUser(null);
      setAuthError(error instanceof Error ? error.message : "Falha ao consultar sessao.");
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
      setPanelMessage(error instanceof Error ? error.message : "Falha ao carregar instancias.");
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
      setPanelMessage("Conexao realtime indisponivel. O painel continua funcionando por requisicao.");
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
    setPanelMessage("Sessao encerrada.");
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

  async function handleCreateInstance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInstanceLoading(true);
    try {
      await apiFetch("/whatsapp/instances", {
        method: "POST",
        body: JSON.stringify(instanceForm),
      });
      setInstanceForm({
        name: "",
        evolutionInstanceName: "",
        baseUrl: "",
        apiKey: "",
        webhookSecret: "",
      });
      setPanelMessage("Instancia Evolution cadastrada.");
      await refreshInstances();
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "Falha ao salvar instancia.");
    } finally {
      setInstanceLoading(false);
    }
  }

  async function handleCreateAgent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAgentLoading(true);
    try {
      await apiFetch("/agents", {
        method: "POST",
        body: JSON.stringify({ ...agentForm, queueIds: [] }),
      });
      setAgentForm({
        name: "",
        email: "",
        password: "",
        role: "agent",
      });
      setPanelMessage("Agente criado.");
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
      await apiFetch("/queues", {
        method: "POST",
        body: JSON.stringify(queueForm),
      });
      setQueueForm({ name: "", color: "#16a34a" });
      setPanelMessage("Fila criada.");
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

  if (loadingAuth) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(21,128,61,0.24),_transparent_35%),linear-gradient(180deg,#05080d_0%,#0c1724_100%)] px-6 py-10">
        <div className="mx-auto flex min-h-[80vh] max-w-7xl items-center justify-center">
          <div className={cardClassName("flex items-center gap-3 text-sm text-slate-300")}>
            <RefreshCw className="h-4 w-4 animate-spin" />
            Carregando sessao...
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(21,128,61,0.24),_transparent_35%),linear-gradient(180deg,#05080d_0%,#0c1724_100%)] px-6 py-10 text-slate-100">
        <div className="mx-auto grid min-h-[80vh] max-w-6xl gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="flex flex-col justify-between rounded-[32px] border border-emerald-400/20 bg-emerald-400/10 p-8 shadow-2xl shadow-black/30">
            <div className="space-y-5">
              <p className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs uppercase tracking-[0.28em] text-emerald-200">
                <ShieldCheck className="h-4 w-4" />
                ChatFlow interno
              </p>
              <h1 className="max-w-xl text-4xl font-semibold leading-tight text-white sm:text-5xl">
                Painel de atendimento pronto para backend proprio, Evolution e PostgreSQL.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-200/80">
                A base foi reorganizada para deploy em EasyPanel, com autenticacao no servidor, webhook da Evolution e dados operacionais no banco novo.
              </p>
            </div>
            <div className="grid gap-4 pt-8 sm:grid-cols-3">
              <article className={cardClassName("bg-black/10")}>
                <Database className="mb-3 h-5 w-5 text-emerald-300" />
                <h2 className="text-sm font-semibold text-white">PostgreSQL</h2>
                <p className="mt-2 text-sm text-slate-300">Tickets, mensagens, filas, auditoria e usuarios agora vivem no banco principal.</p>
              </article>
              <article className={cardClassName("bg-black/10")}>
                <PlugZap className="mb-3 h-5 w-5 text-emerald-300" />
                <h2 className="text-sm font-semibold text-white">Evolution API</h2>
                <p className="mt-2 text-sm text-slate-300">A integracao segue na VPS, mas agora passa por uma API propria.</p>
              </article>
              <article className={cardClassName("bg-black/10")}>
                <Workflow className="mb-3 h-5 w-5 text-emerald-300" />
                <h2 className="text-sm font-semibold text-white">EasyPanel</h2>
                <p className="mt-2 text-sm text-slate-300">Separacao clara entre web, api e postgres para publicar sem improviso.</p>
              </article>
            </div>
          </section>

          <section className={cardClassName("self-center")}>
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-white">{mode === "login" ? "Entrar no painel" : "Criar administrador inicial"}</h2>
                <p className="mt-1 text-sm text-slate-300">
                  {mode === "login" ? "Use o bootstrap ou um agente criado pelo painel." : "Use esta opcao so na primeira inicializacao do banco."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMode((current) => (current === "login" ? "bootstrap" : "login"))}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-emerald-300/30 hover:text-white"
              >
                {mode === "login" ? "Primeiro acesso" : "Voltar"}
              </button>
            </div>

            {mode === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <Field label="E-mail" value={loginForm.email} onChange={(value) => setLoginForm((current) => ({ ...current, email: value }))} placeholder="admin@chatflow.local" />
                <Field label="Senha" type="password" value={loginForm.password} onChange={(value) => setLoginForm((current) => ({ ...current, password: value }))} placeholder="Sua senha" />
                <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 font-medium text-slate-950 transition hover:bg-emerald-400">
                  <LogIn className="h-4 w-4" />
                  Entrar
                </button>
              </form>
            ) : (
              <form onSubmit={handleBootstrap} className="space-y-4">
                <Field label="Nome" value={bootstrapForm.name} onChange={(value) => setBootstrapForm((current) => ({ ...current, name: value }))} placeholder="Administrador ChatFlow" />
                <Field label="E-mail" value={bootstrapForm.email} onChange={(value) => setBootstrapForm((current) => ({ ...current, email: value }))} placeholder="admin@chatflow.local" />
                <Field label="Senha" type="password" value={bootstrapForm.password} onChange={(value) => setBootstrapForm((current) => ({ ...current, password: value }))} placeholder="Minimo de 8 caracteres" />
                <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 font-medium text-slate-950 transition hover:bg-emerald-400">
                  <ShieldCheck className="h-4 w-4" />
                  Criar administrador
                </button>
              </form>
            )}

            {(authError || panelMessage) && (
              <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
                {authError ?? panelMessage}
              </div>
            )}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(21,128,61,0.24),_transparent_30%),linear-gradient(180deg,#05080d_0%,#0c1724_100%)] px-4 py-4 text-slate-100 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className={cardClassName("overflow-hidden bg-[linear-gradient(135deg,rgba(16,185,129,0.14),rgba(15,23,42,0.5))]")}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-emerald-200/80">ChatFlow control room</p>
              <h1 className="mt-2 text-3xl font-semibold text-white">Operacao interna centralizada no backend novo</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Sessao autenticada, tickets no PostgreSQL, webhook da Evolution persistido pela API e painel pronto para GitHub e EasyPanel.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
                <div className="font-medium text-white">{user.name}</div>
                <div className="text-slate-300">{user.email} · {user.role === "admin" ? "Administrador" : "Agente"}</div>
              </div>
              <button type="button" onClick={() => void refreshAll()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm transition hover:border-emerald-300/30 hover:text-white">
                <RefreshCw className={`h-4 w-4 ${ticketLoading || messageLoading ? "animate-spin" : ""}`} />
                Atualizar
              </button>
              <button type="button" onClick={() => void handleLogout()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm transition hover:bg-white/15">
                <LogIn className="h-4 w-4 rotate-180" />
                Sair
              </button>
            </div>
          </div>
        </header>

        {panelMessage && <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">{panelMessage}</div>}

        <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className={`${cardClassName()} min-h-[520px]`}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-white"><MessageSquareText className="h-5 w-5 text-emerald-300" />Tickets</h2>
                <p className="mt-1 text-sm text-slate-300">{tickets.length} conversa(s) carregada(s)</p>
              </div>
              {ticketLoading && <RefreshCw className="h-4 w-4 animate-spin text-emerald-300" />}
            </div>
            <div className="space-y-3">
              {tickets.length === 0 ? (
                <EmptyState title="Nenhum ticket ainda" description="Quando a Evolution entregar mensagens no webhook, os tickets aparecem aqui." />
              ) : (
                tickets.map((ticket) => {
                  const isSelected = ticket.id === selectedTicketId;
                  return (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => setSelectedTicketId(ticket.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${isSelected ? "border-emerald-300/40 bg-emerald-300/10" : "border-white/10 bg-black/10 hover:border-white/20 hover:bg-white/5"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-white">{ticket.customerName}</div>
                          <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{ticket.status}</div>
                        </div>
                        {ticket.unreadCount > 0 && <span className="rounded-full bg-emerald-400 px-2 py-1 text-xs font-semibold text-slate-950">{ticket.unreadCount}</span>}
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm text-slate-300">{ticket.lastMessagePreview ?? "Sem ultima mensagem registrada."}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                        <span>{ticket.whatsappInstance.name}</span>
                        <span>{ticket.currentAgent?.name ?? "Sem agente"}</span>
                        <span>{ticket.currentQueue?.name ?? "Sem fila"}</span>
                        <span>{formatDate(ticket.updatedAt)}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className={`${cardClassName()} min-h-[520px]`}>
              {selectedTicket ? (
                <>
                  <div className="flex flex-col gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-white">{selectedTicket.customerName}</h2>
                      <p className="mt-1 text-sm text-slate-300">{selectedTicket.externalChatId} · {selectedTicket.whatsappInstance.name}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                        <span>Status: {selectedTicket.status}</span>
                        <span>Agente: {selectedTicket.currentAgent?.name ?? "Nao atribuido"}</span>
                        <span>Fila: {selectedTicket.currentQueue?.name ?? "Nao definida"}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => void handleAcceptTicket()} className="rounded-2xl border border-white/10 px-4 py-2 text-sm transition hover:border-emerald-300/30 hover:text-white">Assumir</button>
                      <button type="button" onClick={() => void handleCloseTicket()} className="rounded-2xl bg-rose-500/20 px-4 py-2 text-sm text-rose-100 transition hover:bg-rose-500/30">Encerrar</button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {messageLoading ? (
                      <div className="flex items-center gap-2 text-sm text-slate-300"><RefreshCw className="h-4 w-4 animate-spin" />Carregando mensagens...</div>
                    ) : messages.length === 0 ? (
                      <EmptyState title="Sem mensagens nesse ticket" description="Assim que o webhook gravar uma mensagem ou voce responder, o historico aparece aqui." />
                    ) : (
                      messages.map((message) => {
                        const outgoing = message.direction === "outbound";
                        return (
                          <article
                            key={message.id}
                            className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm ${outgoing ? "ml-auto bg-emerald-400 text-slate-950" : message.direction === "system" ? "mx-auto bg-white/10 text-slate-200" : "bg-white/8 text-slate-100"}`}
                          >
                            <div className="mb-1 text-xs opacity-75">{message.senderName ?? (outgoing ? "Equipe" : "Cliente")} · {formatDate(message.createdAt)}</div>
                            <div className="leading-6">{message.body ?? `[${message.contentType}]`}</div>
                          </article>
                        );
                      })
                    )}
                  </div>

                  <form onSubmit={handleSendMessage} className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row">
                    <textarea
                      value={messageInput}
                      onChange={(event) => setMessageInput(event.target.value)}
                      placeholder="Digite a resposta para este atendimento..."
                      rows={3}
                      className="min-h-24 flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-emerald-300/40"
                    />
                    <button type="submit" disabled={sendLoading || !messageInput.trim()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 font-medium text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/40">
                      <Send className="h-4 w-4" />
                      {sendLoading ? "Enviando..." : "Enviar"}
                    </button>
                  </form>
                </>
              ) : (
                <EmptyState title="Selecione um ticket" description="Quando houver conversas no sistema, escolha uma delas para visualizar o historico e responder." />
              )}
            </div>

            <aside className="space-y-4">
              <section className={cardClassName()}>
                <h2 className="text-lg font-semibold text-white">Resumo rapido</h2>
                <div className="mt-4 grid gap-3">
                  <MetricCard icon={MessageSquareText} label="Tickets ativos" value={`${tickets.filter((ticket) => ticket.status !== "closed").length}`} />
                  <MetricCard icon={Users} label="Agentes" value={`${agents.length}`} />
                  <MetricCard icon={Workflow} label="Filas" value={`${queues.length}`} />
                  <MetricCard icon={PlugZap} label="Instancias" value={`${instances.length}`} />
                </div>
              </section>

              {user.role === "admin" && (
                <>
                  <section className={cardClassName()}>
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-white"><PlugZap className="h-5 w-5 text-emerald-300" />Instancias Evolution</h2>
                    <form onSubmit={handleCreateInstance} className="mt-4 space-y-3">
                      <Field label="Nome interno" value={instanceForm.name} onChange={(value) => setInstanceForm((current) => ({ ...current, name: value }))} />
                      <Field label="Nome da instancia na Evolution" value={instanceForm.evolutionInstanceName} onChange={(value) => setInstanceForm((current) => ({ ...current, evolutionInstanceName: value }))} />
                      <Field label="Base URL" value={instanceForm.baseUrl} onChange={(value) => setInstanceForm((current) => ({ ...current, baseUrl: value }))} placeholder="https://evolution.suaempresa.com" />
                      <Field label="API key" value={instanceForm.apiKey} onChange={(value) => setInstanceForm((current) => ({ ...current, apiKey: value }))} placeholder="apikey da Evolution" />
                      <Field label="Webhook secret" value={instanceForm.webhookSecret} onChange={(value) => setInstanceForm((current) => ({ ...current, webhookSecret: value }))} placeholder="Opcional" />
                      <button type="submit" disabled={instanceLoading} className="w-full rounded-2xl bg-emerald-500 px-4 py-3 font-medium text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/40">{instanceLoading ? "Salvando..." : "Salvar instancia"}</button>
                    </form>
                    <div className="mt-4 space-y-2">
                      {instances.map((instance) => (
                        <div key={instance.id} className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm">
                          <div className="font-medium text-white">{instance.name}</div>
                          <div className="text-slate-300">{instance.evolutionInstanceName}</div>
                          <div className="mt-1 text-xs text-slate-400">{instance.status} · {instance.phoneNumber ?? "sem telefone"}</div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className={cardClassName()}>
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-white"><UserPlus className="h-5 w-5 text-emerald-300" />Agentes</h2>
                    <form onSubmit={handleCreateAgent} className="mt-4 space-y-3">
                      <Field label="Nome" value={agentForm.name} onChange={(value) => setAgentForm((current) => ({ ...current, name: value }))} />
                      <Field label="E-mail" value={agentForm.email} onChange={(value) => setAgentForm((current) => ({ ...current, email: value }))} />
                      <Field label="Senha" type="password" value={agentForm.password} onChange={(value) => setAgentForm((current) => ({ ...current, password: value }))} />
                      <label className="block text-sm text-slate-300">
                        Perfil
                        <select value={agentForm.role} onChange={(event) => setAgentForm((current) => ({ ...current, role: event.target.value as "admin" | "agent" }))} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-100 outline-none">
                          <option value="agent">Agente</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </label>
                      <button type="submit" disabled={agentLoading} className="w-full rounded-2xl bg-emerald-500 px-4 py-3 font-medium text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/40">{agentLoading ? "Criando..." : "Criar agente"}</button>
                    </form>
                    <div className="mt-4 space-y-2">
                      {agents.map((agent) => (
                        <div key={agent.id} className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm">
                          <div className="font-medium text-white">{agent.name}</div>
                          <div className="text-slate-300">{agent.email}</div>
                          <div className="mt-1 text-xs text-slate-400">{agent.role} · {agent.queues.map((queue) => queue.name).join(", ") || "sem filas"}</div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className={cardClassName()}>
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-white"><Workflow className="h-5 w-5 text-emerald-300" />Filas</h2>
                    <form onSubmit={handleCreateQueue} className="mt-4 space-y-3">
                      <Field label="Nome da fila" value={queueForm.name} onChange={(value) => setQueueForm((current) => ({ ...current, name: value }))} />
                      <Field label="Cor" value={queueForm.color} onChange={(value) => setQueueForm((current) => ({ ...current, color: value }))} placeholder="#16a34a" />
                      <button type="submit" disabled={queueLoading} className="w-full rounded-2xl bg-emerald-500 px-4 py-3 font-medium text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/40">{queueLoading ? "Criando..." : "Criar fila"}</button>
                    </form>
                    <div className="mt-4 space-y-3">
                      {queues.map((queue) => (
                        <QueueEditor key={queue.id} queue={queue} agents={agents} loading={assignmentLoading === queue.id} onChange={setQueues} onSave={handleAssignQueueAgents} />
                      ))}
                    </div>
                  </section>
                </>
              )}
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field(props: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block text-sm text-slate-300">
      {props.label}
      <input
        type={props.type ?? "text"}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-emerald-300/40"
      />
    </label>
  );
}

function EmptyState(props: { title: string; description: string }) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/10 px-6 py-10 text-center">
      <div className="rounded-full border border-white/10 bg-white/5 p-3"><Database className="h-5 w-5 text-emerald-300" /></div>
      <h3 className="mt-4 text-lg font-semibold text-white">{props.title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-300">{props.description}</p>
    </div>
  );
}

function MetricCard(props: { icon: typeof Database; label: string; value: string }) {
  const Icon = props.icon;
  return (
    <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-300">{props.label}</span>
        <Icon className="h-4 w-4 text-emerald-300" />
      </div>
      <div className="mt-3 text-2xl font-semibold text-white">{props.value}</div>
    </div>
  );
}

function QueueEditor(props: {
  queue: QueueItem;
  agents: AgentItem[];
  loading: boolean;
  onSave: (queueId: string, agentIds: string[]) => Promise<void>;
  onChange: React.Dispatch<React.SetStateAction<QueueItem[]>>;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-white">{props.queue.name}</div>
          <div className="mt-1 text-xs text-slate-400">{props.queue.openTicketCount} ticket(s) aberto(s)</div>
        </div>
        <span className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor: props.queue.color ?? "#16a34a" }} />
      </div>
      <div className="mt-4 grid gap-2">
        {props.agents.length === 0 ? (
          <p className="text-xs text-slate-400">Crie agentes para vincular a esta fila.</p>
        ) : (
          props.agents.map((agent) => {
            const selectedIds = props.queue.agents.map((item) => item.id);
            const checked = selectedIds.includes(agent.id);
            return (
              <label key={agent.id} className="flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    const next = event.target.checked ? [...selectedIds, agent.id] : selectedIds.filter((id) => id !== agent.id);
                    props.onChange((current) => current.map((item) => item.id === props.queue.id ? { ...item, agents: props.agents.filter((candidate) => next.includes(candidate.id)).map((candidate) => ({ id: candidate.id, name: candidate.name })) } : item));
                  }}
                  className="h-4 w-4 rounded border-white/20 bg-transparent"
                />
                {agent.name}
              </label>
            );
          })
        )}
      </div>
      <button type="button" onClick={() => void props.onSave(props.queue.id, props.queue.agents.map((agent) => agent.id))} disabled={props.loading} className="mt-4 w-full rounded-2xl border border-white/10 px-4 py-3 font-medium transition hover:border-emerald-300/30 hover:text-white disabled:cursor-not-allowed disabled:border-white/5 disabled:text-slate-500">
        {props.loading ? "Salvando membros..." : "Salvar membros da fila"}
      </button>
    </div>
  );
}

