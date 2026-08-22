-- Endurecimiento del módulo de mensajería. SOLO agrega índices: ni un DROP.
-- (Escrita a mano: `prisma migrate diff` contra la base local arrastra
-- desfasaje viejo y genera DROPs que no pertenecen a este cambio.)

-- Los urgentes se consultan en CADA latido, cada 20 s y por pestaña abierta.
-- Sin este índice, cuando InternalMessage crezca Postgres abandona el bitmap
-- del OR y pasa a recorrer la tabla entera. Parcial (`WHERE urgent`): los
-- urgentes son una fracción mínima del total, así que el índice pesa casi nada.
CREATE INDEX IF NOT EXISTS "InternalMessage_urgent_fecha_idx"
    ON "InternalMessage"("createdAt" DESC) WHERE "urgent" = true;

-- Presencia: se consulta por rol + última señal de vida en cada latido.
CREATE INDEX IF NOT EXISTS "User_role_lastSeenAt_idx" ON "User"("role", "lastSeenAt");

-- El resumen diario cruza estas dos columnas y hoy no tienen índice. Son las
-- tablas más grandes del sistema y el cron las recorre por cada persona del
-- equipo, así que sin índice el reporte escala con el tamaño del histórico.
CREATE INDEX IF NOT EXISTS "Order_labSentById_labSentAt_idx" ON "Order"("labSentById", "labSentAt");
CREATE INDEX IF NOT EXISTS "ClientTask_completedBy_completedAt_idx" ON "ClientTask"("completedBy", "completedAt");
