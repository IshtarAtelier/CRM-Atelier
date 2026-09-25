-- Resolución MANUAL de una entrada de costo de laboratorio: quién la marcó,
-- cuándo y cómo se resolvió (reclamado al lab, acreditado, es correcto…).
-- Un hallazgo resuelto deja de salir en los avisos y en el reporte semanal
-- (Ishtar, 25/9/2026: "si no quedan eternamente duplicados").
--
-- Solo AGREGA columnas NULL-ables: ninguna columna existente se toca y el
-- deploy viejo sigue funcionando mientras rota.

ALTER TABLE "LabCostEntry"
    ADD COLUMN IF NOT EXISTS "resolvedAt"   TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "resolvedBy"   TEXT,
    ADD COLUMN IF NOT EXISTS "resolvedNote" TEXT;
