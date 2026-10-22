-- Por qué está apagado el bot en un chat, y quién corre su turno (15/10/2026).
--
-- botOffReason / botOffAt: el barrido que devuelve el bot a un chat "tomado
-- por una persona" decidía por la etiqueta [SISTEMA - BOT APAGADO], que nunca
-- se limpia y que ponían también el apagado manual del panel, la derivación,
-- los errores, el guardrail y el 429. Simulado contra producción: 17 de 44
-- chats recibían respuesta del bot, casi todos cierres ("gracias chicos!").
-- Ahora el motivo es explícito (wa-service/shared/motivo-apagado.js) y el
-- barrido solo actúa sobre TOMADO_POR_PERSONA. NULL = motivo desconocido →
-- el bot NO vuelve solo (los chats apagados antes de esta migración quedan así,
-- a propósito: conservador).
--
-- botTurnoHasta / botTurnoPor: lease por chat para que dos instancias del
-- wa-service no corran dos turnos a la vez (wa-service/shared/candado-de-turno.js).
--
-- Escrita a MANO, solo AGREGA columnas nullable y es idempotente: corre en cada
-- arranque de las dos instancias de Railway (migrate deploy).
ALTER TABLE "WhatsAppChat" ADD COLUMN IF NOT EXISTS "botOffReason" TEXT;
ALTER TABLE "WhatsAppChat" ADD COLUMN IF NOT EXISTS "botOffAt" TIMESTAMP(3);
ALTER TABLE "WhatsAppChat" ADD COLUMN IF NOT EXISTS "botTurnoHasta" TIMESTAMP(3);
ALTER TABLE "WhatsAppChat" ADD COLUMN IF NOT EXISTS "botTurnoPor" TEXT;
