-- Blindaje de casos de post-venta: nunca se pierden.
-- El caso guarda su propio clientId + snapshot de la venta, y el orderId pasa a
-- ser opcional con ON DELETE SET NULL: si se hace hard-delete de la venta, el
-- caso sobrevive (queda huérfano de Order pero sigue ligado al cliente).

-- 1) El FK viejo borraba el caso en cascada al borrar la venta.
ALTER TABLE "PostSaleCase" DROP CONSTRAINT "PostSaleCase_orderId_fkey";

-- 2) Nuevas columnas + orderId opcional.
ALTER TABLE "PostSaleCase" ADD COLUMN "clientId" TEXT,
                           ADD COLUMN "orderLabel" TEXT,
                           ALTER COLUMN "orderId" DROP NOT NULL;

-- 3) Índice para consultar los casos por cliente (ficha).
CREATE INDEX "PostSaleCase_clientId_idx" ON "PostSaleCase"("clientId");

-- 4) Backfill del clientId de los casos existentes desde su venta.
UPDATE "PostSaleCase" psc
SET "clientId" = o."clientId"
FROM "Order" o
WHERE psc."orderId" = o."id" AND psc."clientId" IS NULL;

-- 5) FKs nuevos, ambos con SET NULL (nunca borran el caso).
ALTER TABLE "PostSaleCase" ADD CONSTRAINT "PostSaleCase_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PostSaleCase" ADD CONSTRAINT "PostSaleCase_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
