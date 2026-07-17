-- Rendición de efectivo vendedor → encargada (doble confirmación) y arqueo de
-- caja (conteo físico vs. saldo teórico). Ver modelos CashHandover / CashCount.

CREATE TABLE IF NOT EXISTS "CashHandover" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expectedAmount" DOUBLE PRECISION NOT NULL,
    "declaredAmount" DOUBLE PRECISION NOT NULL,
    "countedAmount" DOUBLE PRECISION,
    "difference" DOUBLE PRECISION,
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "payments" JSONB NOT NULL,
    "notes" TEXT,
    "confirmedById" TEXT,
    "confirmedByName" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashHandover_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CashHandover_vendorId_idx" ON "CashHandover"("vendorId");
CREATE INDEX IF NOT EXISTS "CashHandover_status_idx" ON "CashHandover"("status");
CREATE INDEX IF NOT EXISTS "CashHandover_createdAt_idx" ON "CashHandover"("createdAt");

CREATE TABLE IF NOT EXISTS "CashCount" (
    "id" TEXT NOT NULL,
    "theoreticalTotal" DOUBLE PRECISION NOT NULL,
    "countedAmount" DOUBLE PRECISION NOT NULL,
    "difference" DOUBLE PRECISION NOT NULL,
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "summary" JSONB NOT NULL,
    "notes" TEXT,
    "closedById" TEXT,
    "closedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashCount_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CashCount_createdAt_idx" ON "CashCount"("createdAt");
