-- WhatsApp Cloud API (API oficial): ventana de 24 h, plantillas y nombre de
-- plantilla por mensaje. Ver docs/plan-whatsapp-api-oficial.md (Fase 2).
ALTER TABLE "WhatsAppChat" ADD COLUMN "lastInboundAt" TIMESTAMP(3);
ALTER TABLE "WhatsAppMessage" ADD COLUMN "templateName" TEXT;

CREATE TABLE "WhatsAppTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'es_AR',
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "components" JSONB NOT NULL,
    "metaId" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WhatsAppTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WhatsAppTemplate_metaId_key" ON "WhatsAppTemplate"("metaId");
CREATE UNIQUE INDEX "WhatsAppTemplate_name_language_key" ON "WhatsAppTemplate"("name", "language");

-- Rellenar la ventana con lo que ya sabemos: el último entrante de cada chat.
UPDATE "WhatsAppChat" c SET "lastInboundAt" = m.last
FROM (SELECT "chatId", MAX("createdAt") AS last FROM "WhatsAppMessage" WHERE direction = 'INBOUND' GROUP BY "chatId") m
WHERE m."chatId" = c.id;
