ALTER TABLE "Order" ADD COLUMN "smartLabSector" TEXT;
ALTER TABLE "Order" ADD COLUMN "smartLabProgress" INTEGER;
ALTER TABLE "Order" ADD COLUMN "smartLabLastSync" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "smartLabDetails" TEXT;
ALTER TABLE "Order" ADD COLUMN "smartLabDays" INTEGER;
