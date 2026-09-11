import { NextResponse } from 'next/server';
import { getDolarBlueVenta } from '@/lib/targets';

export const dynamic = 'force-dynamic';

/**
 * Cotización blue (venta) para las pantallas del admin.
 *
 * Existe para que el navegador NO le pregunte a Ámbito por su cuenta: tres
 * pantallas (inicio, Reportes y Objetivos) lo hacían directo, cada una con su
 * copia del parseo y sin respaldo. Si Ámbito no contesta —pasó el 10/9/2026—
 * esas pantallas se quedaban sin el equivalente en dólares. Acá sale del helper
 * único, que prueba Ámbito, después dolarapi.com, y como último recurso la
 * última cotización real de los últimos 30 días.
 *
 * `venta: null` es "no hay ninguna cotización confiable", no un error.
 */
export async function GET() {
    try {
        return NextResponse.json({ venta: await getDolarBlueVenta() });
    } catch (error) {
        console.error('Error en GET /api/dolar:', error);
        return NextResponse.json({ venta: null }, { status: 500 });
    }
}
