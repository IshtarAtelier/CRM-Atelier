-- Casilla de avisos propia por usuario. Si es NULL se usa la casilla
-- compartida del local (ver src/lib/vendor-email.ts). Editable desde
-- /admin/configuracion → Usuarios.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notificationEmail" TEXT;

-- Notas dirigidas: a quién va destinada la anotación de la ficha (se le avisa
-- por email). Denormalizado igual que userId/userName para que el historial
-- sobreviva a borrados/renombres de usuarios.
ALTER TABLE "Interaction" ADD COLUMN IF NOT EXISTS "directedToId" TEXT;
ALTER TABLE "Interaction" ADD COLUMN IF NOT EXISTS "directedToName" TEXT;

-- Estado actual del negocio: Ishtar recibe sus avisos en su casilla personal;
-- los vendedores quedan en NULL → casilla compartida del local.
UPDATE "User" SET "notificationEmail" = 'pisano.ishtar@gmail.com'
WHERE lower("email") = 'ishtar' AND "notificationEmail" IS NULL;
