-- Fecha de nacimiento del cliente: obligatoria para enviar pedidos a fábrica
-- (se valida en order.service.ts junto con el email).
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3);

-- Encargado de caja: ve el saldo total de la caja en efectivo aunque no sea
-- ADMIN. Editable desde /admin/configuracion → Usuarios.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cashManager" BOOLEAN NOT NULL DEFAULT false;
