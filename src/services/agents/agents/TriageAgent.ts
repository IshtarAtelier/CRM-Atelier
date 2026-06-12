import { getModel } from "../model";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

export type Intent = 'REQUEST_QUOTE' | 'BOOK_APPOINTMENT' | 'ORDER_STATUS' | 'GENERAL_INQUIRY' | 'SUBMIT_PRESCRIPTION';

export class TriageAgent {
  static async classify(messagesContext: string): Promise<Intent> {
    const model = getModel(0); // low temperature for classification accuracy

    const systemPrompt = `Eres un agente de triaje inteligente para Atelier Óptica, una óptica boutique en Córdoba, Argentina.
Analiza la última consulta del cliente y todo el contexto de la conversación para determinar el propósito principal del usuario.

Clasifica la intención en una de las siguientes categorías exactas:
- REQUEST_QUOTE: El cliente pide precios, presupuestos de cristales, marcos o pregunta cuánto cuesta un producto.
- BOOK_APPOINTMENT: El cliente quiere agendar un turno para ver a un especialista, examen de vista o visitarnos.
- ORDER_STATUS: El cliente pregunta por el estado de su pedido o cuándo puede retirarlo.
- SUBMIT_PRESCRIPTION: El cliente envía una receta médica o indica que adjuntará una receta (ej: una foto de la receta).
- GENERAL_INQUIRY: Preguntas generales sobre ubicación, horarios, formas de pago, políticas de cambio, etc.

Tu respuesta debe ser únicamente una palabra correspondiente a la categoría elegida, en mayúsculas: "REQUEST_QUOTE", "BOOK_APPOINTMENT", "ORDER_STATUS", "SUBMIT_PRESCRIPTION", o "GENERAL_INQUIRY". No agregues explicaciones, puntuación ni bloques de código.`;

    try {
      const response = await model.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(`Historial/Mensaje del cliente:\n${messagesContext}`)
      ]);
      const intent = response.content.toString().trim() as Intent;
      
      const validIntents: Intent[] = ['REQUEST_QUOTE', 'BOOK_APPOINTMENT', 'ORDER_STATUS', 'GENERAL_INQUIRY', 'SUBMIT_PRESCRIPTION'];
      if (validIntents.includes(intent)) {
        return intent;
      }
      return 'GENERAL_INQUIRY';
    } catch (error) {
      console.error('[TriageAgent] Error:', error);
      return 'GENERAL_INQUIRY';
    }
  }
}
