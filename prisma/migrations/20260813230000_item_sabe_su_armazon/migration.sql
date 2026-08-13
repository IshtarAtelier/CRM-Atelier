-- A qué armazón pertenece cada línea del pedido (1..N).
-- Aditiva y nulable: los pedidos existentes siguen igual.
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "framePosition" INTEGER;
