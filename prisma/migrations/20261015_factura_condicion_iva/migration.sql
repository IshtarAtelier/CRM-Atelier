-- Condición frente al IVA del receptor informada a ARCA (RG 5616). Null en las
-- facturas anteriores al 15/10/2026: el PDF las muestra como Consumidor Final.
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "receiverIvaCondition" INTEGER;
