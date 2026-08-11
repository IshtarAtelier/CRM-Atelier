import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { medirSaludTienda } from '@/lib/tienda/salud';
import { getActorValidated } from '@/lib/session-revalidation';

/**
 * El veredicto de la tienda: qué tan lista está para recibir tráfico pago.
 *
 * CÓMO FUNCIONA, Y POR QUÉ ASÍ
 * Los números los cuenta `medirSaludTienda()`; la IA solo los INTERPRETA. Nunca
 * se le pide al modelo que "revise la tienda" a ojo: sin datos medidos inventa
 * ("tenés pocas fotos" sin saber cuántas) y un panel que inventa es peor que no
 * tener panel, porque se le termina creyendo.
 *
 * El veredicto se devuelve con los números crudos al lado, así que cualquier
 * afirmación se puede contrastar sin volver a preguntarle a nadie.
 *
 * Solo lee. No escribe nada.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ESQUEMA = {
  type: Type.OBJECT,
  properties: {
    semaforo: {
      type: Type.STRING,
      description: 'verde = se puede poner plata en publicidad hoy · amarillo = se puede, pero hay algo que va a hacer perder ventas · rojo = arreglar antes de gastar',
      enum: ['verde', 'amarillo', 'rojo'],
    },
    veredicto: {
      type: Type.STRING,
      description: 'Una sola frase, directa, para la dueña. Sin "depende" ni rodeos. Máximo 160 caracteres.',
    },
    porQue: {
      type: Type.STRING,
      description: 'Dos o tres frases explicando el semáforo, citando los números concretos que lo justifican.',
    },
    sugerencias: {
      type: Type.ARRAY,
      description: 'Máximo 4, ordenadas por cuánta venta recuperan. Si no hay nada relevante, devolvé menos. No inventes tareas para llenar.',
      items: {
        type: Type.OBJECT,
        properties: {
          titulo: { type: Type.STRING, description: 'Qué hacer, en pocas palabras' },
          porQue: { type: Type.STRING, description: 'Qué le pasa hoy a un cliente por esto. Concreto, con el número.' },
          esfuerzo: { type: Type.STRING, enum: ['minutos', 'horas', 'una tarde', 'días'] },
          impacto: { type: Type.STRING, enum: ['alto', 'medio', 'bajo'] },
        },
        required: ['titulo', 'porQue', 'esfuerzo', 'impacto'],
      },
    },
  },
  required: ['semaforo', 'veredicto', 'porQue', 'sugerencias'],
};

const INSTRUCCIONES = `
Sos el analista de una óptica de Córdoba (Atelier Óptica) que vende anteojos por internet,
con tickets de entre $160.000 y $225.000 pesos argentinos.

Le hablás a la DUEÑA. No es técnica y no tiene tiempo. Español rioplatense, sin jerga, sin
anglicismos, sin "optimizar" ni "conversión" ni "engagement". Decile las cosas como se las
dirías a alguien inteligente que no quiere leer un informe.

REGLAS QUE NO SE NEGOCIAN:

1. Solo podés afirmar lo que esté en los números que te paso. Si un dato no está, no opines
   sobre eso. Nunca inventes una cifra.

2. Citá los números. "79 de 113 productos tienen una sola foto" sirve; "faltan fotos" no.

3. Lo que está en "yaResuelto" YA SE ARREGLÓ. No lo sugieras de nuevo ni lo cuentes como
   problema: hace perder la confianza en el panel entero.

4. Para esta óptica, el orden de importancia real es:
   - Las FOTOS son el techo de todo. Nadie compra un anteojo de $200.000 con una sola foto
     sin habérselo probado.
   - Un catálogo PLANO (mucha concentración en una banda de precio) no deja elegir al cliente.
   - Sin stock publicado, se pierde la venta y encima molesta.
   - La tienda es NUEVA y todavía no vendió online. Que las ventas web sean cero NO es un
     síntoma de que algo esté roto: es que recién ahora se va a publicitar. No lo trates
     como un problema.

5. El semáforo es sobre PONER DINERO EN PUBLICIDAD hoy. Rojo solo si de verdad sería tirar
   la plata. Casi nada es rojo.
`;

export async function GET(request: Request) {
  try {
    const actor = await getActorValidated(request);
    if (!actor.valid || !actor.role || !['ADMIN', 'STAFF'].includes(actor.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const salud = await medirSaludTienda();

    if (!process.env.GOOGLE_GENAI_API_KEY) {
      // Sin IA se devuelven igual los números: el panel sigue siendo útil aunque
      // no haya veredicto redactado.
      return NextResponse.json({ salud, veredicto: null, motivo: 'Falta GOOGLE_GENAI_API_KEY' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${INSTRUCCIONES}\n\nESTOS SON LOS NÚMEROS MEDIDOS HOY EN LA TIENDA:\n${JSON.stringify(salud, null, 2)}`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: ESQUEMA,
        temperature: 0.4,
      },
    });

    const crudo = response.text;
    if (!crudo) throw new Error('La IA no devolvió nada');

    return NextResponse.json({ salud, veredicto: JSON.parse(crudo) });
  } catch (error: unknown) {
    console.error('[admin/tienda/veredicto]', error);
    // Si falla la IA, se devuelven los números igual: mejor un panel con datos
    // y sin veredicto que una pantalla de error.
    try {
      const salud = await medirSaludTienda();
      return NextResponse.json({
        salud,
        veredicto: null,
        motivo: error instanceof Error ? error.message : 'No se pudo generar el veredicto',
      });
    } catch {
      return NextResponse.json({ error: 'No se pudo medir la tienda' }, { status: 500 });
    }
  }
}
