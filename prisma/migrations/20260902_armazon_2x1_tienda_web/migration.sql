-- 2x1 de armazones de la TIENDA WEB: qué armazones entran.
--
-- Campo aparte de `eligible2x1` a propósito. Ese decide si un armazón puede ser
-- el bonificado del 2x1 de MULTIFOCALES del CRM, que es otra promo: se dispara
-- al vender dos pares de cristales y la aplica un vendedor en el local. Si las
-- dos compartieran tilde, marcar un armazón para la web lo haría regalable
-- también en el mostrador, sin que nadie lo haya decidido.
--
-- Arranca en false: ningún armazón entra hasta que alguien lo marque a mano
-- desde /admin/web. Mismo criterio que se usó el 22/8 con `eligible2x1` — una
-- promo que regala producto nunca viene prendida de fábrica.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "eligible2x1Web" BOOLEAN NOT NULL DEFAULT false;

-- La tienda filtra por este campo junto con publishToWeb en cada armado del
-- catálogo, así que conviene que no sea un scan.
CREATE INDEX IF NOT EXISTS "Product_eligible2x1Web_idx" ON "Product"("eligible2x1Web");
