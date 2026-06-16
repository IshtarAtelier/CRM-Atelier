import { getModel } from "../model";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { prisma } from "@/lib/db";
import { PricingService, CartItem } from "@/services/PricingService";
import { PrescriptionData } from "./OcrAgent";

export interface QuoteRequest {
  prescription?: PrescriptionData;
  userQuery?: string;
  frameId?: string;
}

interface QuoteOption {
  name: string;
  description: string;
  originalPrice: number;
  cashPrice: number;
  transferPrice: number;
  installments3: number;
  installments6: number;
}

export interface QuoteResponse {
  options: QuoteOption[];
  requiresReview: boolean;
  reviewReason?: string;
}

export class QuoteAgent {
  /**
   * Genera opciones de presupuesto a partir de los datos de la receta o de la consulta del usuario.
   */
  static async generateQuote(request: QuoteRequest): Promise<QuoteResponse> {
    try {
      // 1. Determinar el tipo de lente (Monofocal, Bifocal, Multifocal)
      let detectedType = request.prescription?.tipoLente || "";
      
      if (!detectedType && request.userQuery) {
        // Intentar deducir del texto usando el LLM
        detectedType = await this.deduceLensType(request.userQuery);
      }

      // Si no se detecta ningún tipo de lente, marcar para revisión humana
      if (!detectedType) {
        return {
          options: [],
          requiresReview: true,
          reviewReason: "No se pudo determinar el tipo de lente requerido (Monofocal, Bifocal, Multifocal)."
        };
      }

      // 2. Buscar en la base de datos los productos (Cristales) correspondientes
      const categoryMapping: Record<string, string> = {
        'Monofocal': 'Cristal Monofocal',
        'Bifocal': 'Cristal Bifocal',
        'Multifocal': 'Cristal Multifocal'
      };

      const dbCategory = categoryMapping[detectedType] || 'Cristal';

      const crystals = await prisma.product.findMany({
        where: {
          category: 'Cristal',
          type: dbCategory,
        }
      });

      if (crystals.length === 0) {
        return {
          options: [],
          requiresReview: true,
          reviewReason: `No se encontraron cristales registrados en la categoría: ${dbCategory}.`
        };
      }

      // 3. Buscar información del armazón si se especificó uno
      let frameProduct: any = null;
      if (request.frameId) {
        frameProduct = await prisma.product.findUnique({
          where: { id: request.frameId }
        });
      }

      // 4. Utilizar el LLM con una "Retrodirectiva" para seleccionar las mejores combinaciones de cristales
      // para este usuario, SIN hacer cálculos matemáticos (los cálculos se hacen abajo con el PricingService).
      const selectedOptions = await this.selectLensesViaLLM(detectedType, crystals, request.userQuery || "");

      // 5. Calcular los precios reales usando la lógica de negocio central (PricingService)
      const finalOptions: QuoteOption[] = [];

      for (const opt of selectedOptions) {
        const matchingCrystal = crystals.find(c => c.id === opt.crystalId);
        if (!matchingCrystal) continue;

        // Crear la lista de items para simular el carrito
        const cartItems: CartItem[] = [
          {
            productId: matchingCrystal.id,
            product: matchingCrystal,
            price: matchingCrystal.price || 0,
            quantity: 1
          }
        ];

        // Añadir el armazón si corresponde
        if (frameProduct) {
          cartItems.push({
            productId: frameProduct.id,
            product: frameProduct,
            price: frameProduct.price || 0,
            quantity: 1
          });
        }

        // Ejecutar los cálculos usando la lógica oficial de PricingService
        // Se asume 20% descuento efectivo y 15% transferencia
        const totals = PricingService.calculateTotals(cartItems, 0, 20, []);
        const orderMock = {
          subtotalWithMarkup: totals.subtotalWithMarkup,
          discountCash: 20,
          discountTransfer: 15,
          payments: []
        };
        const financials = PricingService.calculateOrderFinancials(orderMock);

        finalOptions.push({
          name: opt.name,
          description: opt.description,
          originalPrice: financials.listPrice,
          cashPrice: financials.totalCash,
          transferPrice: financials.totalTransfer,
          installments3: financials.installment3,
          installments6: financials.installment6
        });
      }

      return {
        options: finalOptions,
        requiresReview: false
      };

    } catch (error: any) {
      console.error('[QuoteAgent] Error:', error.message);
      return {
        options: [],
        requiresReview: true,
        reviewReason: `Error interno en la generación de cotización: ${error.message}`
      };
    }
  }

