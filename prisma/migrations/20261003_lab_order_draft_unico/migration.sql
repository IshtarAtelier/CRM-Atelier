-- Carga asistida (src/services/lab-modules/carga): UN solo borrador vivo por
-- venta y par, garantizado por la base y no por un findFirst+create que dos
-- clicks simultáneos atraviesan juntos (auditoría del 3/10/2026, C2): dos
-- borradores vivos eran dos pedidos creados en el portal del laboratorio.
--
-- Escrita a MANO, idempotente, solo agrega un índice: el schema de Prisma no
-- puede expresar un índice único parcial y no necesita conocerlo.
CREATE UNIQUE INDEX IF NOT EXISTS "LabOrderDraft_vivo_key"
    ON "LabOrderDraft"("orderId", "pair")
    WHERE "status" IN ('PREPARADO', 'EN_REVISION', 'APROBADO');
