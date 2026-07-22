-- Cuenta corriente del laboratorio según su resumen de cuenta oficial
-- (Optovision/Essilor "Documentos Pendientes"). Un snapshot por resumen recibido.

-- CreateTable
CREATE TABLE "LabAccountStatement" (
    "id" TEXT NOT NULL,
    "lab" TEXT NOT NULL,
    "statementDate" TIMESTAMP(3) NOT NULL,
    "totalDebt" DOUBLE PRECISION NOT NULL,
    "invoiceCount" INTEGER NOT NULL DEFAULT 0,
    "rows" JSONB NOT NULL,
    "sourceFile" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabAccountStatement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LabAccountStatement_lab_statementDate_idx" ON "LabAccountStatement"("lab", "statementDate");

-- CreateIndex
CREATE INDEX "LabAccountStatement_createdAt_idx" ON "LabAccountStatement"("createdAt");
