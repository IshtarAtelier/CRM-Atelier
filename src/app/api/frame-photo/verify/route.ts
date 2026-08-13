// POST /api/frame-photo/verify — ¿esta imagen es realmente un armazón?
//
// La foto del armazón es obligatoria para poder vender. Sin este control, la
// forma más rápida de "cumplir" el requisito es subir cualquier cosa —una foto
// del mostrador, una captura, un dedo— y seguir de largo. Eso deja la venta
// habilitada y el problema intacto: el día del reclamo la foto no prueba nada.
//
// Se le pregunta al modelo de visión que el sistema ya usa para el OCR de
// recetas y comprobantes. Devuelve `{ ok, motivo }`.
//
// FALLA ABIERTA a propósito: si el modelo no responde (red, cuota, OAuth), la
// foto se acepta y queda registrado en el log. Bloquear una venta porque un
// servicio de Google está caído sería un daño mayor que el que se previene.

import { NextResponse } from 'next/server';
import { HumanMessage } from '@langchain/core/messages';
import { ChatVertexAI } from '@langchain/google-vertexai-web';
import { retryWithBackoff } from '@/lib/retry-utils';

const PROMPT = `Mirá la imagen y decidí si es la FOTO DE UN ARMAZÓN DE ANTEOJOS
(un par de anteojos, marco de receta o de sol, con o sin cristales; puede estar
sobre el mostrador, en la mano, en un estuche o puesto en una persona).

NO cuentan como armazón: fotos de recetas o papeles, comprobantes, capturas de
pantalla, pantallas, cajas cerradas, personas sin anteojos, lugares, mascotas,
fotos borrosas o tan oscuras que no se distinga nada.

Respondé SOLO este JSON, sin markdown:
{"es_armazon": true_o_false, "motivo": "una frase corta y clara en español para
un vendedor, explicando qué se ve si NO es un armazón"}`;

export async function POST(request: Request) {
    try {
        const { base64, mimeType } = await request.json();
        if (!base64) {
            return NextResponse.json({ ok: true, motivo: 'sin imagen para revisar' });
        }

        const model = new ChatVertexAI({ model: 'gemini-2.5-flash', location: 'global', temperature: 0 });

        const res = await retryWithBackoff(
            () => model.invoke([
                new HumanMessage({
                    content: [
                        { type: 'text', text: PROMPT },
                        { type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${base64}` } },
                    ],
                }),
            ]),
            { label: 'Verificación de foto de armazón' }
        );

        const limpio = res.content.toString().replace(/```json/gi, '').replace(/```/g, '').trim();
        const veredicto = JSON.parse(limpio);

        if (veredicto?.es_armazon === true) {
            return NextResponse.json({ ok: true });
        }
        return NextResponse.json({
            ok: false,
            motivo: veredicto?.motivo || 'La imagen no parece un armazón de anteojos.',
        });
    } catch (error: any) {
        // Falla abierta: se acepta y se deja rastro para poder auditarlo después.
        console.error('[Verificación de foto de armazón] No se pudo verificar, se acepta la foto:', error?.message);
        return NextResponse.json({ ok: true, noVerificada: true });
    }
}
