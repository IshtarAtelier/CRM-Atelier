import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { buildPricingMap, cargarCatalogoWeb } from '@/lib/checkout/checkout-pricing';
import { getWebSettings } from '@/lib/web-settings';

export const dynamic = 'force-dynamic';

/**
 * Los precios de cristales que muestra la tienda. Salen de la MISMA función que
 * usa el checkout para cobrar (src/lib/checkout/checkout-pricing.ts): lo que se
 * publica y lo que se cobra no pueden separarse.
 */
export async function GET() {
    try {
        const { crystals, treatments } = await cargarCatalogoWeb(prisma);
        if (!crystals || crystals.length === 0) {
            return NextResponse.json({ error: 'No se encontraron cristales' }, { status: 404 });
        }
        const { web_cristales_opciones } = await getWebSettings();
        return NextResponse.json(buildPricingMap(crystals, treatments, web_cristales_opciones));
    } catch (error) {
        console.error('Error fetching web pricing:', error);
        return NextResponse.json({ error: 'Error al obtener precios dinámicos' }, { status: 500 });
    }
}
