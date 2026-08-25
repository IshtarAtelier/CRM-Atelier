import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { PriceIncreaseService } from '@/services/price-increase.service';
import { getActor } from '@/lib/actor';

export const dynamic = 'force-dynamic';

/** Cambiar precios de catálogo es cosa del administrador, como crear productos. */
async function soloAdmin() {
    const h = await headers();
    return (h.get('x-user-role') || 'STAFF') === 'ADMIN';
}

/** GET: opciones de filtro + historial, o la vista previa de un aumento. */
export async function GET(request: Request) {
    try {
        if (!await soloAdmin()) {
            return NextResponse.json({ error: 'Solo el administrador puede ver y cambiar precios' }, { status: 403 });
        }
        const url = new URL(request.url);
        const pct = Number(url.searchParams.get('pct') || 0);

        if (!pct) {
            const [opciones, historial] = await Promise.all([
                PriceIncreaseService.options(),
                PriceIncreaseService.history(),
            ]);
            return NextResponse.json({ opciones, historial });
        }

        const filas = await PriceIncreaseService.preview({
            laboratory: url.searchParams.get('laboratorio'),
            category: url.searchParams.get('categoria'),
            brand: url.searchParams.get('marca'),
        }, pct);
        return NextResponse.json({ filas });
    } catch (error) {
        console.error('Error en la vista previa del aumento:', error);
        return NextResponse.json({ error: 'No se pudo calcular el aumento' }, { status: 500 });
    }
}

/** POST: aplica el aumento sobre los productos que la persona vio en pantalla. */
export async function POST(request: Request) {
    try {
        if (!await soloAdmin()) {
            return NextResponse.json({ error: 'Solo el administrador puede cambiar precios' }, { status: 403 });
        }
        const actor = getActor(request);
        const body = await request.json();
        const resultado = await PriceIncreaseService.apply(
            {
                laboratory: body.laboratorio ?? null,
                category: body.categoria ?? null,
                brand: body.marca ?? null,
            },
            Number(body.pct),
            actor,
            Array.isArray(body.ids) ? body.ids : undefined,
        );
        return NextResponse.json(resultado);
    } catch (error: any) {
        console.error('Error aplicando el aumento:', error);
        return NextResponse.json({ error: error?.message || 'No se pudo aplicar el aumento' }, { status: 400 });
    }
}
