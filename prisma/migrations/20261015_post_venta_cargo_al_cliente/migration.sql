-- Post-venta "lo paga el cliente": el cargo se carga en el caso y suma al saldo
-- de la venta. Order.postSaleCharge es lo que se suma; PostSaleCase.clientCharge*
-- es el registro de quién y cuándo lo cargó.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "postSaleCharge" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "PostSaleCase" ADD COLUMN IF NOT EXISTS "clientCharge" DOUBLE PRECISION;
ALTER TABLE "PostSaleCase" ADD COLUMN IF NOT EXISTS "clientChargedAt" TIMESTAMP(3);
ALTER TABLE "PostSaleCase" ADD COLUMN IF NOT EXISTS "clientChargedBy" TEXT;
