/**
 * EL LATIDO. Una sola llamada cada 20 s que hace las cuatro cosas que la barra
 * lateral necesita:
 *   1. avisa que este usuario sigue vivo (puntito verde)
 *   2. devuelve cuántos mensajes sin leer tiene (campanita)
 *   3. devuelve los urgentes pendientes (el pop-up que tapa la pantalla)
 *   4. devuelve quiénes están en línea ahora
 *
 * Es UNA ruta y no cuatro a propósito: son cuatro datos que se piden juntos,
 * siempre, desde el mismo intervalo. Separados serían cuatro viajes de red y
 * cuatro conexiones a la base cada 20 segundos por cada pestaña abierta, para
 * pintar una sola barra lateral.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { InternalMessagingService } from '@/services/internal-messaging.service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const actor = getActor(request);
    // Sin humano detrás no hay nada que latir. Se responde vacío en vez de un
    // error para que el cliente no tenga que distinguir casos.
    if (!actor.id) {
        return NextResponse.json({ noLeidos: 0, urgentes: [], enLinea: [] });
    }

    try {
        // El latido va primero y aparte: si fallara alguna de las lecturas de
        // abajo, la marca de vida igual quedó puesta y el resto del equipo lo
        // sigue viendo en línea.
        await InternalMessagingService.latido(actor.id).catch(() => {});

        const [noLeidos, urgentes, enLinea] = await Promise.all([
            InternalMessagingService.contarNoLeidos(actor.id),
            InternalMessagingService.urgentesPendientes(actor.id),
            InternalMessagingService.enLinea(),
        ]);

        return NextResponse.json({ noLeidos, urgentes, enLinea, yoId: actor.id });
    } catch (e: any) {
        console.error('[Mensajes pulso]', e);
        // Un fallo del pulso NUNCA puede romper la barra lateral ni tapar la
        // pantalla con un error: se devuelve el estado vacío y se reintenta.
        return NextResponse.json({ noLeidos: 0, urgentes: [], enLinea: [] });
    }
}
