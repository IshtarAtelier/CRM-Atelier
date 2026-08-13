-- Outbox de envíos proactivos de WhatsApp (Fase 1 del motor de seguimientos)
-- + índices que les faltaban a las queries calientes de ClientTask.
-- SOLO ADITIVO a propósito: el diff automático contra la base local arrastraba
-- DROPs de columnas/tablas que no son de este cambio (drift local) y que
-- podrían destruir datos en producción. Nunca incluir DROPs acá.

-- CreateTable
CREATE TABLE "EnvioProgramado" (
    "id" TEXT NOT NULL,
    "waId" TEXT NOT NULL,
    "chatId" TEXT,
    "clientId" TEXT,
    "taskId" TEXT,
    "origen" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "label" TEXT,
    "clientName" TEXT,
    "claimStamp" TIMESTAMP(3),
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" TEXT NOT NULL DEFAULT 'QUEUED',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvioProgramado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnvioProgramado_estado_scheduledFor_idx" ON "EnvioProgramado"("estado", "scheduledFor");

-- CreateIndex
CREATE INDEX "EnvioProgramado_taskId_idx" ON "EnvioProgramado"("taskId");

-- CreateIndex
CREATE INDEX "ClientTask_type_status_dueDate_idx" ON "ClientTask"("type", "status", "dueDate");

-- CreateIndex
CREATE INDEX "ClientTask_createdBy_status_createdAt_idx" ON "ClientTask"("createdBy", "status", "createdAt");
