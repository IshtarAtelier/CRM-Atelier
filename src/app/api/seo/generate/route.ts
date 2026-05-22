import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY || '' });

const seoSchema = {
  type: Type.OBJECT,
  properties: {
    seoTitle: {
      type: Type.STRING,
      description: "Título SEO optimizado. Máximo 70 caracteres."
    },
    seoDescription: {
      type: Type.STRING,
      description: "Descripción SEO persuasiva para vender, resaltando inmediatez y beneficios. Máximo 160 caracteres."
    },
    seoTags: {
      type: Type.STRING,
      description: "Palabras clave separadas por comas. Ej: anteojos, gafas, sol, polarizadas"
    },
    customSlug: {
      type: Type.STRING,
      description: "URL amigable, solo minúsculas y guiones. Ej: anteojos-sol-rayban-aviator"
    }
  },
  required: ["seoTitle", "seoDescription", "seoTags", "customSlug"]
};

export async function POST(req: Request) {
  try {
    const { name, brand, model, category, type } = await req.json();

    const prompt = `
      Eres un experto en E-Commerce y SEO de Atelier Óptica.
      Genera metadatos SEO para el siguiente producto:
      - Nombre: ${name || ''}
      - Marca: ${brand || ''}
      - Modelo: ${model || ''}
      - Categoría: ${category || ''}
      - Tipo: ${type || ''}

      Reglas:
      1. seoTitle: Atractivo, max 70 caracteres. Usa el nombre de la marca si es posible.
      2. seoDescription: Persuasivo, resalta que hay "Entrega inmediata", "Envío gratis" o "Calidad premium". Max 160 caracteres.
      3. seoTags: Las palabras más usadas por los usuarios al buscar este tipo de producto.
      4. customSlug: URL 100% limpia, sin tildes ni caracteres especiales, todo minúscula separado por guiones.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: seoSchema,
        temperature: 0.7,
      }
    });

    const jsonStr = response.text;
    if (!jsonStr) throw new Error("No response from AI");
    
    return NextResponse.json(JSON.parse(jsonStr));

  } catch (error: any) {
    const { handleAIError } = await import('@/lib/ai-error-handler');
    try {
        await handleAIError(error, 'Generador SEO de Productos');
    } catch (handledError: any) {
        return NextResponse.json({ error: handledError.message }, { status: 500 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
