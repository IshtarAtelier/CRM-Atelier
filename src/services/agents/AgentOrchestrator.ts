import { prisma } from "@/lib/db";
import { TriageAgent, Intent } from "./agents/TriageAgent";
import { OcrAgent, PrescriptionData } from "./agents/OcrAgent";
import { QuoteAgent, QuoteResponse } from "./agents/QuoteAgent";
import { SalesAgent } from "./agents/SalesAgent";
import { getModel } from "./model";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { BUSINESS_INFO, PROMOS_TEXT } from "@/lib/business-info";

export interface OrchestratorResult {
  intent: Intent;
  replyText: string;
  extractedData?: PrescriptionData | null;
  quoteData?: QuoteResponse | null;
}

export class AgentOrchestrator {
  /**
   * Procesa un mensaje entrante o un historial de chat de un cliente y devuelve la mejor respuesta del sistema de agentes.
   * @param clientId ID del cliente en la base de datos
   * @param incomingMessage Opcional. Último mensaje recibido
   * @param base64Image Opcional. Imagen adjunta en formato base64
   */
  static async processClientMessage(
    clientId: string,
    incomingMessage?: string,
    base64Image?: string
  ): Promise<OrchestratorResult> {
    try {
      // 1. Cargar historial de chat si existe
      const dbMessages = await prisma.whatsAppMessage.findMany({
        where: {
          chat: {
            clientId: clientId
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 15 // Optimización de tokens: solo tomamos las últimas 15 interacciones
      });

      const reversedMessages = dbMessages.reverse();
      let conversationContext = reversedMessages
        .map(m => `${m.direction === 'INBOUND' ? 'Cliente' : 'Asistente'}: ${m.content}`)
        .join('\n');

      if (incomingMessage) {
        conversationContext += `\nCliente: ${incomingMessage}`;
      }

      // Si no hay contexto ni mensaje entrante, lanzar error
      if (!conversationContext.trim() && !base64Image) {
        throw new Error("No hay suficiente contexto de conversación para procesar.");
      }

      // Obtener el nombre del cliente
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        include: { tags: true }
      });

      // Si el cliente es un proveedor o tiene la etiqueta Cancelar Bot, silenciar y apagar el asistente permanentemente
      const isProveedor = client?.tags.some((t: any) => t.name.toLowerCase() === 'proveedor');
      const isCanceled = client?.tags.some((t: any) => t.name.toLowerCase() === 'cancelar bot');
      
      if (isProveedor || isCanceled) {
        await prisma.whatsAppChat.updateMany({
          where: { clientId: clientId },
          data: { botEnabled: false }
        });
        return { intent: 'GENERAL_INQUIRY', replyText: "" };
      }

      const clientName = client?.name || "Cliente";

      // 2. Ejecutar TriageAgent para determinar la intención del usuario
      let intent: Intent = 'GENERAL_INQUIRY';
      if (base64Image) {
        intent = 'SUBMIT_PRESCRIPTION';
      } else {
        intent = await TriageAgent.classify(conversationContext);
      }

      let extractedData: PrescriptionData | null = null;
      let quoteData: QuoteResponse | null = null;
      let replyText = "";

      // 3. Ejecutar sub-agentes basados en la intención
      if (intent === 'SUBMIT_PRESCRIPTION' && base64Image) {
        // Ejecutar OcrAgent para leer la receta
        extractedData = await OcrAgent.extractPrescription(base64Image);
        
        if (extractedData && Object.keys(extractedData).length > 0) {
          // Si extrajo datos con éxito, generar una cotización automáticamente
          quoteData = await QuoteAgent.generateQuote({
            prescription: extractedData,
            userQuery: incomingMessage
          });
          
          if (quoteData && !quoteData.requiresReview) {
            replyText = await SalesAgent.generateSalesPitch(clientName, quoteData, "Me leés esta receta por favor y me decís el precio?");
          } else {
            replyText = `¡Hola ${clientName}! Pudimos leer tu receta de forma automática, pero por seguridad, un asesor de nuestro equipo del Cerro de las Rosas está revisando los detalles para confirmarte el presupuesto exacto. ¡Te escribimos en unos minutos!`;
          }
        } else {
          replyText = `Hola ${clientName}, recibimos la imagen de tu receta pero no pudimos leerla con nitidez. ¿Podrías enviarnos una foto con mejor enfoque o con luz natural? ¡Muchas gracias!`;
        }

      } else if (intent === 'REQUEST_QUOTE') {
        // Es una solicitud de presupuesto por texto
        quoteData = await QuoteAgent.generateQuote({
          userQuery: incomingMessage || (dbMessages.length > 0 ? dbMessages[dbMessages.length - 1].content : "")
        });

        if (quoteData && !quoteData.requiresReview) {
          replyText = await SalesAgent.generateSalesPitch(clientName, quoteData, incomingMessage || "");
        } else {
          replyText = `Hola ${clientName}, vi que consultás por un presupuesto. Para pasarte el valor exacto y las mejores opciones de cristales, ¿nos podrías indicar qué tipo de lente buscás (Monofocal o Multifocal) o enviarnos una foto de tu receta?`;
        }

      } else if (intent === 'BOOK_APPOINTMENT') {
        replyText = `¡Hola ${clientName}! Claro, con gusto te agendamos un turno para que te atiendan nuestros profesionales en el local de ${BUSINESS_INFO.address}. ¿Te queda cómodo algún día de esta semana ${BUSINESS_INFO.appointmentSlots}?`;

      } else if (intent === 'ORDER_STATUS') {
        // Buscar pedidos activos del cliente
        const activeOrder = await prisma.order.findFirst({
          where: {
            clientId: clientId,
            status: { notIn: ['ENTREGADO', 'CANCELADO'] }
          },
          orderBy: { createdAt: 'desc' }
        });

        if (activeOrder) {
          replyText = `Hola ${clientName}, tu pedido de anteojos se encuentra actualmente en estado: *${activeOrder.status}*. Te avisaremos de forma automática a este chat apenas esté listo para retirar en nuestra sucursal de ${BUSINESS_INFO.address}.`;
        } else {
          replyText = `Hola ${clientName}, no encuentro ningún pedido pendiente de entrega a tu nombre en este momento. Si realizaste una compra recientemente, pasame el número de orden o aguardanos un momento que lo consulto con administración.`;
        }

      } else {
        // GENERAL_INQUIRY
        const model = getModel(0.5);
        const systemPrompt = `Eres un asistente automatizado para la atención al cliente de ${BUSINESS_INFO.name} (${BUSINESS_INFO.address}).
Responde de forma muy cortés, breve y natural a la consulta del cliente.

DATOS CLAVE DE ATELIER:
- Dirección: ${BUSINESS_INFO.address}.
- Horarios: ${BUSINESS_INFO.hours}.
- Teléfono/WhatsApp: ${BUSINESS_INFO.phone}.
- Promociones: ${PROMOS_TEXT}.

REGLAS:
- Mantén la respuesta en menos de 3 o 4 oraciones.
- Invita cordialmente al usuario a consultarnos cualquier duda o visitarnos.
- Responde de "vos" (español de Argentina).`;

        const response = await model.invoke([
          new SystemMessage(systemPrompt),
          new HumanMessage(conversationContext)
        ]);
        replyText = response.content.toString().trim();
      }

      return {
        intent,
        replyText,
        extractedData,
        quoteData
      };

    } catch (error: any) {
      console.error('[AgentOrchestrator] Error:', error.message);
      return {
        intent: 'GENERAL_INQUIRY',
        replyText: `Hola, disculpas por la demora. Tuvimos un pequeño inconveniente técnico al procesar tu consulta, pero en unos minutos un asesor humano de nuestro equipo te va a responder por este mismo canal. ¡Gracias!`
      };
    }
  }
}
