-- Para qué se usa cada cristal de la venta: LEJOS o CERCA (monofocales).
-- Null = el default de la receta. Ver src/lib/receta/graduacion-del-item.ts.
ALTER TABLE "OrderItem" ADD COLUMN "lensUse" TEXT;
