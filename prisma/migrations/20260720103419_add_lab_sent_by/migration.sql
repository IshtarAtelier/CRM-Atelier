-- Registrar quién envió el pedido a fábrica (denormalizado, sobrevive rename/borrado)
ALTER TABLE "Order" ADD COLUMN "labSentBy" TEXT;
ALTER TABLE "Order" ADD COLUMN "labSentById" TEXT;
