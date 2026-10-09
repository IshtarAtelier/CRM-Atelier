-- Gift cards (tarjetas de regalo) del local, para /admin/gift-cards.
--
-- Escrita a MANO, solo AGREGA y es idempotente: corre en cada arranque de las
-- dos instancias de Railway (migrate deploy) y no toca ninguna tabla existente.
CREATE TABLE IF NOT EXISTS "GiftCard" (
    "id"            TEXT NOT NULL,
    "code"          TEXT NOT NULL,
    "para"          TEXT NOT NULL,
    "de"            TEXT,
    "monto"         DOUBLE PRECISION NOT NULL,
    "validaHasta"   TIMESTAMP(3),
    "telefono"      TEXT,
    "estado"        TEXT NOT NULL DEFAULT 'ACTIVA',
    "usadaAt"       TIMESTAMP(3),
    "usadaPorId"    TEXT,
    "usadaPorName"  TEXT,
    "notas"         TEXT,
    "createdById"   TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GiftCard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GiftCard_code_key" ON "GiftCard"("code");
CREATE INDEX IF NOT EXISTS "GiftCard_estado_idx" ON "GiftCard"("estado");
CREATE INDEX IF NOT EXISTS "GiftCard_createdAt_idx" ON "GiftCard"("createdAt");
