import { NextResponse } from 'next/server';
import { getWebSettings } from '@/lib/web-settings';
import { prisma } from '@/lib/db';

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
 * `dosPorUnoArmazones` es false si la promo está prendida pero NADIE está
 * marcado: anunciar un 2x1 que no aplica a ningún armazón es peor que no
 * anunciarlo. El interruptor prende la promo; el tilde dice sobre qué.
 *
 * Público a propósito: es la misma información que cualquiera ve en la home.
 */
// DINÁMICA, no cacheada. Escrito primero como `revalidate = 60`, Next la trató
// como estática y la sirvió con `cache-control: s-maxage=31536000` — un año — y
// `x-nextjs-cache: HIT` en cada llamada: prender o apagar la promo desde
// /admin/web no llegaba NUNCA a la tienda. Se descubrió marcando dos armazones
// y viendo que la ruta seguía diciendo que no había ninguno.
//
// El costo es una consulta de dos columnas por carga de página. El beneficio es
// que el interruptor de una promo que regala armazones hace efecto cuando se
// toca, y —más importante— que APAGARLA es inmediato.
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const s = await getWebSettings();
        const activa = s.web_promo_2x1_frames === true;

        // Qué armazones entran. Con la promo apagada ni se pregunta a la base.
        // Son ~106 ids como mucho: cabe entero en la respuesta y le ahorra al
        // carrito una consulta por producto.
        const marcados = activa
            ? (await prisma.product.findMany({
                where: { publishToWeb: true, eligible2x1Web: true },
                select: { id: true },
            })).map(p => p.id)
            : [];

        return NextResponse.json({
            dosPorUnoArmazones: activa && marcados.length > 0,
            armazones2x1: marcados,
            descuentoTransferencia: s.web_promo_cash_discount ?? 15,
        });
    } catch {
        // Si la base no responde, la promo se apaga. Prometer un 2x1 que el
        // checkout no va a poder aplicar es peor que no mostrarlo.
        return NextResponse.json({ dosPorUnoArmazones: false, armazones2x1: [], descuentoTransferencia: 15 });
    }
}
