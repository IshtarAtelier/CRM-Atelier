-- Marca definitiva de "ya no es oportunidad de cierre" para clientes favoritos
-- sin actividad. Antes, el check de finalizar seguimiento solo tocaba
-- updatedAt, así que el cliente volvía a aparecer a los 3 días si seguía
-- sin actividad. Ahora queda descartado para siempre, igual que ya pasaba
-- con presupuestos (status LOST) y carritos abandonados (status FINALIZED).
ALTER TABLE "Client" ADD COLUMN "opportunityDismissedAt" TIMESTAMP(3);
