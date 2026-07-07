import { getModel } from "../model";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { prisma } from "@/lib/db";
import { WHATSAPP_PHONE } from "@/lib/constants";

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
  // Propiedades opcionales avanzadas para SEO/GEO 2025-2026:
  topicCluster?: {
    pillarTopic: string;
    satelliteTopics: string[];
    justification: string;
  };
  eeatMetadata?: {
    authorName: string;
    authorBio: string;
    authorCredentials: string[];
    medicalReviewDate: string;
    professionalDisclaimer: string;
  };
  geoRecommendations?: {
    perplexityStructure: string;
    multimediaSuggestions: string[];
    localKeywordsUsed: string[];
  };
}

export class SeoAgent {
  /**
   * Genera el contenido SEO y los datos estructurados para una de las páginas clave del negocio.
   */
  static async generatePage(pageTopic: string): Promise<SeoPageData | null> {
    const model = getModel(0.2); // Temperatura baja para mantener un formato estructurado riguroso

    // Consulta de artículos existentes en la base de datos para evitar la canibalización de keywords
    let existingContentContext = "No hay artículos publicados actualmente.";
    try {
      const posts = await prisma.blogPost.findMany({
        select: { title: true, slug: true },
        where: { status: "PUBLISHED" },
        orderBy: { date: "desc" },
        take: 15
      });
      if (posts.length > 0) {
        existingContentContext = posts
          .map((p) => `- Título: "${p.title}" (URL: /blog/${p.slug})`)
          .join("\n");
      }
    } catch (error) {
      console.error("[SeoAgent] Error fetching existing posts for context:", error);
    }

    const systemPrompt = `Eres un consultor experto en SEO y redacción de contenidos (Copywriting SEO) y un especialista de elite en optimización para búsquedas de Inteligencia Artificial (GEO/AIO - Generative Engine Optimization).
Tu tarea es generar el contenido completo de una landing page enfocada en un tema específico de óptica para posicionar el negocio "Atelier Óptica" en Córdoba, Argentina.

TEMA DE LA PÁGINA: "${pageTopic}"

CALENDARIO EDITORIAL / EVITACIÓN DE CANIBALIZACIÓN DE CONTENIDOS:
Aquí tienes los artículos de blog ya existentes en el sitio. No generes contenido que compita directamente con ellos (evita la canibalización). Si el tema propuesto es similar, enfócalo desde otra perspectiva complementaria:
${existingContentContext}

DIRECTIVAS DE REDACCIÓN Y EVITACIÓN DE ALUCINACIONES (RETRODIRECTIVAS):
1. **Veracidad de Datos:** La dirección oficial de Atelier es "José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba, Argentina". El teléfono/WhatsApp es "+54 9 351 868-5644". No inventes otras direcciones ni teléfonos para Atelier.
2. **Estrategia de Clúster Temático:** Define el tema de esta página como un "Pillar Page" (artículo pilar) e indica 3 a 5 temas satélites recomendados que deban escribirse alrededor del tema para ganar autoridad real.
3. **E-E-A-T Explícito (Experience, Expertise, Authoritativeness, Trust):** Proporciona una biografía ficticia o real de un experto óptico/optometrista con credenciales (ej: "Matías Turchi, Especialista Certificado por Essilor y Director Técnico en Atelier Óptica"), fecha de revisión médica reciente y un descargo de responsabilidad profesional (medical disclaimer).
4. **Optimización GEO (SearchGPT y Perplexity):**
   - Estructura las secciones de contenido siguiendo el patrón "afirmación -> evidencia -> fuente de autoridad" (ej: "Según la Academia Americana de Oftalmología [AAO], los lentes con filtro azul reducen...").
   - Utiliza un tono editorial sumamente independiente, profesional e imparcial que genere autoridad.
5. **Señales de Local SEO:**
   - Inyecta de forma natural palabras clave locales específicas de Córdoba Capital y del barrio Cerro de las Rosas (ej: "óptica en Cerro de las Rosas", "anteojos multifocales en Córdoba Capital").
   - Si el tema solicita explícitamente otra localidad de Argentina (ej: "Buenos Aires", "Palermo"), sitúate en ese contexto local de forma inteligente, pero preservando la mención de Atelier como el centro de derivación o referencia premium con envíos/asesoramiento.
6. **Sugerencias de Multimedia:** Recomienda gráficos, infografías, tablas comparativas de síntomas o herramientas interactivas que enriquecerían la respuesta visual y harían que las IAs prefieran citar esta página.
7. **Datos Estructurados (JSON-LD):** Genera un objeto JSON-LD válido (normalmente LocalBusiness, FAQPage, MedicalWebPage o Product) que refleje exactamente el tema y el local.

Debes responder ÚNICAMENTE con un JSON con la estructura del tipo \`SeoPageData\` que se describe a continuación, sin bloques de código markdown:
{
  "title": "Título SEO para la pestaña del navegador (máx 60 caracteres)",
  "description": "Meta descripción atractiva para buscadores (máx 160 caracteres)",
  "h1": "Título principal visible en la página (H1)",
  "introduction": "Párrafo introductorio sumamente atractivo de unas 50 palabras que sirva para extracción rápida de las IAs (AIO/GEO)",
  "sections": [
    {
      "heading": "Título de la sección (H2/H3)",
      "content": "Contenido detallado de la sección en formato HTML básico o texto plano enriquecido, utilizando el formato 'afirmación -> evidencia -> fuente'."
    }
  ],
  "jsonLd": {
     // Objeto de datos estructurados válido (JSON-LD) compatible con Schema.org
  },
  "keywords": ["palabra clave 1", "palabra clave 2"],
  "callToAction": {
    "label": "Texto del botón principal de acción",
    "url": "URL de destino (ej. https://wa.me/${WHATSAPP_PHONE} o /arma-tus-lentes)",
    "secondaryLabel": "Texto del botón secundario (opcional)",
    "secondaryUrl": "URL del botón secundario (opcional)"
  },
  "topicCluster": {
    "pillarTopic": "Nombre del tema pilar principal",
    "satelliteTopics": ["Tema satélite 1 con keyword", "Tema satélite 2 con keyword", "Tema satélite 3 con keyword"],
    "justification": "Breve explicación de por qué este clúster mejorará la autoridad en buscadores."
  },
  "eeatMetadata": {
    "authorName": "Nombre del autor experto",
    "authorBio": "Breve descripción y experiencia del autor",
    "authorCredentials": ["Credencial 1 (ej: Óptico Matriculado M.P. 1234)", "Credencial 2"],
    "medicalReviewDate": "2026-06-20 (fecha de revisión en formato YYYY-MM-DD)",
    "professionalDisclaimer": "Advertencia profesional indicando que el contenido es educativo y no reemplaza el diagnóstico oftalmológico."
  },
  "geoRecommendations": {
    "perplexityStructure": "Breve indicación de cómo se aplicó la estructura de citas en el texto",
    "multimediaSuggestions": ["Sugerencia 1: Tabla comparativa de...", "Sugerencia 2: Infografía de..."],
    "localKeywordsUsed": ["Palabra clave local 1", "Palabra clave local 2"]
  }
}`;

    try {
      console.log("[SeoAgent] Invoking model...");
      const response = await model.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(`Genera la estructura de página optimizada para: ${pageTopic}`)
      ]);

      const text = response.content.toString().trim();
      console.log("[SeoAgent] Raw response content length:", text.length);
      console.log("[SeoAgent] Raw response:\n", text);
      console.log("[SeoAgent] Response Metadata:", JSON.stringify(response.response_metadata, null, 2));
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const cleaned = jsonMatch[0].replace(/```json/g, '').replace(/```/g, '').trim();
        try {
          const data = JSON.parse(cleaned) as SeoPageData;
          return this.cleanSeoData(data);
        } catch (parseError) {
          console.error("[SeoAgent] JSON Parse Error. Cleaned text length:", cleaned.length, "Error:", parseError);
          return null;
        }
      } else {
        console.warn("[SeoAgent] No JSON match found in response.");
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
        data.jsonLd.telephone = "+54 9 351 868-5644";
      }
    }
    return data;
  }
}
