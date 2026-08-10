-- Aviso de despacho al cliente.
--
-- Hasta ahora, quien compraba por la web pagaba y no recibía nada más hasta que
-- retiraba el pedido: podían pasar dos semanas de silencio después del cobro.
-- Era la principal causa de "¿qué pasó con mi pedido?".
--
-- `shippingCarrier` / `trackingNumber` / `trackingUrl`: datos del envío que se
-- le mandan al cliente. La URL se guarda porque cambia según la empresa de
-- correo; armarla en el código obligaría a hardcodear un formato por cada una.
-- `shippedAt`: cuándo salió.
-- `dispatchNotifiedAt`: cuándo se le avisó. Es la guarda de idempotencia — sin
-- ella, cualquier reedición del pedido volvería a mandarle el mismo aviso.
--
-- Todas nullable: los pedidos existentes quedan sin datos de envío.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippingCarrier" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "trackingNumber" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "trackingUrl" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "dispatchNotifiedAt" TIMESTAMP(3);
