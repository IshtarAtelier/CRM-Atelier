import { NextResponse } from 'next/server';
import { sincronizarMesDeGastos, calcularEstado } from '@/services/gastos.service';

export const dynamic = 'force-dynamic';

/**
 * Deja el mes con la lista fija completa y los importes automáticos al día, y
 * devuelve los gastos junto con el estado de carga.
 *
 * Es POST y no GET a propósito: reconciliar ESCRIBE (hasta 26 upserts, más las
 * lecturas de Meta y Google). Estaba colgado del GET de /api/expenses, así que
 * abrir la pantalla mutaba la base — y un prefetch del navegador o un reintento
 * automático la mutaban también, sin que nadie lo hubiera pedido.
 */
export async function POST(request: Request) {
    try {
        const role = request.headers.get('x-user-role') || 'STAFF';
        if (role !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const month = parseInt(searchParams.get('month') || '', 10);
        const year = parseInt(searchParams.get('year') || '', 10);

        if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
            return NextResponse.json({ error: 'Mes o año inválidos' }, { status: 400 });
        }

        const gastos = await sincronizarMesDeGastos(month, year);
        return NextResponse.json({ gastos, estado: calcularEstado(gastos) });
    } catch (error: any) {
        console.error('Error sincronizando gastos:', error);
        return NextResponse.json({ error: error.message || 'Error sincronizando gastos' }, { status: 500 });
    }
}
