/**
 * Los colaboradores a los que se le puede escribir (para el selector de
 * destinatarios). Excluye al propio usuario y a las cuentas de ópticas
 * mayoristas, que son clientes y no equipo — el filtro real vive en el service.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { InternalMessagingService } from '@/services/internal-messaging.service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const actor = getActor(request);
    if (!actor.id) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 });

    try {
        const colaboradores = await InternalMessagingService.listarColaboradores(actor.id);
        return NextResponse.json({ colaboradores });
    } catch (e: any) {
        console.error('[Mensajes colaboradores]', e);
        return NextResponse.json({ error: 'No se pudo cargar el equipo' }, { status: 500 });
    }
}
