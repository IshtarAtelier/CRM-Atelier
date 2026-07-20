-- Alerta inmediata de hallazgos de conciliación de laboratorio: cuándo y con qué
-- estado se avisó cada entrada. Backfill: las filas existentes se marcan como ya
-- alertadas (los huérfanos históricos ya se informaron por email), así el primer
-- pase rápido solo alerta lo NUEVO y no manda un aluvión retroactivo.
ALTER TABLE "LabCostEntry" ADD COLUMN "alertedAt" TIMESTAMP(3);
ALTER TABLE "LabCostEntry" ADD COLUMN "alertedStatus" TEXT;

UPDATE "LabCostEntry"
SET "alertedAt" = CURRENT_TIMESTAMP, "alertedStatus" = "status"
WHERE "status" IN ('UNMATCHED', 'OVERCOST', 'UNDERCOST');
