import { NextResponse } from 'next/server';
import { ChatVertexAI } from "@langchain/google-vertexai-web";
import { HumanMessage } from "@langchain/core/messages";
import { checkRateLimit } from '@/lib/rate-limiter';
import { retryWithBackoff } from '@/lib/retry-utils';

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
- reference: el identificador principal del comprobante. En tickets de PayWay/posnet, usar el "N° de operación" del voucher. En comprobantes de transferencia bancaria, usar el "N° de operación" o "N° de transferencia". En otros casos, el número de comprobante o código de referencia (string).
- date: la fecha del comprobante si está visible (formato YYYY-MM-DD).
- payway_owner: si el comprobante es un ticket/voucher de PayWay (posnet/tarjeta), identifica el titular comparando con estos datos:
  * ISHTAR: N° Establecimiento 82671397, Terminales 16770672 o 16328313, CUIT 23386152314
  * YANI: N° Establecimiento 33173675, Terminal 16726469, CUIT 27425128138
  Devuelve "ISHTAR" o "YANI" según corresponda. Si no es un ticket de PayWay o no se puede identificar, devuelve null.
- is_mypime_6: booleano (true o false). Será true si en cualquier parte del comprobante dice "mypime 6", "mypyme 6", "mi pyme 6" o hace referencia a un plan pyme de 6 cuotas. En caso contrario, false.
- is_naranja_z: booleano (true o false). Será true si en cualquier parte del comprobante dice "cuota 11", "plan z" o "naranja z". En caso contrario, false.
- transfer_recipient: si el comprobante es de una transferencia bancaria, identifica el destinatario si está visible. Busca nombres o alias asociados a "LUCIA" o "ISHTAR". Devuelve "LUCIA" o "ISHTAR" si logras identificarlo, de lo contrario devuelve null.

Devuelve los resultados usando esta estructura JSON exacta. Usa null si un valor no está presente.
{
  "amount": número_o_null,
  "reference": "texto_o_null",
  "date": "YYYY-MM-DD_o_null",
  "payway_owner": "ISHTAR_o_YANI_o_null",
  "is_mypime_6": true_o_false,
  "is_naranja_z": true_o_false,
  "transfer_recipient": "LUCIA_o_ISHTAR_o_null"
}
Responde SOLO con el JSON, sin texto alrededor, sin comillas de código ni formato markdown.`;
        }

        const model = new ChatVertexAI({
            model: 'gemini-2.5-flash',
            location: 'global',
            temperature: 0,
        });

        // Use unified retry logic for transient OAuth/network errors
        const response = await retryWithBackoff(
            () => model.invoke([
                new HumanMessage({
                    content: [
                        { type: "text", text: prompt },
                        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } }
                    ]
                })
            ]),
            { label: 'OCR VertexAI' }
        );

        const textResponse = response.content.toString();
        const cleanedJson = textResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
        const extractedData = JSON.parse(cleanedJson);

        return NextResponse.json(extractedData);
    } catch (error: any) {
        const { handleAIError } = await import('@/lib/ai-error-handler');
        // Provide a user-friendly message for OAuth/network errors
        const msg = error?.message || '';
        if (msg.includes('Premature close') || msg.includes('Invalid response body') || msg.includes('oauth2')) {
            return NextResponse.json({ 
                error: 'Error de conexión con Google Cloud. Por favor, intentá de nuevo.' 
            }, { status: 502 });
        }
        try {
            await handleAIError(error, 'OCR de Recetas/Comprobantes');
        } catch (handledError: any) {
            return NextResponse.json({ error: handledError.message || 'Error procesando la imagen' }, { status: 500 });
        }
        return NextResponse.json({ error: error.message || 'Error procesando la imagen' }, { status: 500 });
    }
}
