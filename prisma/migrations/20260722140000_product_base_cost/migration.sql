-- Costo "pelado" (lista del laboratorio, sin calibrado ni IVA).
-- `cost` sigue siendo el costo final; este campo guarda de dónde salió para poder
-- recalcular sin volver a aplicar la fórmula sobre un costo que ya la tenía aplicada.
ALTER TABLE "Product" ADD COLUMN "baseCost" DOUBLE PRECISION;
