import { getModel } from "../model";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

export interface SeoPageData {
  title: string;
  description: string;
  h1: string;
  introduction: string;
  sections: Array<{ heading: string; content: string }>;
  jsonLd: Record<string, any>;
  keywords: string[];
  callToAction: {
    label: string;
    url: string;
    secondaryLabel?: string;
    secondaryUrl?: string;
  };
}

export class SeoAgent {
  /**
   * Genera el contenido SEO y los datos estructurados para una de las páginas clave del negocio.
   */
  static async generatePage(pageTopic: string): Promise<SeoPageData | null> {
    const model = getModel(0.2); // Temperatura baja para mantener un formato estructurado riguroso

    const systemPrompt = `Eres un consultor experto en SEO y redacción de contenidos (Copywriting SEO) y un especialista en optimización para búsquedas de Inteligencia Artificial (GEO/AIO).
Tu tarea es generar el contenido completo de una landing page enfocada en un tema específico de óptica para posicionar el negocio "Atelier Óptica" en Córdoba, Argentina.

TEMA DE LA PÁGINA: "${pageTopic}"

DIRECTIVAS DE REDACCIÓN Y EVITACIÓN DE ALUCINACIONES (RETRODIRECTIVAS):
1. **Veracidad de Datos:** La dirección oficial del local es "José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba, Argentina". El teléfono de contacto y WhatsApp es "+54 9 354 121 5971". No inventes otras direcciones ni teléfonos.
2. **Optimización Natural:** Asegúrate de integrar palabras clave relevantes de forma fluida y natural en los títulos, subtítulos y párrafos. Evita el "keyword stuffing" (relleno innecesario de palabras clave).
3. **Estructura Semántica Clara:** Define un título principal de página (Title Tag), una descripción meta (Meta Description), un H1 único y claro, y al menos 3 o 4 secciones con subtítulos (H2/H3).
4. **Enfoque en Conversión:** Incluye llamados a la acción (CTAs) claros y persuasivos según los requerimientos del usuario (ej: "Cotizá tus lentes en 60 segundos", "Enviá tu receta por WhatsApp", "Reservá tu asesoramiento personalizado").
5. **Datos Estructurados (JSON-LD):** Genera un objeto JSON-LD válido (normalmente de tipo LocalBusiness, FAQPage o Product) que refleje exactamente el contenido y los datos de contacto de la página.
6. **Autoevaluación:** Antes de entregar el JSON final, verifica que todas las claves del formato solicitado estén presentes y que la dirección/contacto coincidan con el estándar oficial de la tienda.

Debes responder ÚNICAMENTE con un JSON con la estructura del tipo \`SeoPageData\` que se describe a continuación, sin bloques de código markdown:
{
  "title": "Título SEO para la pestaña del navegador (máx 60 caracteres)",
  "description": "Meta descripción atractiva para buscadores (máx 160 caracteres)",
  "h1": "Título principal visible en la página (H1)",
  "introduction": "Párrafo introductorio atractivo de unas 50 palabras que sirva para extracción rápida de la IA (AIO/GEO)",
  "sections": [
    {
      "heading": "Título de la sección (H2)",
      "content": "Contenido detallado de la sección en formato HTML básico o texto plano enriquecido."
    }
  ],
  "jsonLd": {
     // Objeto de datos estructurados válido (JSON-LD) compatible con Schema.org
  },
  "keywords": ["palabra clave 1", "palabra clave 2"],
  "callToAction": {
    "label": "Texto del botón principal de acción",
    "url": "URL de destino (ej. https://wa.me/5493541215971 o /arma-tus-lentes)",
    "secondaryLabel": "Texto del botón secundario (opcional)",
    "secondaryUrl": "URL del botón secundario (opcional)"
  }
}`;

    try {
      const response = await model.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(`Genera la estructura de página optimizada para: ${pageTopic}`)
      ]);

      const text = response.content.toString().trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const cleaned = jsonMatch[0].replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(cleaned) as SeoPageData;
        return this.cleanSeoData(data);
      }
      return null;
    } catch (error) {
      console.error('[SeoAgent] Error generating SEO page:', error);
      return null;
    }
  }

  /**
   * Corrige y limpia programáticamente cualquier dato de contacto alucinado por el LLM en el JSON-LD
   * para asegurar que coincidan al 100% con los datos oficiales de la empresa.
   */
  private static cleanSeoData(data: SeoPageData): SeoPageData {
    if (data.jsonLd) {
      // Si el JSON-LD contiene un campo de dirección, sobreescribir con la real
      if (data.jsonLd.address && typeof data.jsonLd.address === 'object') {
        data.jsonLd.address.streetAddress = "José Luis de Tejeda 4380";
        data.jsonLd.address.addressLocality = "Cerro de las Rosas, Córdoba";
        data.jsonLd.address.addressRegion = "Córdoba";
        data.jsonLd.address.postalCode = "5009";
        data.jsonLd.address.addressCountry = "AR";
      }
      // Si el JSON-LD contiene un teléfono, sobreescribir con el oficial
      if (data.jsonLd.telephone) {
        data.jsonLd.telephone = "+54 9 354 121 5971";
      }
    }
    return data;
  }
}
