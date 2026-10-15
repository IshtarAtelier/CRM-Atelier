-- El importe a reclamar al laboratorio que el cruce calcula (par bonificado
-- del 2x1 cobrado; 2º par de la promo de Vitolen por encima del 20 %) vivía
-- solo en la prosa de `notes` y el reporte lo releía con una regex: una nota
-- editada a mano lo perdía (auditoría de arquitectura 3, M5). Idempotente.
ALTER TABLE "LabCostEntry" ADD COLUMN IF NOT EXISTS "reclamo" DOUBLE PRECISION;
-- Y el motivo (PAR_BONIFICADO_2X1 | SEGUNDO_PAR_PROMO): el flag también salía de
-- la prosa de la nota (auditoría de arquitectura 4, M6).
ALTER TABLE "LabCostEntry" ADD COLUMN IF NOT EXISTS "reclamoMotivo" TEXT;
