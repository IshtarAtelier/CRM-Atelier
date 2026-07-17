-- Origen del cristal (STOCK / LABORATORIO) en la foto congelada de cada línea de venta.
-- Extiende el blindaje de 20260708120000: columna aditiva nullable + el trigger
-- freeze_orderitem_snapshot pasa a congelar también el origen antes de borrar un producto.
-- Seguro en prod: no bloquea, no backfillea, no pisa datos existentes.

-- 1) Columna snapshot nueva (aditiva, nullable)
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "productOriginSnapshot" TEXT;

-- 2) Redeclarar la función del trigger con el campo nuevo. CREATE OR REPLACE
--    reemplaza la versión anterior; el trigger trg_freeze_orderitem_snapshot
--    existente la sigue apuntando, no hace falta recrearlo.
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
    "productUnitTypeSnapshot"  = COALESCE(oi."productUnitTypeSnapshot", OLD."unitType"),
    "productOriginSnapshot"    = COALESCE(oi."productOriginSnapshot", OLD."origin")
  WHERE oi."productId" = OLD."id";
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 3) Backfill: igual que en 20260708120000, NO va acá (nada pesado en el arranque
--    del deploy). Las líneas cuyo producto sigue vivo resuelven el origen por la
--    relación; el trigger congela el resto de acá en adelante. Para rellenar ventas
--    viejas proactivamente: scripts/utils/backfill_order_item_snapshots.js (aparte).
