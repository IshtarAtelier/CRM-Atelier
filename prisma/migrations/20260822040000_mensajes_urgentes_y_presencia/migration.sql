-- Mensajes urgentes (tapan la pantalla hasta que se leen) y presencia en línea.
--
-- SOLO AGREGA COLUMNAS. Ni un DROP: el `prisma migrate diff` contra la base
-- local arrastra desfasaje viejo (un DROP de 6 columnas de Order y un DROP de
-- la tabla DailyAuditRun) que no pertenece a este cambio y que en producción
-- borraría datos reales. Escrito a mano por eso.

-- AddColumn: marca de urgencia del mensaje
ALTER TABLE "InternalMessage" ADD COLUMN "urgent" BOOLEAN NOT NULL DEFAULT false;

-- AddColumn: última señal de vida del usuario (puntito verde de "en línea")
ALTER TABLE "User" ADD COLUMN "lastSeenAt" TIMESTAMP(3);

-- El pop-up de urgentes consulta "mis mensajes urgentes sin leer" en cada
-- latido y por cada pestaña abierta. Sin este índice sería un recorrido de toda
-- la tabla de mensajes cada 20 segundos. Parcial: solo indexa los urgentes, que
-- son un puñado, en vez de cargar con todos los mensajes normales.
CREATE INDEX "InternalMessage_urgentes_idx" ON "InternalMessage"("threadId", "createdAt" DESC) WHERE "urgent" = true;
