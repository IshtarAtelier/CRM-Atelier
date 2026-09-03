-- Celular del colaborador para la copia por WhatsApp de notas y mensajes
-- internos. Hasta hoy los teléfonos del staff eran constantes en el código
-- (src/lib/constants.ts): un dato de usuario vivía en un archivo. Null = esa
-- persona no recibe copia; se carga desde /admin/configuracion → Usuarios.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "whatsappPhone" TEXT;
