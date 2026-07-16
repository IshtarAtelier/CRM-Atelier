-- El AuditLog no debe depender de que el usuario siga existiendo: con la FK,
-- un insert con userId de un usuario borrado (o un borrado de usuario con
-- logs históricos) fallaba o exigía poner los logs en null. Se elimina la
-- constraint; userId queda como referencia suelta y userName ya preserva
-- el nombre denormalizado.
ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_userId_fkey";
