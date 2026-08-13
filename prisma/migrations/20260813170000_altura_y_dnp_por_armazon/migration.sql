-- Altura pupilar del segundo armazón (2x1): la altura varía según el armazón
-- elegido, así que cada par lleva la suya. La DNP es del cliente y queda en la
-- receta. Aditiva: columnas nulables.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "labHeightOD2" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "labHeightOI2" DOUBLE PRECISION;
