-- Moneda de los objetivos mensuales: "USD" (convertido a ARS con el blue del día)
-- o "ARS" (legacy). Las filas existentes quedan como ARS.
ALTER TABLE "MonthlyTarget" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'ARS';
