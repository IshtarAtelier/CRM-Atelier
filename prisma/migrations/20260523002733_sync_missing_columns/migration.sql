-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_orderId_fkey";
ALTER TABLE "Notification" DROP CONSTRAINT IF EXISTS "Notification_orderId_fkey";
ALTER TABLE "Notification" DROP CONSTRAINT IF EXISTS "Notification_requestedBy_fkey";
ALTER TABLE "WebProduct" DROP CONSTRAINT IF EXISTS "WebProduct_productId_fkey";

-- AlterTable
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "metaLid" TEXT;

-- AlterTable
ALTER TABLE "FixedCost" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'FIJO';

-- AlterTable
ALTER TABLE "Order" 
  ADD COLUMN IF NOT EXISTS "appliedPromoDiscount" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "appliedPromoName" TEXT,
  ADD COLUMN IF NOT EXISTS "prescriptionSnapshot" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" 
  ADD COLUMN IF NOT EXISTS "crystalColor" TEXT,
  ADD COLUMN IF NOT EXISTS "crystalColorType" TEXT,
  ADD COLUMN IF NOT EXISTS "productBrandSnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "productCategorySnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "productNameSnapshot" TEXT;

-- AlterTable
ALTER TABLE "Product" 
  ADD COLUMN IF NOT EXISTS "ageGroup" TEXT,
  ADD COLUMN IF NOT EXISTS "bridgeWidth" INTEGER,
  ADD COLUMN IF NOT EXISTS "customSlug" TEXT,
  ADD COLUMN IF NOT EXISTS "frameHeight" INTEGER,
  ADD COLUMN IF NOT EXISTS "gender" TEXT,
  ADD COLUMN IF NOT EXISTS "imageProcessingStatus" TEXT DEFAULT 'IDLE',
  ADD COLUMN IF NOT EXISTS "imagenesCatalogo" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "lensWidth" INTEGER,
  ADD COLUMN IF NOT EXISTS "mpn" TEXT,
  ADD COLUMN IF NOT EXISTS "publishToWeb" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "rawImageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "seoDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "seoTags" TEXT,
  ADD COLUMN IF NOT EXISTS "seoTitle" TEXT,
  ADD COLUMN IF NOT EXISTS "templeLength" INTEGER;

-- AlterTable
ALTER TABLE "Tag" 
  ADD COLUMN IF NOT EXISTS "botAction" TEXT DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "notifyPhone" TEXT;

-- AlterTable
ALTER TABLE "WhatsAppChat" 
  ADD COLUMN IF NOT EXISTS "realPhone" TEXT;

-- AlterTable
ALTER TABLE "WhatsAppMessage" 
  ADD COLUMN IF NOT EXISTS "senderName" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "WebProduct" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LaboratoryConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "calibrado" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "iva" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaboratoryConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CheckoutSession" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "cartData" JSONB NOT NULL,
    "shippingData" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BlogPost" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "content" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT NOT NULL,
    "imageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SocialContent" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceName" TEXT,
    "copy" TEXT NOT NULL,
    "hashtags" TEXT,
    "cta" TEXT,
    "imageUrl" TEXT,
    "imagePrompt" TEXT,
    "publishTips" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CrystalColor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'COMPACTO',
    "hexColor" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrystalColor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WebProduct_slug_key" ON "WebProduct"("slug");
CREATE INDEX IF NOT EXISTS "WebProduct_productId_idx" ON "WebProduct"("productId");
CREATE INDEX IF NOT EXISTS "WebProduct_category_idx" ON "WebProduct"("category");
CREATE UNIQUE INDEX IF NOT EXISTS "LaboratoryConfig_name_key" ON "LaboratoryConfig"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "BlogPost_slug_key" ON "BlogPost"("slug");
CREATE INDEX IF NOT EXISTS "SocialContent_platform_idx" ON "SocialContent"("platform");
CREATE INDEX IF NOT EXISTS "SocialContent_status_idx" ON "SocialContent"("status");
CREATE INDEX IF NOT EXISTS "SocialContent_createdAt_idx" ON "SocialContent"("createdAt");
CREATE INDEX IF NOT EXISTS "CrystalColor_category_active_idx" ON "CrystalColor"("category", "active");
CREATE UNIQUE INDEX IF NOT EXISTS "CrystalColor_name_category_key" ON "CrystalColor"("name", "category");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WebProduct" ADD CONSTRAINT "WebProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
