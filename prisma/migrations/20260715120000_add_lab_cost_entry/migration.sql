-- Conciliación de costos de laboratorio: costo facturado por el lab (por nº de
-- pedido) vs. costo de lista del CRM. Una fila por (lab, labOrderNumber).

-- CreateTable
CREATE TABLE "LabCostEntry" (
    "id" TEXT NOT NULL,
    "lab" TEXT NOT NULL,
    "labOrderNumber" TEXT NOT NULL,
    "orderId" TEXT,
    "systemCost" DOUBLE PRECISION,
    "billedNet" DOUBLE PRECISION,
    "billedTotal" DOUBLE PRECISION,
    "difference" DOUBLE PRECISION,
    "source" TEXT NOT NULL,
    "sourceFile" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'UNMATCHED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabCostEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LabCostEntry_lab_labOrderNumber_key" ON "LabCostEntry"("lab", "labOrderNumber");

-- CreateIndex
CREATE INDEX "LabCostEntry_status_idx" ON "LabCostEntry"("status");

-- CreateIndex
CREATE INDEX "LabCostEntry_orderId_idx" ON "LabCostEntry"("orderId");

-- CreateIndex
CREATE INDEX "LabCostEntry_createdAt_idx" ON "LabCostEntry"("createdAt");

-- AddForeignKey
ALTER TABLE "LabCostEntry" ADD CONSTRAINT "LabCostEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
