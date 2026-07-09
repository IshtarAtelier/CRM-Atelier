// Foto ("snapshot") del producto que se congela dentro de cada línea de venta (OrderItem).
//
// Por qué existe: una venta debe ser inmutable. Tiene que seguir mostrando QUÉ se vendió,
// de qué marca y a qué costo, aunque después el producto se edite, se renombre o se BORRE.
// La FK OrderItem.productId es `ON DELETE SET NULL`, así que al borrar un producto el vínculo
// se pierde; lo único que sobrevive es esta foto. Por eso TODO canal de venta debe grabarla.
//
// Centralizar acá evita que un canal de venta nuevo se olvide de guardar la foto: si usa
// este helper, queda blindado automáticamente.

type SnapshotSource =
    | {
          model?: string | null;
          name?: string | null;
          brand?: string | null;
          category?: string | null;
          cost?: number | null;
          laboratory?: string | null;
          type?: string | null;
          lensIndex?: string | null;
          unitType?: string | null;
      }
    | null
    | undefined;

type SnapshotFallback = {
    name?: string | null;
    brand?: string | null;
    category?: string | null;
    cost?: number | null;
    laboratory?: string | null;
    type?: string | null;
    lensIndex?: string | null;
    unitType?: string | null;
};

export type ProductSnapshot = {
    productNameSnapshot: string | null;
    productBrandSnapshot: string | null;
    productCategorySnapshot: string | null;
    productCostSnapshot: number | null;
    laboratorySnapshot: string | null;
    productTypeSnapshot: string | null;
    productLensIndexSnapshot: string | null;
    productUnitTypeSnapshot: string | null;
};

/**
 * Arma la foto del producto para grabar en un OrderItem.
 *
 * Precedencia: si hay producto en la BD (`dbProd`), manda el dato vivo del producto.
 * Si no hay producto, cae al `fallback` (lo que haya traído el canal de venta) y, en
 * última instancia, a null. El costo, si no hay producto, queda en null (no en 0) para
 * no ensuciar los reportes de margen.
 *
 * Spread-friendly: `{ ...snapshotFromProduct(dbProd), productNameSnapshot: 'otro' }`
 * permite pisar campos puntuales (lo usa el checkout web, que muestra el nombre del carrito).
 */
export function snapshotFromProduct(dbProd: SnapshotSource, fallback: SnapshotFallback = {}): ProductSnapshot {
    return {
        productNameSnapshot: dbProd ? (dbProd.model || dbProd.name || null) : (fallback.name ?? null),
        productBrandSnapshot: dbProd ? (dbProd.brand || null) : (fallback.brand ?? null),
        productCategorySnapshot: dbProd ? (dbProd.category || null) : (fallback.category ?? null),
        productCostSnapshot: dbProd ? (dbProd.cost ?? 0) : (fallback.cost ?? null),
        laboratorySnapshot: dbProd ? (dbProd.laboratory || null) : (fallback.laboratory ?? null),
        productTypeSnapshot: dbProd ? (dbProd.type || null) : (fallback.type ?? null),
        productLensIndexSnapshot: dbProd ? (dbProd.lensIndex || null) : (fallback.lensIndex ?? null),
        productUnitTypeSnapshot: dbProd ? (dbProd.unitType || null) : (fallback.unitType ?? null),
    };
}
