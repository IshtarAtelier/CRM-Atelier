-- Observación que escribe el vendedor y sale en el PDF que recibe el cliente
-- cuando el pedido se procesa. Nullable: los pedidos existentes quedan sin nota.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "clientNote" TEXT;
