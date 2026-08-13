-- Un armazón por par de cristales. Antes solo entraban dos (columnas fijas del
-- pedido); ahora son filas, así un pedido de 4 pares tiene 4 armazones.
CREATE TABLE IF NOT EXISTS "OrderFrame" (
    "id"        TEXT NOT NULL,
    "orderId"   TEXT NOT NULL,
    "position"  INTEGER NOT NULL,
    "shape"     TEXT,
    "a"         TEXT,
    "b"         TEXT,
    "dbl"       TEXT,
    "edc"       TEXT,
    "details"   TEXT,
    "imageUrl"  TEXT,
    "heightOD"  DOUBLE PRECISION,
    "heightOI"  DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrderFrame_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrderFrame_orderId_position_key" ON "OrderFrame"("orderId", "position");
CREATE INDEX IF NOT EXISTS "OrderFrame_orderId_idx" ON "OrderFrame"("orderId");

DO $$ BEGIN
    ALTER TABLE "OrderFrame" ADD CONSTRAINT "OrderFrame_orderId_fkey"
        FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Backfill: lo ya cargado en las columnas viejas pasa a ser el armazón 1 y 2.
INSERT INTO "OrderFrame" ("id", "orderId", "position", "shape", "a", "b", "dbl", "edc", "details", "imageUrl", "heightOD", "heightOI", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, o."id", 1, o."labFrameShape", o."frameA", o."frameB", o."frameDbl", o."frameEdc", o."labFrameDetails", o."frameImageUrl", o."labHeightOD", o."labHeightOI", NOW(), NOW()
FROM "Order" o
WHERE COALESCE(o."labFrameShape", o."frameA", o."frameB", o."frameDbl", o."frameEdc", o."labFrameDetails", o."frameImageUrl") IS NOT NULL
   OR o."labHeightOD" IS NOT NULL OR o."labHeightOI" IS NOT NULL
ON CONFLICT ("orderId", "position") DO NOTHING;

INSERT INTO "OrderFrame" ("id", "orderId", "position", "shape", "a", "b", "dbl", "edc", "details", "imageUrl", "heightOD", "heightOI", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, o."id", 2, o."labFrameShape2", o."frameA2", o."frameB2", o."frameDbl2", o."frameEdc2", o."labFrameDetails2", o."frameImageUrl2", o."labHeightOD2", o."labHeightOI2", NOW(), NOW()
FROM "Order" o
WHERE COALESCE(o."labFrameShape2", o."frameA2", o."frameB2", o."frameDbl2", o."frameEdc2", o."labFrameDetails2", o."frameImageUrl2") IS NOT NULL
   OR o."labHeightOD2" IS NOT NULL OR o."labHeightOI2" IS NOT NULL
ON CONFLICT ("orderId", "position") DO NOTHING;
