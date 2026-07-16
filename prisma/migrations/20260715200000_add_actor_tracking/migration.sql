-- Trazabilidad de actor: quién hizo cada cosa.
-- Campos denormalizados (id + nombre) para que el historial sobreviva
-- al borrado o renombrado de usuarios. Todo nullable: cero impacto
-- sobre filas existentes, sin backfill necesario.

-- Historial de la ficha del cliente
ALTER TABLE "Interaction" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "Interaction" ADD COLUMN IF NOT EXISTS "userName" TEXT;

-- Pagos: quién los cargó
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "createdByName" TEXT;
CREATE INDEX IF NOT EXISTS "Payment_createdById_idx" ON "Payment"("createdById");

-- Tareas: quién las completó y cuándo
ALTER TABLE "ClientTask" ADD COLUMN IF NOT EXISTS "completedBy" TEXT;
ALTER TABLE "ClientTask" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

-- Facturas: quién las emitió
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "createdByName" TEXT;

-- Pagos a médicos: quién registró la salida de dinero
ALTER TABLE "DoctorPayment" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "DoctorPayment" ADD COLUMN IF NOT EXISTS "createdByName" TEXT;
