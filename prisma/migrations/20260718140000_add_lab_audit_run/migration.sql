-- Registro histórico de cada revisión diaria de conciliación de laboratorio.
-- Una fila por corrida del cron (libro de auditoría del control diario).

-- CreateTable
CREATE TABLE "LabAuditRun" (
    "id" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trigger" TEXT NOT NULL DEFAULT 'CRON',
    "providers" JSONB NOT NULL,
    "staleSources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "totalEntries" INTEGER NOT NULL DEFAULT 0,
    "conVenta" INTEGER NOT NULL DEFAULT 0,
    "postventa" INTEGER NOT NULL DEFAULT 0,
    "sinVenta" INTEGER NOT NULL DEFAULT 0,
    "esperandoFact" INTEGER NOT NULL DEFAULT 0,
    "ok" INTEGER NOT NULL DEFAULT 0,
    "overcost" INTEGER NOT NULL DEFAULT 0,
    "undercost" INTEGER NOT NULL DEFAULT 0,
    "nuevosSinVenta" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "LabAuditRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LabAuditRun_runAt_idx" ON "LabAuditRun"("runAt");
