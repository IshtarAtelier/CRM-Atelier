-- Registro de CADA compra informada a Meta por el Conversions API.
--
-- Por qué (25/9/2026): el envío de la compra a Meta era fire-and-forget: un
-- fetch sin registro, sin reintento y sin event_id en la venta del local.
-- Además la venta del local viajaba con la fecha del PRESUPUESTO (createdAt),
-- y Meta rechaza todo evento con más de 7 días: cualquier venta cerrada sobre
-- un presupuesto de la semana anterior se perdía sin dejar rastro.
-- Esta tabla es la outbox: cada compra se anota ANTES de mandarse y el cron
-- /api/cron/meta-conversiones insiste hasta que Meta la acepte o venza la ventana.
--
-- Solo CREA una tabla nueva: el deploy viejo sigue funcionando mientras rota.

CREATE TABLE IF NOT EXISTS "MetaConversion" (
    "id"            TEXT NOT NULL,
    "orderId"       TEXT NOT NULL,
    "actionSource"  TEXT NOT NULL,
    "eventTime"     TIMESTAMP(3) NOT NULL,
    "value"         DOUBLE PRECISION NOT NULL,
    "currency"      TEXT NOT NULL DEFAULT 'ARS',
    "status"        TEXT NOT NULL DEFAULT 'PENDING',
    "attempts"      INTEGER NOT NULL DEFAULT 0,
    "lastError"     TEXT,
    "sentAt"        TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "alertedAt"     TIMESTAMP(3),
    "payload"       JSONB NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaConversion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MetaConversion_orderId_actionSource_key" ON "MetaConversion"("orderId", "actionSource");
CREATE INDEX IF NOT EXISTS "MetaConversion_status_nextAttemptAt_idx" ON "MetaConversion"("status", "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "MetaConversion_eventTime_idx" ON "MetaConversion"("eventTime");
