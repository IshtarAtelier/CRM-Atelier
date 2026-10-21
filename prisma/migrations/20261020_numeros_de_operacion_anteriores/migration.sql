-- Un pedido o un caso de post-venta que cambia de nº de operación conserva los
-- anteriores (separados por espacio) para que sigan apareciendo en el buscador.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "labOrderNumberHistory" TEXT;
ALTER TABLE "PostSaleCase" ADD COLUMN IF NOT EXISTS "newOrderNumberHistory" TEXT;
