-- Módulos de laboratorio (src/services/lab-modules): el espejo de los pedidos
-- que ve cada portal y los borradores de carga con OK humano. Nace con Vitolen
-- (30/9/2026); Optovisión y Grupo Óptico siguen con sus integraciones.
--
-- Escrita a MANO, solo AGREGA y es idempotente: corre en cada arranque de las
-- dos instancias de Railway (migrate deploy) y el deploy viejo sigue andando
-- durante el rollout porque no toca ninguna tabla existente.

-- Un pedido tal como lo vio el portal la última vez. Es lo que permite
-- detectar ventas enviadas que nunca se cargaron y pedidos atrasados contra
-- la fecha que da el laboratorio, y escribir solo el nº de pedido en la venta.
CREATE TABLE IF NOT EXISTS "LabPortalOrder" (
    "id"            TEXT NOT NULL,
    "lab"           TEXT NOT NULL,
    "portalNumber"  TEXT NOT NULL,
    "internalRef"   TEXT,
    "orderId"       TEXT,
    "pair"          INTEGER,
    "statusRaw"     TEXT,
    "status"        TEXT NOT NULL DEFAULT 'DESCONOCIDO',
    "cliente"       TEXT,
    "enteredAt"     TIMESTAMP(3),
    "estimatedAt"   TIMESTAMP(3),
    "finishedAt"    TIMESTAMP(3),
    "dispatchedAt"  TIMESTAMP(3),
    "invoices"      JSONB,
    "raw"           JSONB,
    "firstSeenAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastChangeAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LabPortalOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LabPortalOrder_lab_portalNumber_key" ON "LabPortalOrder"("lab", "portalNumber");
CREATE INDEX IF NOT EXISTS "LabPortalOrder_orderId_idx" ON "LabPortalOrder"("orderId");
CREATE INDEX IF NOT EXISTS "LabPortalOrder_lab_status_idx" ON "LabPortalOrder"("lab", "status");
CREATE INDEX IF NOT EXISTS "LabPortalOrder_internalRef_idx" ON "LabPortalOrder"("internalRef");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LabPortalOrder_orderId_fkey') THEN
        ALTER TABLE "LabPortalOrder"
            ADD CONSTRAINT "LabPortalOrder_orderId_fkey"
            FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- La carga asistida: el robot arma y llena, una persona aprueba, el robot
-- confirma. `payload` es exactamente lo que se carga; `resumenPortal` y la
-- captura son lo que la persona aprobó.
CREATE TABLE IF NOT EXISTS "LabOrderDraft" (
    "id"                 TEXT NOT NULL,
    "lab"                TEXT NOT NULL,
    "orderId"            TEXT NOT NULL,
    "pair"               INTEGER NOT NULL DEFAULT 1,
    "status"             TEXT NOT NULL DEFAULT 'PREPARADO',
    "payload"            JSONB NOT NULL,
    "resumenPortal"      JSONB,
    "screenshotUrl"      TEXT,
    "screenshotFinalUrl" TEXT,
    "portalNumber"       TEXT,
    "preparedBy"         TEXT,
    "approvedBy"         TEXT,
    "approvedAt"         TIMESTAMP(3),
    "loadedAt"           TIMESTAMP(3),
    "error"              TEXT,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LabOrderDraft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LabOrderDraft_orderId_pair_idx" ON "LabOrderDraft"("orderId", "pair");
CREATE INDEX IF NOT EXISTS "LabOrderDraft_lab_status_idx" ON "LabOrderDraft"("lab", "status");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LabOrderDraft_orderId_fkey') THEN
        ALTER TABLE "LabOrderDraft"
            ADD CONSTRAINT "LabOrderDraft_orderId_fkey"
            FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
