-- AlterTable
ALTER TABLE "WhatsAppChat" ADD COLUMN "botEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "specialDiscount" DOUBLE PRECISION DEFAULT 0;
