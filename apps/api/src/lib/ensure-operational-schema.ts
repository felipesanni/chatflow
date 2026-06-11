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
      CREATE TYPE "MessageContentType" AS ENUM ('text', 'image', 'audio', 'video', 'document', 'sticker', 'contact', 'other');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `,
  `
    DO $$
    BEGIN
      ALTER TYPE "MessageContentType" ADD VALUE IF NOT EXISTS 'contact';
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
        'nudged',
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
    DO $$
    BEGIN
      ALTER TYPE "TicketEventType" ADD VALUE IF NOT EXISTS 'nudged';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `,
  `
    DO $$
    BEGIN
      CREATE TYPE "ScheduledMessageStatus" AS ENUM ('pending', 'processing', 'sent', 'failed', 'canceled');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `,
  `
    DO $$
    BEGIN
      CREATE TYPE "AutomationStatus" AS ENUM ('draft', 'active', 'inactive');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `,
  `
    DO $$
    BEGIN
      CREATE TYPE "AutomationTriggerType" AS ENUM ('message_received', 'ticket_created', 'ticket_inactive', 'scheduled_time');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `,
  `
    DO $$
    BEGIN
      CREATE TYPE "AutomationExecutionStatus" AS ENUM ('success', 'skipped', 'failed');
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
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS access_start_time TEXT;
  `,
  `
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS access_end_time TEXT;
  `,
  `
    CREATE TABLE IF NOT EXISTS api_access_tokens (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      token_prefix TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      last_used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS browser_push_subscriptions (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_used_at TIMESTAMPTZ
    );
  `,
  `
    CREATE UNIQUE INDEX IF NOT EXISTS browser_push_subscriptions_endpoint_key
      ON browser_push_subscriptions(endpoint);
  `,
  `
    CREATE INDEX IF NOT EXISTS browser_push_subscriptions_user_id_idx
      ON browser_push_subscriptions(user_id);
  `,
  `
    CREATE UNIQUE INDEX IF NOT EXISTS api_access_tokens_token_hash_key
      ON api_access_tokens(token_hash);
  `,
  `
    CREATE TABLE IF NOT EXISTS agents (
      id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      avatar_url TEXT,
      presence "AgentPresence" NOT NULL DEFAULT 'offline',
      is_bot_agent BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_active_at TIMESTAMPTZ
    );
  `,
  `
    ALTER TABLE agents
      ADD COLUMN IF NOT EXISTS is_bot_agent BOOLEAN NOT NULL DEFAULT FALSE;
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
      dashboard_excluded_at TIMESTAMPTZ,
      dashboard_excluded_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
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
    ALTER TABLE customers
      ADD COLUMN IF NOT EXISTS dashboard_excluded_at TIMESTAMPTZ;
  `,
  `
    ALTER TABLE customers
      ADD COLUMN IF NOT EXISTS dashboard_excluded_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
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
      is_bot_queue BOOLEAN NOT NULL DEFAULT FALSE,
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
      CREATE SEQUENCE IF NOT EXISTS whatsapp_instances_public_id_seq;
    `,
    `
      ALTER TABLE whatsapp_instances
        ADD COLUMN IF NOT EXISTS public_id INTEGER;
    `,
    `
      ALTER TABLE whatsapp_instances
        ALTER COLUMN public_id SET DEFAULT nextval('whatsapp_instances_public_id_seq');
    `,
    `
      UPDATE whatsapp_instances
      SET public_id = nextval('whatsapp_instances_public_id_seq')
      WHERE public_id IS NULL;
    `,
    `
      CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_instances_public_id_key
        ON whatsapp_instances(public_id);
    `,
    `
      ALTER TABLE whatsapp_instances
        ALTER COLUMN public_id SET NOT NULL;
    `,
    `
      CREATE SEQUENCE IF NOT EXISTS agents_public_id_seq;
    `,
    `
      ALTER TABLE agents
        ADD COLUMN IF NOT EXISTS public_id INTEGER;
    `,
    `
      ALTER TABLE agents
        ALTER COLUMN public_id SET DEFAULT nextval('agents_public_id_seq');
    `,
    `
      UPDATE agents
      SET public_id = nextval('agents_public_id_seq')
      WHERE public_id IS NULL;
    `,
    `
      CREATE UNIQUE INDEX IF NOT EXISTS agents_public_id_key
        ON agents(public_id);
    `,
    `
      ALTER TABLE agents
        ALTER COLUMN public_id SET NOT NULL;
    `,
    `
      CREATE SEQUENCE IF NOT EXISTS queues_public_id_seq;
    `,
    `
      ALTER TABLE queues
        ADD COLUMN IF NOT EXISTS public_id INTEGER;
    `,
    `
      ALTER TABLE queues
        ALTER COLUMN public_id SET DEFAULT nextval('queues_public_id_seq');
    `,
    `
      UPDATE queues
      SET public_id = nextval('queues_public_id_seq')
      WHERE public_id IS NULL;
    `,
    `
      CREATE UNIQUE INDEX IF NOT EXISTS queues_public_id_key
        ON queues(public_id);
    `,
    `
      ALTER TABLE queues
        ALTER COLUMN public_id SET NOT NULL;
    `,
    `
      ALTER TABLE queues
        ADD COLUMN IF NOT EXISTS is_bot_queue BOOLEAN NOT NULL DEFAULT FALSE;
    `,
    `
      CREATE TABLE IF NOT EXISTS automations (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        status "AutomationStatus" NOT NULL DEFAULT 'draft',
        trigger_type "AutomationTriggerType" NOT NULL,
        queue_id UUID REFERENCES queues(id) ON DELETE SET NULL,
        whatsapp_instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE SET NULL,
        conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
        actions JSONB NOT NULL DEFAULT '[]'::jsonb,
        schedule_config JSONB,
        created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `,
    `
      CREATE TABLE IF NOT EXISTS automation_executions (
        id UUID PRIMARY KEY,
        automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
        dedupe_key TEXT,
        status "AutomationExecutionStatus" NOT NULL,
        trigger_payload JSONB,
        result_payload JSONB,
        message TEXT,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `,
    `
      CREATE INDEX IF NOT EXISTS automations_status_updated_at_idx
        ON automations(status, updated_at DESC);
    `,
    `
      CREATE INDEX IF NOT EXISTS automations_trigger_status_idx
        ON automations(trigger_type, status);
    `,
    `
      CREATE INDEX IF NOT EXISTS automations_queue_id_idx
        ON automations(queue_id);
    `,
    `
      CREATE INDEX IF NOT EXISTS automations_whatsapp_instance_id_idx
        ON automations(whatsapp_instance_id);
    `,
    `
      CREATE INDEX IF NOT EXISTS automation_executions_automation_id_executed_at_idx
        ON automation_executions(automation_id, executed_at DESC);
    `,
    `
      ALTER TABLE automation_executions
      ADD COLUMN IF NOT EXISTS dedupe_key TEXT;
    `,
    `
      DELETE FROM automation_executions AS older
      USING automation_executions AS newer
      WHERE older.automation_id = newer.automation_id
        AND older.dedupe_key IS NOT NULL
        AND newer.dedupe_key IS NOT NULL
        AND older.dedupe_key = newer.dedupe_key
        AND (
          older.executed_at < newer.executed_at
          OR (older.executed_at = newer.executed_at AND older.id < newer.id)
        );
    `,
    `
      CREATE UNIQUE INDEX IF NOT EXISTS automation_executions_automation_id_dedupe_key_key
        ON automation_executions(automation_id, dedupe_key)
        WHERE dedupe_key IS NOT NULL;
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
      last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      closed_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      closed_at TIMESTAMPTZ
    );
  `,
  `
    ALTER TABLE tickets
      ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  `,
  `
    UPDATE tickets
    SET last_message_at = COALESCE((
      SELECT MAX(tm.created_at)
      FROM ticket_messages tm
      WHERE tm.ticket_id = tickets.id
    ), tickets.last_message_at, tickets.created_at)
    WHERE last_message_at IS NULL OR last_message_at = created_at OR last_message_at = updated_at;
  `,
  `
    CREATE INDEX IF NOT EXISTS tickets_status_last_message_at_idx ON tickets(status, last_message_at DESC);
  `,
  `
    CREATE INDEX IF NOT EXISTS tickets_current_agent_id_last_message_at_idx ON tickets(current_agent_id, last_message_at DESC);
  `,
  `
    CREATE INDEX IF NOT EXISTS tickets_current_queue_id_last_message_at_idx ON tickets(current_queue_id, last_message_at DESC);
  `,
  `
    CREATE TABLE IF NOT EXISTS ticket_group_hidden_users (
      ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      hidden_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      hidden_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (ticket_id, user_id)
    );
  `,
  `
    CREATE INDEX IF NOT EXISTS ticket_group_hidden_users_user_id_idx
      ON ticket_group_hidden_users(user_id);
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
    CREATE TABLE IF NOT EXISTS scheduled_messages (
      id UUID PRIMARY KEY,
      ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT,
      content_type "MessageContentType" NOT NULL DEFAULT 'text',
      attachment_payload JSONB,
      internal_note BOOLEAN NOT NULL DEFAULT FALSE,
      reply_to_message_id UUID REFERENCES ticket_messages(id) ON DELETE SET NULL,
      send_at TIMESTAMPTZ NOT NULL,
      status "ScheduledMessageStatus" NOT NULL DEFAULT 'pending',
      error_message TEXT,
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  `
    CREATE INDEX IF NOT EXISTS scheduled_messages_ticket_id_send_at_idx
      ON scheduled_messages(ticket_id, send_at ASC);
  `,
  `
    CREATE INDEX IF NOT EXISTS scheduled_messages_status_send_at_idx
      ON scheduled_messages(status, send_at ASC);
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
