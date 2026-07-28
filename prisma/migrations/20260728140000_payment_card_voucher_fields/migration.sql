-- Datos del voucher de tarjeta: el ticket presencial (posnet) trae lote, cupón y
-- autorización; el link de pago trae un nº de operación. Columnas nullable: los
-- pagos ya cargados quedan como están.
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "cardMode" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "batchNumber" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "couponNumber" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "authNumber" TEXT;
