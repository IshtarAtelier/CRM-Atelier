-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "publishToWholesale" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_publishToWholesale_idx" ON "Product"("publishToWholesale");
