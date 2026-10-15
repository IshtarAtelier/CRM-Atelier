-- Planta permanente del local: quiénes figuran en feriados y calendario del
-- equipo (Ishtar, 8/10/2026). Idempotente, solo agrega una columna con default.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "plantaLocal" BOOLEAN NOT NULL DEFAULT false;
