-- Conversation history (call / SMS / web chat)
--
-- One Conversation per logical session, many ConversationMessage rows per
-- session in strict turn order. Replaces the ai_event_logs shim that
-- previously tried to fake conversations by event_type prefix.

-- CreateEnum
CREATE TYPE "ConversationChannel" AS ENUM ('Call', 'Sms', 'Web');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('InProgress', 'Completed', 'Escalated', 'Failed', 'Abandoned');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('caller', 'agent', 'system', 'tool');

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "channel" "ConversationChannel" NOT NULL,
    "external_id" TEXT,
    "caller_phone" TEXT,
    "caller_name" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "duration_seconds" INTEGER,
    "status" "ConversationStatus" NOT NULL DEFAULT 'InProgress',
    "outcome" TEXT,
    "intent" TEXT,
    "job_id" TEXT,
    "quote_id" TEXT,
    "escalated" BOOLEAN NOT NULL DEFAULT false,
    "escalation_reason" TEXT,
    "threat_level" TEXT,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "audio_url" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "turn_index" INTEGER NOT NULL,
    "role" "MessageRole" NOT NULL,
    "text" TEXT NOT NULL,
    "audio_url" TEXT,
    "twilio_sid" TEXT,
    "latency_ms" INTEGER,
    "model" TEXT,
    "tokens_in" INTEGER,
    "tokens_out" INTEGER,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversations_business_id_started_at_idx" ON "conversations"("business_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "conversations_business_id_channel_started_at_idx" ON "conversations"("business_id", "channel", "started_at" DESC);

-- CreateIndex
CREATE INDEX "conversations_business_id_customer_id_idx" ON "conversations"("business_id", "customer_id");

-- CreateIndex
CREATE INDEX "conversations_business_id_external_id_idx" ON "conversations"("business_id", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_messages_conversation_id_turn_index_key" ON "conversation_messages"("conversation_id", "turn_index");

-- CreateIndex
CREATE INDEX "conversation_messages_conversation_id_turn_index_idx" ON "conversation_messages"("conversation_id", "turn_index");

-- CreateIndex
CREATE INDEX "conversation_messages_business_id_createdAt_idx" ON "conversation_messages"("business_id", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