  /**
   * Deduce el tipo de lente a partir del texto del cliente.
   */
  private static async deduceLensType(query: string): Promise<string> {
    const model = getModel(0);
    const systemPrompt = `Analiza la consulta del cliente y determina si busca lentes "Monofocal", "Bifocal" o "Multifocal" (también llamados progresivos).
Responde UNICAMENTE con una de esas tres palabras (Monofocal, Bifocal, Multifocal) o "Desconocido" si no se puede determinar.`;

    try {
      const response = await model.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(query)
      ]);
      const res = response.content.toString().trim();
      return ['Monofocal', 'Bifocal', 'Multifocal'].includes(res) ? res : '';
    } catch {
      return '';
    }
  }

  /**
   * Selecciona combinaciones de cristales usando el LLM (Decisión lógica, no matemática).
   * Contiene una retrodirectiva para asegurar que solo use IDs reales de la lista provista.
   */
  private static async selectLensesViaLLM(lensType: string, availableCrystals: any[], userRequest: string): Promise<Array<{ crystalId: string, name: string, description: string }>> {
    const model = getModel(0.1);
    
    const serializedCrystals = availableCrystals.map(c => ({
      id: c.id,
      name: c.name,
      price: c.price,
      description: c.description
    }));

    const systemPrompt = `Actúas como un asesor técnico de óptica de alta precisión.
Tu tarea es seleccionar 2 o 3 opciones de cristales ópticos de la lista provista que mejor se adapten a las necesidades del cliente (por ejemplo: opción económica, opción intermedia, opción premium con antirreflex o marca Varilux si aplica).

LISTA DE CRISTALES DISPONIBLES:
${JSON.stringify(serializedCrystals, null, 2)}

SOLICITUD DEL CLIENTE / TIPO DETECTADO:
Tipo: ${lensType}
Texto adicional: "${userRequest}"

INSTRUCCIONES DE AUTO-REFLEXIÓN Y PREVENCIÓN DE ALUCINACIONES (RETRODIRECTIVAS):
1. Revisa detenidamente que los IDs de los cristales seleccionados existan EXACTAMENTE en la lista de cristales disponibles.
2. NO inventes nombres de productos, precios ni IDs.
3. Elige opciones lógicas: si el cliente busca "Multifocales", selecciona cristales que correspondan a esa gama (por ejemplo, evitar seleccionar monofocales).
4. No hagas ningún cálculo de precio con descuento ni cuotas. Tu única tarea es SELECCIONAR los productos adecuados y describirlos brevemente.

Devuelve tu respuesta únicamente en este formato JSON, sin bloques de código markdown:
[
  {
    "crystalId": "ID_DEL_CRISTAL_DE_LA_LISTA",
    "name": "Nombre descriptivo comercial de la opción (ej. Económica, Avanzada, Premium Varilux)",
    "description": "Explicación breve de por qué se recomienda y sus beneficios"
  }
]`;

    try {
      const response = await model.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage("Por favor selecciona las mejores opciones de cristales.")
      ]);

      const text = response.content.toString().trim();
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const cleaned = jsonMatch[0].replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        // Validar que los IDs existan realmente en la lista
        return parsed.filter((item: any) => availableCrystals.some(c => c.id === item.crystalId));
      }
      return [];
    } catch (error) {
      console.error('[QuoteAgent] Error in LLM selection:', error);
      return [];
    }
  }
}
