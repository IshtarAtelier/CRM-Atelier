-- Pausa persistente de seguimientos por chat, decidida por la compuerta de
-- conversación ("hablamos a fin de mes", pregunta sin responder). Antes el
-- veredicto no se guardaba: el cron de inactividad re-consultaba al LLM cada
-- 15 minutos y las postergaciones se perdían en cada reinicio.
ALTER TABLE "WhatsAppChat" ADD COLUMN "followUpPausedUntil" TIMESTAMP(3);
