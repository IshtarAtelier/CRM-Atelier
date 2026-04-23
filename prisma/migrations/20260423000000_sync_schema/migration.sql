-- AlterTable
ALTER TABLE "ClientTask" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paid" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "deletedReason" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "botRecommended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "botLabel" TEXT;

-- AlterTable
ALTER TABLE "WhatsAppChat" ADD COLUMN IF NOT EXISTS "archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "chatLabels" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE IF NOT EXISTS "ServicePricing" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "priceCash" DOUBLE PRECISION NOT NULL,
    "priceCredit" DOUBLE PRECISION NOT NULL,
    "creditMonths" INTEGER NOT NULL DEFAULT 6,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ServicePricing_category_active_idx" ON "ServicePricing"("category", "active");
