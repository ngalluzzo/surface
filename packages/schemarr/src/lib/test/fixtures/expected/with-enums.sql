CREATE TYPE "ticket_status" AS ENUM ('open', 'in_progress', 'resolved', 'closed');

CREATE TYPE "ticket_priority" AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE "ticket_category" AS ENUM ('bug', 'feature', 'support');

CREATE TABLE "ticket" (
  "id" UUID NOT NULL,
  "subject" VARCHAR(300),
  "status" ticket_status NOT NULL,
  "priority" ticket_priority NOT NULL,
  "category" ticket_category,
  "duplicate_status" ticket_status,
  CONSTRAINT "ticket_pkey" PRIMARY KEY ("id")
);
