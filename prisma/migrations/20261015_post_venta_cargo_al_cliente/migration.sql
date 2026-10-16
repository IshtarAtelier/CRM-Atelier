-- Post-venta "lo paga el cliente": el caso lleva su propio saldo y sus pagos
-- (con comprobante), separados de la venta.
ALTER TABLE "PostSaleCase" ADD COLUMN IF NOT EXISTS "clientCharge" DOUBLE PRECISION;
ALTER TABLE "PostSaleCase" ADD COLUMN IF NOT EXISTS "clientChargedAt" TIMESTAMP(3);
ALTER TABLE "PostSaleCase" ADD COLUMN IF NOT EXISTS "clientChargedBy" TEXT;

CREATE TABLE IF NOT EXISTS "PostSalePayment" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "receiptUrl" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostSalePayment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PostSalePayment_caseId_idx" ON "PostSalePayment"("caseId");
ALTER TABLE "PostSalePayment" DROP CONSTRAINT IF EXISTS "PostSalePayment_caseId_fkey";
ALTER TABLE "PostSalePayment" ADD CONSTRAINT "PostSalePayment_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "PostSaleCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
