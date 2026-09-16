-- Prueba estructural del click-to-WhatsApp de Meta (objeto `referral`).
--
-- Escrita a MANO a propósito: `prisma migrate diff` contra la base local traía
-- además borrados de columnas y tablas por drift de esa base (Order.postSaleCost,
-- DailyAuditRun, tres índices). Acá solo se AGREGA: ninguna columna existente se
-- toca, ningún dato se mueve, y todo es NULL-able, así que el deploy viejo sigue
-- funcionando mientras rota.

ALTER TABLE "WhatsAppChat"
    ADD COLUMN IF NOT EXISTS "adSourceId"   TEXT,
    ADD COLUMN IF NOT EXISTS "adSourceType" TEXT,
    ADD COLUMN IF NOT EXISTS "adCtwaClid"   TEXT,
    ADD COLUMN IF NOT EXISTS "adHeadline"   TEXT,
    ADD COLUMN IF NOT EXISTS "adSourceUrl"  TEXT,
    ADD COLUMN IF NOT EXISTS "adReferralAt" TIMESTAMP(3);

ALTER TABLE "Client"
    ADD COLUMN IF NOT EXISTS "adSourceId" TEXT;

CREATE INDEX IF NOT EXISTS "WhatsAppChat_adSourceId_idx" ON "WhatsAppChat"("adSourceId");
CREATE INDEX IF NOT EXISTS "Client_adSourceId_idx" ON "Client"("adSourceId");

-- Nombre del anuncio y de la campaña, tal como los devuelve Meta para un id.
CREATE TABLE IF NOT EXISTS "MetaAd" (
    "id"           TEXT NOT NULL,
    "name"         TEXT,
    "campaignId"   TEXT,
    "campaignName" TEXT,
    "adsetName"    TEXT,
    "status"       TEXT,
    "fetchedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MetaAd_pkey" PRIMARY KEY ("id")
);
