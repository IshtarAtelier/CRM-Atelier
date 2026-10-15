-- Hora de RECEPCIÓN del servidor en cada mensaje de WhatsApp (15/10/2026).
--
-- createdAt de un entrante es la hora del teléfono del cliente (timestamp de
-- Meta) y la de un saliente es la nuestra: ordenar por createdAt mezcla dos
-- relojes. Una foto de receta que tardó en subirse quedaba "antes" de nuestra
-- burbuja ("Dale, espero tu recetita") y el bot decidía que no había nada sin
-- contestar: 13 casos reales en 30 días.
--
-- Escrita a MANO, aditiva e idempotente (corre en cada arranque del CRM y de
-- cada instancia del wa-service). Dos pasos A PROPÓSITO: con
-- `ADD COLUMN ... DEFAULT now()` Postgres les pondría a TODAS las filas viejas
-- la hora de la migración y quedarían como las más nuevas. Así quedan en NULL
-- y el código usa createdAt para ellas.
ALTER TABLE "WhatsAppMessage" ADD COLUMN IF NOT EXISTS "receivedAt" TIMESTAMP(3);
ALTER TABLE "WhatsAppMessage" ALTER COLUMN "receivedAt" SET DEFAULT CURRENT_TIMESTAMP;
