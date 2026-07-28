-- Etiqueta del anuncio ([metaFlor] → "flor") persistida al momento de la ingestión.
-- La atribución de pauta deja de depender de que el historial de mensajes sobreviva.
ALTER TABLE "Client" ADD COLUMN "adTag" TEXT;
ALTER TABLE "WhatsAppChat" ADD COLUMN "adTag" TEXT;

CREATE INDEX "Client_adTag_idx" ON "Client"("adTag");
