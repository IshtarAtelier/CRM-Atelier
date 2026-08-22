/**
 * Cuántos mensajes internos sin leer tiene el usuario. Lo pide la campanita de
 * la barra lateral cada pocos segundos, así que es una sola consulta contada
 * contra índice y sin joins.
 *
 * No se cachea en el servidor (a diferencia del contador de WhatsApp): este
 * número es POR USUARIO, y una caché compartida le mostraría a Yani los no
 * leídos de Matías. Si algún día pesa, la caché tiene que llevar el userId en
 * la clave.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { InternalMessagingService } from '@/services/internal-messaging.service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const actor = getActor(request);
    // Sin humano detrás no hay no leídos: se responde 0 y no un error, para que
    // la campanita no tenga que distinguir casos.
    if (!actor.id) return NextResponse.json({ count: 0 });

    try {
        const count = await InternalMessagingService.contarNoLeidos(actor.id);
        return NextResponse.json({ count });
    } catch (e: any) {
        console.error('[Mensajes no-leidos]', e);
        // Un fallo del contador NO puede romper la barra lateral entera.
        return NextResponse.json({ count: 0 });
    }
}
