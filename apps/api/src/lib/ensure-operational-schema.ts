import type { FastifyInstance } from 'fastify';

const operationalStatements = [
  `
    DO $$
    BEGIN
      CREATE TYPE "UserRole" AS ENUM ('admin', 'agent');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `,
  `
    DO $$
    BEGIN
      CREATE TYPE "UserStatus" AS ENUM ('active', 'inactive');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `,
  `
    DO $$
    BEGIN
      CREATE TYPE "AgentPresence" AS ENUM ('online', 'offline', 'busy');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `,
  `
    DO $$
    BEGIN
      CREATE TYPE "TicketStatus" AS ENUM ('open', 'pending', 'closed');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `,
  `
    DO $$
    BEGIN
      CREATE TYPE "MessageDirection" AS ENUM ('inbound', 'outbound', 'system');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `,
  `
    DO $$
    BEGIN
      CREATE TYPE "MessageContentType" AS ENUM ('text', 'image', 'audio', 'video', 'document', 'sticker', 'other');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `,
  `
    DO $$
    BEGIN
      CREATE TYPE "AttachmentStorage" AS ENUM ('local', 's3', 'minio', 'external');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `,
  `
    DO $$
    BEGIN
      CREATE TYPE "InstanceStatus" AS ENUM ('disconnected', 'pairing', 'connected', 'error');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `,
  `
    DO $$
    BEGIN
      CREATE TYPE "TicketEventType" AS ENUM (
        'created',
        'accepted',
        'assigned',
        'transferred',
        'queue_changed',
        'message_in',
        'message_out',
        'closed',
        'reopened',
        'tag_added',
        'tag_removed'
      );
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `,
  `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role "UserRole" NOT NULL DEFAULT 'agent',
      permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
      status "UserStatus" NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMPTZ
    );
  `,
  `
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb;
  `,
  `
    CREATE TABLE IF NOT EXISTS agents (
      id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      avatar_url TEXT,
      presence "AgentPresence" NOT NULL DEFAULT 'offline',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_active_at TIMESTAMPTZ
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS customers (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      phone_e164 TEXT,
      avatar_url TEXT,
      email TEXT,
      company_name TEXT,
      notes TEXT,
      is_name_manually_set BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  `
    ALTER TABLE customers
      ADD COLUMN IF NOT EXISTS avatar_url TEXT;
  `,
  `
    ALTER TABLE customers
      ADD COLUMN IF NOT EXISTS is_name_manually_set BOOLEAN NOT NULL DEFAULT FALSE;
  `,
  `
    CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_e164_key
      ON customers(phone_e164)
      WHERE phone_e164 IS NOT NULL;
  `,
  `
    CREATE TABLE IF NOT EXISTS queues (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS quick_replies (
      id UUID PRIMARY KEY,
      shortcut TEXT NOT NULL UNIQUE,
      content TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  `
    CREATE INDEX IF NOT EXISTS quick_replies_shortcut_idx ON quick_replies(shortcut);
  `,
  `
    CREATE TABLE IF NOT EXISTS whatsapp_instances (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      evolution_instance_name TEXT NOT NULL UNIQUE,
      base_url TEXT NOT NULL,
      api_key_encrypted TEXT NOT NULL,
      webhook_secret TEXT,
      status "InstanceStatus" NOT NULL DEFAULT 'disconnected',
      phone_number TEXT,
      last_seen_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS tickets (
      id UUID PRIMARY KEY,
      customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
      whatsapp_instance_id UUID NOT NULL REFERENCES whatsapp_instances(id),
      current_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
      current_queue_id UUID REFERENCES queues(id) ON DELETE SET NULL,
      external_chat_id TEXT NOT NULL,
      external_contact_id TEXT,
      customer_name_snapshot TEXT NOT NULL,
      customer_avatar_url TEXT,
      title TEXT,
      status "TicketStatus" NOT NULL DEFAULT 'open',
      unread_count INTEGER NOT NULL DEFAULT 0,
      is_group BOOLEAN NOT NULL DEFAULT FALSE,
      last_message_preview TEXT,
      closed_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      closed_at TIMESTAMPTZ
    );
  `,
  `
    CREATE INDEX IF NOT EXISTS tickets_status_updated_at_idx ON tickets(status, updated_at DESC);
  `,
  `
    CREATE INDEX IF NOT EXISTS tickets_current_agent_id_idx ON tickets(current_agent_id, updated_at DESC);
  `,
  `
    CREATE INDEX IF NOT EXISTS tickets_current_queue_id_idx ON tickets(current_queue_id, updated_at DESC);
  `,
  `
    CREATE UNIQUE INDEX IF NOT EXISTS tickets_open_contact_instance_idx
      ON tickets(whatsapp_instance_id, external_chat_id)
      WHERE status IN ('open', 'pending');
  `,
  `
    CREATE TABLE IF NOT EXISTS ticket_messages (
      id UUID PRIMARY KEY,
      ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      sender_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
      external_message_id TEXT,
      direction "MessageDirection" NOT NULL,
      content_type "MessageContentType" NOT NULL DEFAULT 'text',
      body TEXT,
      sender_name_snapshot TEXT,
      raw_payload JSONB,
      reply_to_message_id UUID REFERENCES ticket_messages(id) ON DELETE SET NULL,
      delivered_at TIMESTAMPTZ,
      read_at TIMESTAMPTZ,
      edited_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS ticket_chat_aliases (
      id UUID PRIMARY KEY,
      whatsapp_instance_id UUID NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
      ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      alias TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  `
    CREATE UNIQUE INDEX IF NOT EXISTS ticket_chat_aliases_instance_alias_key
      ON ticket_chat_aliases(whatsapp_instance_id, alias);
  `,
  `
    CREATE INDEX IF NOT EXISTS ticket_chat_aliases_ticket_id_idx
      ON ticket_chat_aliases(ticket_id);
  `,
  `
    CREATE INDEX IF NOT EXISTS ticket_messages_ticket_id_created_at_idx
      ON ticket_messages(ticket_id, created_at ASC);
  `,
  `
    CREATE INDEX IF NOT EXISTS ticket_messages_external_message_id_idx
      ON ticket_messages(external_message_id)
      WHERE external_message_id IS NOT NULL;
  `,
  `
    CREATE TABLE IF NOT EXISTS attachments (
      id UUID PRIMARY KEY,
      message_id UUID NOT NULL REFERENCES ticket_messages(id) ON DELETE CASCADE,
      file_name TEXT,
      mime_type TEXT NOT NULL,
      size_bytes BIGINT,
      storage "AttachmentStorage" NOT NULL,
      storage_key TEXT NOT NULL,
      public_url TEXT,
      checksum_sha256 TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  `
    CREATE INDEX IF NOT EXISTS attachments_message_id_idx ON attachments(message_id);
  `,
  `
    CREATE TABLE IF NOT EXISTS ticket_assignments (
      id UUID PRIMARY KEY,
      ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      from_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
      to_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
      from_queue_id UUID REFERENCES queues(id) ON DELETE SET NULL,
      to_queue_id UUID REFERENCES queues(id) ON DELETE SET NULL,
      reason TEXT,
      created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  `
    CREATE INDEX IF NOT EXISTS ticket_assignments_ticket_id_idx
      ON ticket_assignments(ticket_id, created_at DESC);
  `,
  `
    CREATE TABLE IF NOT EXISTS ticket_events (
      id UUID PRIMARY KEY,
      ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      event_type "TicketEventType" NOT NULL,
      actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  `
    CREATE INDEX IF NOT EXISTS ticket_events_ticket_id_idx
      ON ticket_events(ticket_id, created_at DESC);
  `,
  `
    CREATE TABLE IF NOT EXISTS webhook_logs (
      id UUID PRIMARY KEY,
      source TEXT NOT NULL,
      event_name TEXT NOT NULL,
      whatsapp_instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE SET NULL,
      payload JSONB NOT NULL,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      processed_at TIMESTAMPTZ,
      status_code INTEGER,
      error_message TEXT
    );
  `,
  `
    CREATE INDEX IF NOT EXISTS webhook_logs_received_at_idx ON webhook_logs(received_at DESC);
  `,
  `
    CREATE TABLE IF NOT EXISTS queue_agents (
      queue_id UUID NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
      agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (queue_id, agent_id)
    );
  `,
];

export async function ensureOperationalSchema(app: FastifyInstance) {
  for (const statement of operationalStatements) {
    await app.prisma.$executeRawUnsafe(statement);
  }
}
