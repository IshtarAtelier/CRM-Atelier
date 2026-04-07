-- AlterTable: Add SmartLab automation fields to Order
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "frameA" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "frameB" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "frameDbl" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "frameEdc" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "labPrismOD" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "labPrismOI" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "labBaseCurve" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "labFrameType" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "labBevelPosition" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "smartLabScreenshot" TEXT;

-- AlterTable: Add 2x1 flag to Product
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "is2x1" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add prism fields to Prescription
ALTER TABLE "Prescription" ADD COLUMN IF NOT EXISTS "prismOD" TEXT;
ALTER TABLE "Prescription" ADD COLUMN IF NOT EXISTS "prismOI" TEXT;

-- AlterTable: Make OrderItem.productId optional
ALTER TABLE "OrderItem" ALTER COLUMN "productId" DROP NOT NULL;

-- CreateTable: MonthlyTarget
CREATE TABLE IF NOT EXISTS "MonthlyTarget" (
    "id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "target1" DOUBLE PRECISION NOT NULL,
    "target2" DOUBLE PRECISION NOT NULL,
    "target3" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: MonthlyTarget unique index
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'MonthlyTarget_month_year_key') THEN
        CREATE UNIQUE INDEX "MonthlyTarget_month_year_key" ON "MonthlyTarget"("month", "year");
    END IF;
END $$;
