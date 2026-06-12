import { getModel } from "../model";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { QuoteResponse } from "./QuoteAgent";

export class SalesAgent {
  /**
   * Genera el mensaje de ventas altamente persuasivo y optimizado para conversión.
   */
  static async generateSalesPitch(
    clientName: string,
    quoteData: QuoteResponse,
    userQuery: string
  ): Promise<string> {
    const model = getModel(0.7); // Mayor temperatura para fluidez y naturalidad en el lenguaje

    const systemPrompt = `Eres un asesor de ventas de élite para Atelier Óptica, una exclusiva óptica boutique en el Cerro de las Rosas, Córdoba, Argentina.
Tu objetivo es redactar un mensaje de respuesta al cliente que sea sumamente persuasivo, elegante, empático y orientado a la conversión.

DATOS DEL PRESUPUESTO:
${JSON.stringify(quoteData, null, 2)}

CLIENTE: ${clientName}
PREGUNTA ORIGINAL DEL CLIENTE: "${userQuery}"

REGLAS DE COMUNICACIÓN Y REDACCIÓN (RETRODIRECTIVAS):
1. **Veracidad Absoluta de Precios:** Revisa que los precios y cuotas que menciones coincidan EXACTAMENTE con los provistos en los datos del presupuesto. No inventes montos, no agregues cargos extras y no supongas precios.
2. **Tono Cordobés/Argentino Cálido y Profesional:** Usa un tono amable, cercano y profesional. Llámalos de "vos" (tuteo rioplatense natural). Evita sonar rígido o corporativo.
3. **Estructura Clara y Limpia:** Usa emojis de forma sobria (por ejemplo: 👓, ✨, 💳, 📍). Organiza la información con viñetas claras para que sea fácil de leer en WhatsApp o web.
4. **Llamados a la Acción (CTAs) Fuertes:**
   - Si se presentan opciones de precios, invita a la acción sugiriendo: "Cotizar/confirmar el pedido por WhatsApp" o "Reservar un turno para probar los marcos".
   - Recuerda los beneficios clave: 6 cuotas sin interés con tarjeta, o 15% de descuento por transferencia/efectivo.
   - Ejemplo de cierre efectivo: "¡Si querés avanzar con alguna de las opciones, avisame y te armo el link de pago o te agendo un turno!"
5. **Autoverificación Obligatoria:** Antes de finalizar el texto, realiza mentalmente una comparación entre los números escritos en tu mensaje y el JSON del presupuesto. Deben ser idénticos.

Escribe el mensaje directamente como respuesta lista para enviar al cliente.`;

    try {
      const response = await model.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage("Por favor redacta la respuesta de venta.")
      ]);

      const pitch = response.content.toString().trim();
      
      // Validar precios numéricos generados en el pitch para evitar alucinaciones
      this.validatePricesOrThrow(pitch, quoteData);

      return pitch;
    } catch (error: any) {
      console.error('[SalesAgent] Error generating sales pitch or validation failed:', error.message);
      return `Hola ${clientName}, gracias por contactarte. Un asesor de nuestro equipo del Cerro de las Rosas está preparando el presupuesto detallado con las mejores opciones y promociones para vos. Te escribimos en unos minutos para pasarte todo detallado. ¡Muchas gracias por tu paciencia!`;
    }
  }

  /**
   * Extrae los números del pitch y verifica que correspondan a valores reales del presupuesto.
   * Lanza un error si detecta un precio inventado (alucinación) mayor a 999 que no exista en el presupuesto.
   */
  private static validatePricesOrThrow(pitch: string, quoteData: QuoteResponse): void {
    if (!quoteData.options || quoteData.options.length === 0) return;

    // Recolectar todos los precios válidos del presupuesto (redondeados a enteros)
    const validPrices = new Set<number>();
    for (const opt of quoteData.options) {
      validPrices.add(Math.round(opt.originalPrice));
      validPrices.add(Math.round(opt.cashPrice));
      validPrices.add(Math.round(opt.transferPrice));
      validPrices.add(Math.round(opt.installments3));
      validPrices.add(Math.round(opt.installments6));
    }

    // Buscar números que parezcan precios en el texto
    // Ej: $120.000, 120000, 15.500, etc.
    const priceRegex = /\b\d{1,3}(?:\.\d{3})+|\b\d{4,6}/g;
    const matches = pitch.match(priceRegex) || [];

    for (const match of matches) {
      // Normalizar quitando puntos para obtener el número puro (ej: "120.000" -> 120000)
      const numberVal = parseInt(match.replace(/\./g, ''), 10);
      if (isNaN(numberVal)) continue;

      // Omitir números que coincidan con la dirección local (4380) o años
      if (numberVal === 4380 || numberVal === 2026) continue;

      // Si es un número grande (precio) y no coincide con ningún precio del JSON, es una alucinación
      if (numberVal > 999 && !validPrices.has(numberVal)) {
        // Permitir un margen de tolerancia menor de +/- 2 pesos por redondeos
        let matchFound = false;
        for (const vp of validPrices) {
          if (Math.abs(vp - numberVal) <= 2) {
            matchFound = true;
            break;
          }
        }
        if (!matchFound) {
          throw new Error(`Precio alucinado detectado en el pitch: ${numberVal}. No existe en el presupuesto.`);
        }
      }
    }
  }
}
