-- Solicitud de factura del vendedor: el monto y la observación viajan como
-- datos, no adentro del texto del aviso.
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "requestedAmount" DOUBLE PRECISION;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "observations" TEXT;
