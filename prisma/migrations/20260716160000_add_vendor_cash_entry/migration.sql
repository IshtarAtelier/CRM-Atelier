-- Caja por vendedor: cuenta corriente individual (VendorCashEntry).
-- Saldo = CREDITO − DEBITO. Positivo = tiene para cobrar; negativo = debe.
-- Aditiva e idempotente: solo crea tabla, índices y FK si no existen.

CREATE TABLE IF NOT EXISTS "VendorCashEntry" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OTRO',
    "receiptUrl" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorCashEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VendorCashEntry_vendorId_idx" ON "VendorCashEntry"("vendorId");
CREATE INDEX IF NOT EXISTS "VendorCashEntry_createdAt_idx" ON "VendorCashEntry"("createdAt");

DO $$ BEGIN
    ALTER TABLE "VendorCashEntry" ADD CONSTRAINT "VendorCashEntry_vendorId_fkey"
        FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
