-- Foto del armazón sacada por el vendedor al cerrar la venta.
-- Aditiva: dos columnas nulables, nada que migrar hacia atrás.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "frameImageUrl" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "frameImageUrl2" TEXT;
