-- Las conversaciones de WhatsApp no se borran nunca: son prueba de lo que se
-- habló con el cliente. La FK estaba en ON DELETE CASCADE, así que borrar un
-- chat (desde un script, Prisma Studio o código futuro) se llevaba todo su
-- historial de mensajes sin dejar rastro. Con RESTRICT la base rechaza ese
-- borrado mientras el chat tenga aunque sea un mensaje.
ALTER TABLE "WhatsAppMessage" DROP CONSTRAINT "WhatsAppMessage_chatId_fkey";

ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_chatId_fkey"
    FOREIGN KEY ("chatId") REFERENCES "WhatsAppChat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
