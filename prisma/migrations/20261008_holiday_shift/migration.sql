-- Cobertura de feriados (quién vino y en qué horario), para
-- /admin/equipo/calendario. Escrita a MANO, solo AGREGA, idempotente.
CREATE TABLE IF NOT EXISTS "HolidayShift" (
    "id"            TEXT NOT NULL,
    "fecha"         TIMESTAMP(3) NOT NULL,
    "userId"        TEXT NOT NULL,
    "worked"        BOOLEAN NOT NULL,
    "startTime"     TEXT,
    "endTime"       TEXT,
    "notes"         TEXT,
    "createdById"   TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HolidayShift_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HolidayShift_userId_fkey') THEN
        ALTER TABLE "HolidayShift" ADD CONSTRAINT "HolidayShift_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "HolidayShift_fecha_userId_key" ON "HolidayShift"("fecha", "userId");
CREATE INDEX IF NOT EXISTS "HolidayShift_fecha_idx" ON "HolidayShift"("fecha");
