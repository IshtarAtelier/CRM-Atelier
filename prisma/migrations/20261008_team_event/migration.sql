-- Novedades del equipo (faltas, francos, cambios de turno, pedidos especiales)
-- para el calendario compartido de /admin/equipo/calendario.
--
-- Escrita a MANO, solo AGREGA y es idempotente: corre en cada arranque de las
-- dos instancias de Railway (migrate deploy) y no toca ninguna tabla existente.
CREATE TABLE IF NOT EXISTS "TeamEvent" (
    "id"             TEXT NOT NULL,
    "userId"         TEXT NOT NULL,
    "type"           TEXT NOT NULL,
    "startsAt"       TIMESTAMP(3) NOT NULL,
    "endsAt"         TIMESTAMP(3) NOT NULL,
    "horario"        TEXT,
    "status"         TEXT NOT NULL DEFAULT 'REGISTRADO',
    "justificada"    BOOLEAN,
    "swapWithUserId" TEXT,
    "notes"          TEXT,
    "createdById"    TEXT,
    "createdByName"  TEXT NOT NULL,
    "decidedById"    TEXT,
    "decidedByName"  TEXT,
    "decidedAt"      TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TeamEvent_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeamEvent_userId_fkey') THEN
        ALTER TABLE "TeamEvent" ADD CONSTRAINT "TeamEvent_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeamEvent_swapWithUserId_fkey') THEN
        ALTER TABLE "TeamEvent" ADD CONSTRAINT "TeamEvent_swapWithUserId_fkey"
            FOREIGN KEY ("swapWithUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "TeamEvent_startsAt_endsAt_idx" ON "TeamEvent"("startsAt", "endsAt");
CREATE INDEX IF NOT EXISTS "TeamEvent_userId_startsAt_idx" ON "TeamEvent"("userId", "startsAt");
CREATE INDEX IF NOT EXISTS "TeamEvent_status_idx" ON "TeamEvent"("status");
