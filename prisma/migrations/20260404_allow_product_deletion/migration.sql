-- AlterTable: make productId optional in OrderItem to allow product deletion
ALTER TABLE "OrderItem" ALTER COLUMN "productId" DROP NOT NULL;

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_productId_fkey";

-- AddForeignKey with SET NULL on delete
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
