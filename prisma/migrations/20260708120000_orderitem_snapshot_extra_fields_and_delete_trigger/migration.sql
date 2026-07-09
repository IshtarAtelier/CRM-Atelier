-- ============================================================================
-- Blindaje del historial de ventas frente al borrado de productos.
--
-- Objetivo: poder borrar cualquier Product con total libertad sin dañar ninguna
-- venta. La FK OrderItem.productId es ON DELETE SET NULL (la línea sobrevive),
-- pero para no perder QUÉ se vendió y A QUÉ COSTO, cada OrderItem guarda una
-- "foto" (snapshot) de los datos del producto.
-- ============================================================================

-- 1) Columnas snapshot nuevas (aditivas, nullable): congelan datos que hoy se
--    pierden al borrar el producto: tipo de cristal, índice y unidad de venta.
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "productTypeSnapshot" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "productLensIndexSnapshot" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "productUnitTypeSnapshot" TEXT;

-- 2) Red de seguridad a nivel base de datos: ANTES de borrar cualquier producto
--    (venga del endpoint, de un script o de un DELETE manual en consola), congela
--    sus datos en cada línea de venta que lo referencia y todavía no los tenga.
--    Corre BEFORE DELETE, así OLD.* aún tiene los valores del producto, y antes de
--    que el ON DELETE SET NULL desvincule la línea. COALESCE = solo rellena lo que
--    falta, nunca pisa un snapshot ya guardado. Idempotente.
CREATE OR REPLACE FUNCTION freeze_orderitem_snapshot() RETURNS TRIGGER AS $$
BEGIN
  UPDATE "OrderItem" oi SET
    "productNameSnapshot"      = COALESCE(oi."productNameSnapshot", OLD."model", OLD."name"),
    "productBrandSnapshot"     = COALESCE(oi."productBrandSnapshot", OLD."brand"),
    "productCategorySnapshot"  = COALESCE(oi."productCategorySnapshot", OLD."category"),
    "productCostSnapshot"      = COALESCE(oi."productCostSnapshot", OLD."cost", 0),
    "laboratorySnapshot"       = COALESCE(oi."laboratorySnapshot", OLD."laboratory"),
    "productTypeSnapshot"      = COALESCE(oi."productTypeSnapshot", OLD."type"),
    "productLensIndexSnapshot" = COALESCE(oi."productLensIndexSnapshot", OLD."lensIndex"),
    "productUnitTypeSnapshot"  = COALESCE(oi."productUnitTypeSnapshot", OLD."unitType")
  WHERE oi."productId" = OLD."id";
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_freeze_orderitem_snapshot ON "Product";
CREATE TRIGGER trg_freeze_orderitem_snapshot
  BEFORE DELETE ON "Product"
  FOR EACH ROW EXECUTE FUNCTION freeze_orderitem_snapshot();

-- 3) Backfill único: rellena la foto en las líneas de venta cuyo producto sigue
--    vivo pero quedaron sin snapshot (ventas viejas). Idempotente (COALESCE solo
--    completa NULLs). Las líneas cuyo producto ya fue borrado no tienen origen del
--    cual recuperar y quedan como están.
UPDATE "OrderItem" oi SET
  "productNameSnapshot"      = COALESCE(oi."productNameSnapshot", p."model", p."name"),
  "productBrandSnapshot"     = COALESCE(oi."productBrandSnapshot", p."brand"),
  "productCategorySnapshot"  = COALESCE(oi."productCategorySnapshot", p."category"),
  "productCostSnapshot"      = COALESCE(oi."productCostSnapshot", p."cost", 0),
  "laboratorySnapshot"       = COALESCE(oi."laboratorySnapshot", p."laboratory"),
  "productTypeSnapshot"      = COALESCE(oi."productTypeSnapshot", p."type"),
  "productLensIndexSnapshot" = COALESCE(oi."productLensIndexSnapshot", p."lensIndex"),
  "productUnitTypeSnapshot"  = COALESCE(oi."productUnitTypeSnapshot", p."unitType")
FROM "Product" p
WHERE oi."productId" = p."id";
