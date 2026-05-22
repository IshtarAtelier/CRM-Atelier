import { NextResponse } from 'next/server';
import { ChatVertexAI } from "@langchain/google-vertexai-web";
import { HumanMessage } from "@langchain/core/messages";
import { checkRateLimit } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        // Rate Limiting (5 peticiones por minuto por IP)
        const ip = request.headers.get('x-forwarded-for') || 'unknown-ip';
        const rateLimitResult = checkRateLimit(`ocr_${ip}`, { limit: 5, windowMs: 60000 });
        
        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: 'Demasiadas peticiones. Por favor, intenta de nuevo en un minuto.' },
                { status: 429 }
            );
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const type = formData.get('type') as string | null;

        if (!file) {
            return NextResponse.json({ error: 'Falta la imagen' }, { status: 400 });
        }
        if (!type || !['prescription', 'receipt'].includes(type)) {
            return NextResponse.json({ error: 'Tipo inválido (debe ser prescription o receipt)' }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const mimeType = file.type || 'image/jpeg';

        let prompt = '';
        if (type === 'prescription') {
            prompt = `Analiza esta receta óptica. Extrae ÚNICAMENTE los valores numéricos correspondientes a:
OD (Ojo Derecho): Esférico, Cilíndrico, Eje, DIP (Distancia o DNP), Adición, Altura.
OI (Ojo Izquierdo): Esférico, Cilíndrico, Eje, DIP (Distancia o DNP), Adición, Altura.
Devuelve los resultados usando esta estructura JSON exacta. Usa null si un valor no está presente.
{
  "sphereOD": número_o_null,
  "cylinderOD": número_o_null,
  "axisOD": número_o_null,
  "additionOD": número_o_null,
  "distanceOD": número_o_null,
  "heightOD": número_o_null,
  "sphereOI": número_o_null,
  "cylinderOI": número_o_null,
  "axisOI": número_o_null,
  "additionOI": número_o_null,
  "distanceOI": número_o_null,
  "heightOI": número_o_null
}
Responde SOLO con el JSON, sin texto alrededor, sin comillas de código ni formato markdown. Asegúrate de extraer bien los signos negativos (-).`;
        } else {
            prompt = `Analiza este comprobante de pago o transferencia bancaria. Extrae ÚNICAMENTE:
- amount: el monto final transferido o pagado (número sin símbolos, sin formato de miles).
- reference: el código de transferencia, número de comprobante, código de operación o referencia (string).
- date: la fecha del comprobante si está visible (formato YYYY-MM-DD).

Devuelve los resultados usando esta estructura JSON exacta. Usa null si un valor no está presente.
{
  "amount": número_o_null,
  "reference": "texto_o_null",
  "date": "YYYY-MM-DD_o_null"
}
Responde SOLO con el JSON, sin texto alrededor, sin comillas de código ni formato markdown.`;
        }

        const model = new ChatVertexAI({
            model: 'gemini-2.5-flash',
            location: 'global',
            temperature: 0,
        });

        const response = await model.invoke([
            new HumanMessage({
                content: [
                    { type: "text", text: prompt },
                    { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } }
                ]
            })
        ]);

        const textResponse = response.content.toString();
        const cleanedJson = textResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
        const extractedData = JSON.parse(cleanedJson);

        return NextResponse.json(extractedData);
    } catch (error: any) {
        const { handleAIError } = await import('@/lib/ai-error-handler');
        try {
            await handleAIError(error, 'OCR de Recetas/Comprobantes');
        } catch (handledError: any) {
            return NextResponse.json({ error: handledError.message || 'Error procesando la imagen' }, { status: 500 });
        }
        return NextResponse.json({ error: error.message || 'Error procesando la imagen' }, { status: 500 });
    }
}
