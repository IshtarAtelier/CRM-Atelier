-- PostSaleCase / PostSaleNote / PostSaleStatusHistory existen en schema.prisma
-- pero nunca tuvieron migración (mismo drift que las columnas frameA2).
-- Idempotente (IF NOT EXISTS / duplicate_object) para ser segura en cualquier base.

CREATE TABLE IF NOT EXISTS "PostSaleCase" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "newOrderNumber" TEXT,
    "notes" TEXT,
    "orderOption" TEXT,
    "responsible" TEXT,
    "rxData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostSaleCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PostSaleNote" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostSaleNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PostSaleStatusHistory" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "changedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostSaleStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PostSaleCase_orderId_idx" ON "PostSaleCase"("orderId");
CREATE INDEX IF NOT EXISTS "PostSaleCase_status_idx" ON "PostSaleCase"("status");
CREATE INDEX IF NOT EXISTS "PostSaleNote_caseId_idx" ON "PostSaleNote"("caseId");
CREATE INDEX IF NOT EXISTS "PostSaleStatusHistory_caseId_idx" ON "PostSaleStatusHistory"("caseId");
CREATE INDEX IF NOT EXISTS "Order_labSentAt_idx" ON "Order"("labSentAt");

DO $$ BEGIN
    ALTER TABLE "PostSaleCase" ADD CONSTRAINT "PostSaleCase_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "PostSaleNote" ADD CONSTRAINT "PostSaleNote_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "PostSaleCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "PostSaleStatusHistory" ADD CONSTRAINT "PostSaleStatusHistory_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "PostSaleCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
