-- Costo del caso de post venta en dos etapas (estimado del vendedor → cerrado por
-- el laboratorio), corroboración del administrador e imputación a caja.
ALTER TABLE "PostSaleCase" ADD COLUMN "costEstimated" DOUBLE PRECISION;
ALTER TABLE "PostSaleCase" ADD COLUMN "costSource" TEXT;
ALTER TABLE "PostSaleCase" ADD COLUMN "costConfirmedAt" TIMESTAMP(3);
ALTER TABLE "PostSaleCase" ADD COLUMN "costConfirmedBy" TEXT;
ALTER TABLE "PostSaleCase" ADD COLUMN "faultUserId" TEXT;
ALTER TABLE "PostSaleCase" ADD COLUMN "cashEntryId" TEXT;

CREATE UNIQUE INDEX "PostSaleCase_cashEntryId_key" ON "PostSaleCase"("cashEntryId");

-- Los casos que ya tienen costo cargado vienen de la etapa manual: se los marca
-- como estimación para que el cruce con el laboratorio pueda cerrarlos.
UPDATE "PostSaleCase"
   SET "costSource" = 'MANUAL', "costEstimated" = "cost"
 WHERE "cost" > 0 AND "costSource" IS NULL;
