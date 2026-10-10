-- El importe a reclamar al laboratorio que el cruce calcula (par bonificado
-- del 2x1 cobrado; 2º par de la promo de Vitolen por encima del 20 %) vivía
-- solo en la prosa de `notes` y el reporte lo releía con una regex: una nota
-- editada a mano lo perdía (auditoría de arquitectura 3, M5). Idempotente.
ALTER TABLE "LabCostEntry" ADD COLUMN IF NOT EXISTS "reclamo" DOUBLE PRECISION;
