-- Confirmación del cliente al repaso de su pedido (OK / TACITA / OBSERVACION).
ALTER TABLE "Order" ADD COLUMN "clientConfirmation" TEXT;
ALTER TABLE "Order" ADD COLUMN "clientConfirmedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "clientConfirmationText" TEXT;
