import { getModel } from "../model";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

export interface PrescriptionData {
  od: {
    esfera: number | null;
    cilindro: number | null;
    eje: number | null;
  };
  oi: {
    esfera: number | null;
    cilindro: number | null;
    eje: number | null;
  };
  adicion: number | null;
  distanciaPupilar: number | null;
  tipoLente?: string;
}

export class OcrAgent {
  /**
   * Extrae la graduación óptica de una imagen de receta usando Gemini Vision.
   * @param base64Image Imagen en formato base64 (incluyendo data:image/...)
   */
  static async extractPrescription(base64Image: string): Promise<PrescriptionData | null> {
    const model = getModel(0.1); // Temperatura baja para evitar alucinaciones en los números

    // Limpiar el prefijo data:image/... si está presente
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");

    const systemPrompt = `Eres un experto óptico y un asistente de análisis de recetas oftalmológicas. 
Tu tarea es leer una imagen de una receta de lentes y extraer los datos de graduación exactos en un formato JSON estructurado.

Debes extraer los siguientes campos para Ojo Derecho (OD) y Ojo Izquierdo (OI):
- Esfera (esfera): número con signo (+ o -). Si es neutro, pon 0.
- Cilindro (cilindro): número con signo, típicamente negativo en recetas de óptica.
- Eje (eje): número entero entre 0 y 180.
- Adición (adicion): número con signo positivo, usado en recetas de multifocales/progresivos.
- Distancia Pupilar (distanciaPupilar): número en milímetros, si está especificado.
- Tipo de Lente (tipoLente): "Monofocal", "Bifocal", "Multifocal" según se indique o se infiera (si hay Adición, suele ser Multifocal).

INSTRUCCIONES DE AUTO-REFLEXIÓN Y PREVENCIÓN DE ALUCINACIONES (RETRODIRECTIVAS):
1. **Segunda Lectura Mental:** Realiza un doble chequeo de los números leídos.
2. **Veracidad Absoluta:** Si un número es borroso, dudoso o está parcialmente cortado, devuélvelo como null. Está estrictamente prohibido adivinar, aproximar o redondear al azar. Es preferible retornar null para que un humano verifique a inventar una graduación incorrecta.
3. **Tu respuesta debe ser ÚNICAMENTE el objeto JSON estructurado**, sin bloques de código markdown, sin texto extra. Si no logras leer los datos mínimos de graduación, responde con un objeto vacío {}.

Formato esperado:
{
  "od": { "esfera": -1.25, "cilindro": -0.50, "eje": 90 },
  "oi": { "esfera": -1.00, "cilindro": null, "eje": null },
  "adicion": 2.00,
  "distanciaPupilar": 62,
  "tipoLente": "Multifocal"
}`;

    try {
      const message = new HumanMessage({
        content: [
          { type: "text", text: "Analiza esta receta y extrae los datos correspondientes en formato JSON:" },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${base64Data}`,
            },
          },
        ],
      });

      const response = await model.invoke([
        new SystemMessage(systemPrompt),
        message
      ]);

      const text = response.content.toString().trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]) as PrescriptionData;
        return this.validateAndCleanPrescription(data);
      }
      return null;
    } catch (error) {
      console.error('[OcrAgent] Error extracting prescription:', error);
      return null;
    }
  }

  /**
   * Valida que los datos clínicos se mantengan dentro de rangos biológica y ópticamente realistas.
   * Si detecta valores fuera de rango, los limpia poniéndolos en null.
   */
  private static validateAndCleanPrescription(data: PrescriptionData): PrescriptionData | null {
    const cleanNum = (val: any, min: number, max: number): number | null => {
      if (val === null || val === undefined) return null;
      const num = Number(val);
      if (isNaN(num)) return null;
      if (num < min || num > max) {
        console.warn(`[OcrAgent Validation] Valor clínico ${num} fuera de rango permitido [${min}, ${max}]. Se descarta.`);
        return null;
      }
      return num;
    };

    // Validar esferas: [-25.00, +25.00]
    const odEsfera = cleanNum(data.od?.esfera, -25.00, 25.00);
    const oiEsfera = cleanNum(data.oi?.esfera, -25.00, 25.00);

    // Validar cilindros: [-12.00, 0.00] (usualmente negativo en recetas comunes de óptica)
    const odCilindro = cleanNum(data.od?.cilindro, -12.00, 12.00); // Rango extendido por si es positivo, pero típicamente corregido
    const oiCilindro = cleanNum(data.oi?.cilindro, -12.00, 12.00);

    // Validar ejes: [0, 180]
    const odEje = cleanNum(data.od?.eje, 0, 180);
    const oiEje = cleanNum(data.oi?.eje, 0, 180);

    // Validar adición: [0.75, 4.00]
    const adicion = cleanNum(data.adicion, 0.75, 4.00);

    // Validar distancia pupilar: [40, 80]
    const distanciaPupilar = cleanNum(data.distanciaPupilar, 40, 80);

    // Si la IA no devolvió NINGÚN dato clínico (respuesta {} = "no pude leer"), devolver
    // null para que el orquestador dispare el mensaje "mandá otra foto" en vez de tratarlo
    // como lectura exitosa (Object.keys() del objeto todo-null siempre daba length 5).
    const tieneTipo = data.tipoLente != null && String(data.tipoLente).trim() !== '';
    const hayDato = odEsfera !== null || oiEsfera !== null || odCilindro !== null || oiCilindro !== null ||
        odEje !== null || oiEje !== null || adicion !== null || distanciaPupilar !== null || tieneTipo;
    if (!hayDato) {
        console.warn('[OcrAgent] La IA no devolvió datos clínicos legibles; se trata como receta ilegible.');
        return null;
    }

    return {
      od: {
        esfera: odEsfera,
        cilindro: odCilindro,
        eje: odEje
      },
      oi: {
        esfera: oiEsfera,
        cilindro: oiCilindro,
        eje: oiEje
      },
      adicion,
      distanciaPupilar,
      tipoLente: data.tipoLente
    };
  }
}
