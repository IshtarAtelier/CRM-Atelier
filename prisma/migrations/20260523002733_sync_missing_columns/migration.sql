-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_orderId_fkey";

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "metaLid" TEXT;

-- AlterTable
ALTER TABLE "FixedCost" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'FIJO';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "appliedPromoDiscount" DOUBLE PRECISION,
ADD COLUMN     "appliedPromoName" TEXT,
ADD COLUMN     "prescriptionSnapshot" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "crystalColor" TEXT,
ADD COLUMN     "crystalColorType" TEXT,
ADD COLUMN     "productBrandSnapshot" TEXT,
ADD COLUMN     "productCategorySnapshot" TEXT,
ADD COLUMN     "productNameSnapshot" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "ageGroup" TEXT,
ADD COLUMN     "bridgeWidth" INTEGER,
ADD COLUMN     "customSlug" TEXT,
ADD COLUMN     "frameHeight" INTEGER,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "imageProcessingStatus" TEXT DEFAULT 'IDLE',
ADD COLUMN     "imagenesCatalogo" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "lensWidth" INTEGER,
ADD COLUMN     "mpn" TEXT,
ADD COLUMN     "publishToWeb" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rawImageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoTags" TEXT,
ADD COLUMN     "seoTitle" TEXT,
ADD COLUMN     "templeLength" INTEGER;

-- AlterTable
ALTER TABLE "Tag" ADD COLUMN     "botAction" TEXT DEFAULT 'NONE',
ADD COLUMN     "notifyPhone" TEXT;

-- AlterTable
ALTER TABLE "WhatsAppChat" ADD COLUMN     "realPhone" TEXT;

-- AlterTable
ALTER TABLE "WhatsAppMessage" ADD COLUMN     "senderName" TEXT;

-- CreateTable
CREATE TABLE "WebProduct" (
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
CREATE TABLE "LaboratoryConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "calibrado" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "iva" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaboratoryConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "CheckoutSession" (
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
CREATE TABLE "BlogPost" (
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
CREATE TABLE "SocialContent" (
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
CREATE TABLE "CrystalColor" (
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
CREATE UNIQUE INDEX "WebProduct_slug_key" ON "WebProduct"("slug");

-- CreateIndex
CREATE INDEX "WebProduct_productId_idx" ON "WebProduct"("productId");

-- CreateIndex
CREATE INDEX "WebProduct_category_idx" ON "WebProduct"("category");

-- CreateIndex
CREATE UNIQUE INDEX "LaboratoryConfig_name_key" ON "LaboratoryConfig"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPost_slug_key" ON "BlogPost"("slug");

-- CreateIndex
CREATE INDEX "SocialContent_platform_idx" ON "SocialContent"("platform");

-- CreateIndex
CREATE INDEX "SocialContent_status_idx" ON "SocialContent"("status");

-- CreateIndex
CREATE INDEX "SocialContent_createdAt_idx" ON "SocialContent"("createdAt");

-- CreateIndex
CREATE INDEX "CrystalColor_category_active_idx" ON "CrystalColor"("category", "active");

-- CreateIndex
CREATE UNIQUE INDEX "CrystalColor_name_category_key" ON "CrystalColor"("name", "category");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebProduct" ADD CONSTRAINT "WebProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
