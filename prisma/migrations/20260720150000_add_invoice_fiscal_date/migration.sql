-- Fecha fiscal del comprobante (CbteFch). El tope mensual de monotributo se mide por
-- esta fecha, no por createdAt (que difiere si se backdatea la emisión).
ALTER TABLE "Invoice" ADD COLUMN "fiscalDate" TIMESTAMP(3);

-- Backfill conservador: para las filas existentes, asumir fecha fiscal = createdAt.
UPDATE "Invoice" SET "fiscalDate" = "createdAt" WHERE "fiscalDate" IS NULL;

CREATE INDEX "Invoice_fiscalDate_idx" ON "Invoice"("fiscalDate");
