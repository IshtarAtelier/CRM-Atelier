-- Precio de oferta web ("precio tachado") en Product y alt-text por foto en WebProduct.
-- Aditivo y no bloqueante (columnas nuevas nullable / con default). Seguro en prod.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "salePrice" DOUBLE PRECISION;
ALTER TABLE "WebProduct" ADD COLUMN IF NOT EXISTS "imageAlts" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
