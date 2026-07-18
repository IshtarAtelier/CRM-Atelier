-- Robustez del circuito de rendiciones:
-- Una sola rendición PENDIENTE por vendedor, garantizado por la base (no solo
-- por la app). Dos clicks simultáneos en "Registrar Entrega" ya no pueden crear
-- dos rendiciones que dupliquen los mismos cobros.
CREATE UNIQUE INDEX IF NOT EXISTS "CashHandover_one_pending_per_vendor"
ON "CashHandover" ("vendorId")
WHERE status = 'PENDING';
