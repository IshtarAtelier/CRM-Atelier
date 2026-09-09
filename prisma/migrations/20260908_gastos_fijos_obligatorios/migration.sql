-- Gastos fijos con identidad estable entre meses.
--
-- "clave" le da al concepto una identidad que sobrevive el cambio de mes, para
-- poder recrearlo todos los meses sin duplicarlo. "fuente" distingue lo que
-- carga una persona de lo que escribe el sistema (Meta, Google, suscripciones
-- en dólares, laboratorios). "obligatorio" marca los que no se pueden borrar.
ALTER TABLE "FixedCost" ADD COLUMN "clave" TEXT;
ALTER TABLE "FixedCost" ADD COLUMN "fuente" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "FixedCost" ADD COLUMN "obligatorio" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "FixedCost_clave_month_year_key" ON "FixedCost"("clave", "month", "year");
