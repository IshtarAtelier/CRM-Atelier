/**
 * Una conversación.
 *   GET  → sus mensajes (y la marca como leída)
 *   POST → responder
 *
 * Quién puede verla lo decide el service (`assertParticipante`), no esta ruta:
 * si la regla viviera acá habría que repetirla en cada endpoint nuevo.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { InternalMessagingService } from '@/services/internal-messaging.service';

export const dynamic = 'force-dynamic';

function exigirUsuario(request: NextRequest) {
    const actor = getActor(request);
    return actor.id ? actor : null;
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const actor = exigirUsuario(request);
    if (!actor) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 });

    const { id } = await ctx.params;
    try {
        const antes = request.nextUrl.searchParams.get('antesDe');
        const conversacion = await InternalMessagingService.leerConversacion(id, actor.id!, {
            antesDe: antes ? new Date(antes) : undefined,
        });
        return NextResponse.json(conversacion);
    } catch (e: any) {
        // 404 y no 403: decir "no tenés permiso" confirma que la conversación
        // existe, y con eso se puede deducir quién habla con quién probando ids.
        return NextResponse.json({ error: e.message || 'No encontrada' }, { status: 404 });
    }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const actor = exigirUsuario(request);
    if (!actor) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 });

    const { id } = await ctx.params;
    try {
        const body = await request.json();

        // Sumar a alguien a la conversación comparte con él TODO el historial
        // anterior, así que va por una acción explícita y no colado en el envío.
        if (body.agregarUserId) {
            const res = await InternalMessagingService.agregarParticipante({
                threadId: id,
                porUserId: actor.id!,
                nuevoUserId: body.agregarUserId,
                role: body.comoCopia ? 'CC' : 'MEMBER',
            }, actor);
            return NextResponse.json(res);
        }

        const mensaje = await InternalMessagingService.responder({
            threadId: id,
            senderId: actor.id!,
            body: body.mensaje ?? '',
            urgent: !!body.urgent,
            copiaWhatsapp: !!body.copiaWhatsapp,
        });
        return NextResponse.json(mensaje);
    } catch (e: any) {
        console.error('[Mensajes responder]', e);
        return NextResponse.json({ error: e.message || 'No se pudo enviar' }, { status: 400 });
    }
}
