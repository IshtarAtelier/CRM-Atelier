-- Imagen adjunta en notas del historial del cliente y en observaciones de post-venta
ALTER TABLE "Interaction" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "PostSaleNote" ADD COLUMN "imageUrl" TEXT;
