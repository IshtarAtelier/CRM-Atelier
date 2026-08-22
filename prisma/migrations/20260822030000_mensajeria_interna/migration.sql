-- Mensajería interna entre colaboradores: conversación + participantes + mensajes.
--
-- SOLO CREA. No hay un solo DROP ni ALTER en este archivo, a propósito.
-- El `prisma migrate diff` contra la base local generó de prende un
-- "ALTER TABLE Order DROP COLUMN postSaleCost…" (6 columnas) y un
-- "DROP TABLE DailyAuditRun" que NO son parte de este cambio: son desfasaje
-- entre la base local y el schema. Aplicados en producción borraban datos
-- reales. Se eliminaron a mano; este archivo es solo el alta de las 3 tablas.

-- CreateTable
CREATE TABLE "InternalThread" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'DIRECT',
    "subject" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalThreadParticipant" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "lastReadAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalThreadParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),

    CONSTRAINT "InternalMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InternalThread_lastMessageAt_idx" ON "InternalThread"("lastMessageAt" DESC);

-- CreateIndex
CREATE INDEX "InternalThreadParticipant_userId_leftAt_idx" ON "InternalThreadParticipant"("userId", "leftAt");

-- CreateIndex
CREATE UNIQUE INDEX "InternalThreadParticipant_threadId_userId_key" ON "InternalThreadParticipant"("threadId", "userId");

-- CreateIndex
CREATE INDEX "InternalMessage_threadId_createdAt_idx" ON "InternalMessage"("threadId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "InternalThread" ADD CONSTRAINT "InternalThread_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalThreadParticipant" ADD CONSTRAINT "InternalThreadParticipant_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "InternalThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalThreadParticipant" ADD CONSTRAINT "InternalThreadParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalMessage" ADD CONSTRAINT "InternalMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "InternalThread"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalMessage" ADD CONSTRAINT "InternalMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
