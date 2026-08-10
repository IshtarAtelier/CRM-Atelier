-- Carrito abandonado multi-toque.
--
-- Hasta ahora el recupero era UN mail a las 24hs y listo. Ahora hay dos toques
-- (uno a la hora, otro a las 24hs, este último por WhatsApp si el cliente ya
-- tiene chat con mensajes entrantes) y hace falta saber por cuál va cada
-- carrito.
--
-- Va en columnas nuevas y NO en `status` porque `status` es el ciclo de vida de
-- la sesión (PENDING / EMAIL_SENT / RECOVERED / COMPLETED / ABANDONED /
-- FINALIZED) y lo leen el panel de Oportunidades de Cierre y el de analítica:
-- si el toque de la hora lo moviera, el carrito le desaparecería a la vendedora
-- una hora después de abandonado.
--
-- `recoveryStage`: 0 = sin tocar · 1 = toque temprano (~1h) · 2 = toque de 24hs.
--   Se marca ANTES de enviar, con un UPDATE condicional (`recoveryStage < N`),
--   así dos corridas del cron no pueden mandar el mismo toque dos veces.
-- `recoveryTouchAt`: cuándo se reclamó el último toque.
-- `recoveryChannel`: 'EMAIL' o 'WHATSAPP'.
--
-- Los carritos existentes arrancan en 0: los que ya recibieron el mail viejo
-- tienen status 'EMAIL_SENT' y el cron solo mira los 'PENDING', así que nadie
-- recibe un mail repetido por este cambio.
ALTER TABLE "CheckoutSession" ADD COLUMN IF NOT EXISTS "recoveryStage" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CheckoutSession" ADD COLUMN IF NOT EXISTS "recoveryTouchAt" TIMESTAMP(3);
ALTER TABLE "CheckoutSession" ADD COLUMN IF NOT EXISTS "recoveryChannel" TEXT;

-- El cron busca por estado + etapa dentro de una ventana de tiempo.
CREATE INDEX IF NOT EXISTS "CheckoutSession_status_recoveryStage_idx" ON "CheckoutSession"("status", "recoveryStage");
