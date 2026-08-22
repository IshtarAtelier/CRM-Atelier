/**
 * Bandeja de mensajería interna.
 *   GET  → las conversaciones del usuario, con sus no leídos
 *   POST → abre una conversación nueva (o reusa el directo que ya exista)
 *
 * La ruta valida, llama al service y responde. Nada de `prisma` acá.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { InternalMessagingService } from '@/services/internal-messaging.service';

export const dynamic = 'force-dynamic';

/**
 * La mensajería interna es entre PERSONAS: sin humano identificado no hay
 * bandeja que mostrar. El middleware ya exige sesión en /api/*, así que esto
 * solo puede darse si alguien llama con credenciales de sistema o de bot.
 */
function exigirUsuario(request: NextRequest) {
    const actor = getActor(request);
    if (!actor.id) return null;
    return actor;
}

export async function GET(request: NextRequest) {
    const actor = exigirUsuario(request);
    if (!actor) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 });

    try {
        const conversaciones = await InternalMessagingService.bandeja(actor.id!);
        return NextResponse.json({ conversaciones, yo: { id: actor.id, name: actor.name } });
    } catch (e: any) {
        console.error('[Mensajes GET]', e);
        return NextResponse.json({ error: 'No se pudo cargar la bandeja' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const actor = exigirUsuario(request);
    if (!actor) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 });

    try {
        const body = await request.json();
        const res = await InternalMessagingService.crearConversacion({
            creadorId: actor.id!,
            paraIds: Array.isArray(body.paraIds) ? body.paraIds : [],
            copiaIds: Array.isArray(body.copiaIds) ? body.copiaIds : [],
            subject: body.subject ?? null,
            primerMensaje: body.mensaje ?? '',
        }, actor);
        return NextResponse.json(res);
    } catch (e: any) {
        // Los errores del service son mensajes para la persona ("elegí un
        // destinatario", "el mensaje no puede estar vacío"), no fallas internas.
        console.error('[Mensajes POST]', e);
        return NextResponse.json({ error: e.message || 'No se pudo enviar' }, { status: 400 });
    }
}
