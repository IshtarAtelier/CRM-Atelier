-- Qué Crizal lleva el par: elección obligatoria antes de enviar a fábrica
-- cuando la venta tiene cristales Optovisión con antirreflejo.
-- Valores: los `code` de src/lib/constants/crizal.ts.
ALTER TABLE "Order" ADD COLUMN "labCrizal" TEXT;
