-- Carritos abandonados con ficha: CheckoutSession gana clientId para que el
-- seguimiento quede registrado en la ficha del cliente y el panel de
-- Oportunidades de Cierre pueda deduplicar por cliente.
ALTER TABLE "CheckoutSession" ADD COLUMN "clientId" TEXT;
CREATE INDEX "CheckoutSession_clientId_idx" ON "CheckoutSession"("clientId");
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
