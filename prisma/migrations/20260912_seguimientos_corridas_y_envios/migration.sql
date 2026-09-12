-- Motor de seguimientos: registro de corridas y clave única por envío.
--
-- SeguimientoCorrida: una fila por tick (hora). Responde "¿corrió hoy? ¿a
-- cuántos evaluó, mandó, vetó, y por qué?" — antes solo existía como una
-- línea de log en Railway que nadie leía.
--
-- SeguimientoEnvio: una fila por envío automático, reclamada ANTES de mandar.
-- La clave única (chat + plantilla + día) hace imposible el doble envío aunque
-- el tick corra dos veces o lo corran dos instancias a la vez.
CREATE TABLE "SeguimientoCorrida" (
    "id" TEXT NOT NULL,
    "diaArt" TEXT NOT NULL,
    "horaArt" INTEGER NOT NULL,
    "modo" TEXT NOT NULL,
    "candidatos" INTEGER NOT NULL,
    "elegidos" INTEGER NOT NULL,
    "enviados" INTEGER NOT NULL,
    "fallidos" INTEGER NOT NULL,
    "enEspera" INTEGER NOT NULL,
    "cupoDiario" INTEGER NOT NULL,
    "usadoHoy" INTEGER NOT NULL,
    "vetados" JSONB NOT NULL,
    "detalle" JSONB,
    "error" TEXT,
    "duracionMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeguimientoCorrida_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SeguimientoCorrida_diaArt_idx" ON "SeguimientoCorrida"("diaArt");

CREATE TABLE "SeguimientoEnvio" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "clientId" TEXT,
    "plantilla" TEXT NOT NULL,
    "diaArt" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    "detalle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SeguimientoEnvio_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SeguimientoEnvio_chatId_plantilla_diaArt_key" ON "SeguimientoEnvio"("chatId", "plantilla", "diaArt");
CREATE INDEX "SeguimientoEnvio_diaArt_idx" ON "SeguimientoEnvio"("diaArt");
CREATE INDEX "SeguimientoEnvio_clientId_idx" ON "SeguimientoEnvio"("clientId");
