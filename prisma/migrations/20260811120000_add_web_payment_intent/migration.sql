-- Intento de cobro de una pasarela externa (Mercado Pago Checkout Pro).
-- Ver el comentario del modelo WebPaymentIntent en schema.prisma para el porqué.
--
-- Solo CREA una tabla nueva: no toca ninguna columna existente, así que es
-- segura de aplicar con la versión anterior del código todavía corriendo.

-- CreateTable
CREATE TABLE "WebPaymentIntent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "gateway" TEXT NOT NULL DEFAULT 'MERCADO_PAGO',
    "preferenceId" TEXT,
    "paymentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "gatewayStatus" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "couponCode" TEXT,
    "checkoutContext" TEXT,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebPaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebPaymentIntent_preferenceId_key" ON "WebPaymentIntent"("preferenceId");

-- El candado que impide acreditar dos veces el mismo pago de Mercado Pago.
-- CreateIndex
CREATE UNIQUE INDEX "WebPaymentIntent_paymentId_key" ON "WebPaymentIntent"("paymentId");

-- CreateIndex
CREATE INDEX "WebPaymentIntent_orderId_idx" ON "WebPaymentIntent"("orderId");

-- CreateIndex
CREATE INDEX "WebPaymentIntent_status_idx" ON "WebPaymentIntent"("status");

-- CreateIndex
CREATE INDEX "WebPaymentIntent_createdAt_idx" ON "WebPaymentIntent"("createdAt");

-- AddForeignKey
ALTER TABLE "WebPaymentIntent" ADD CONSTRAINT "WebPaymentIntent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
