-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_orderId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_clientId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_orderId_fkey";

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_userId_fkey";

-- AlterTable
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "createdBy" TEXT DEFAULT 'Sistema',
ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "labFrameDetails" TEXT,
ADD COLUMN IF NOT EXISTS "labFrameShape" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "diameterMax" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "diameterMin" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE IF NOT EXISTS "TeamMessage" (
    "id" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TeamMessage_createdAt_idx" ON "TeamMessage"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CashMovement_userId_idx" ON "CashMovement"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CheckoutSession_status_idx" ON "CheckoutSession"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Client_name_idx" ON "Client"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Client_phone_idx" ON "Client"("phone");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Client_createdAt_idx" ON "Client"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Client_dni_idx" ON "Client"("dni");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ClientTask_clientId_idx" ON "ClientTask"("clientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DoctorPayment_doctorId_idx" ON "DoctorPayment"("doctorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Interaction_clientId_idx" ON "Interaction"("clientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_orderId_idx" ON "Notification"("orderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_prescriptionId_idx" ON "Order"("prescriptionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_labStatus_idx" ON "Order"("labStatus");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Prescription_clientId_idx" ON "Prescription"("clientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_brand_idx" ON "Product"("brand");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_model_idx" ON "Product"("model");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_updatedAt_idx" ON "Product"("updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_category_idx" ON "Product"("category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WhatsAppChat_clientId_idx" ON "WhatsAppChat"("clientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WhatsAppChat_status_idx" ON "WhatsAppChat"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WhatsAppMessage_chatId_createdAt_idx" ON "WhatsAppMessage"("chatId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
