import { NextResponse } from 'next/server';
import { getWebSettings } from '@/lib/web-settings';

/**
 * Qué promos de la tienda están prendidas, para las pantallas del NAVEGADOR.
 *
 * POR QUÉ EXISTE
 * El carrito y la barra de anuncios son componentes de cliente que viven en el
 * layout: no pueden leer `getWebSettings()` (que pega a la base) ni les llega
 * como prop sin enhebrarla por media app. Las páginas que SÍ son de servidor
 * —/tienda, la ficha— siguen leyendo los settings directamente; esto es solo
 * para las que no pueden.
 *
 * NO DEVUELVE PLATA. Solo dice si la promo está prendida. El descuento lo
 * calcula `promo-2x1-armazones.ts` y lo cobra la ruta de Payway contra la base.
 * Un cliente que mienta acá no consigue nada: vería un cartel de más y el
 * checkout le cobraría igual.
 *
 * Público a propósito: es la misma información que cualquiera ve en la home.
 */
export const revalidate = 60;

export async function GET() {
    try {
        const s = await getWebSettings();
        return NextResponse.json({
            dosPorUnoArmazones: s.web_promo_2x1_frames === true,
            descuentoTransferencia: s.web_promo_cash_discount ?? 15,
        });
    } catch {
        // Si la base no responde, la promo se apaga. Prometer un 2x1 que el
        // checkout no va a poder aplicar es peor que no mostrarlo.
        return NextResponse.json({ dosPorUnoArmazones: false, descuentoTransferencia: 15 });
    }
}
