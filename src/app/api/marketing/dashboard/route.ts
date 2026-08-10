import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { startOfMonth, endOfMonth } from 'date-fns';
import { normalizeContactSource } from '@/lib/contact-source';
import { esVentaReal } from '@/lib/constants/ventas';

/**
 * Datos del panel "Rendimiento de Marketing" (mes en curso por defecto).
 *
 * REGLA DE ESTA RUTA: acá NO se inventa un número. Hasta el 9/8/2026 devolvía
 * un gasto fijo (metaSpent = 520000, googleSpent = 637000) y dos campañas
 * inventadas con ROAS a mano; la pantalla las mostraba con el mismo formato que
 * los datos reales, así que el CAC y el ROAS "globales" eran ficción presentada
 * como medición. Se fue todo. Lo que no tiene fuente real viaja en null y la
 * pantalla dice que no hay datos conectados.
 *
 * Dónde vive el gasto REAL hoy: el cron `/api/cron/ads-report` lo lee de la
 * Marketing API (`src/lib/ads/meta-insights.ts`) y arma el ROAS por anuncio.
 * Conectar esa fuente acá es un cambio deliberado (llamada externa lenta en una
 * ruta de pantalla), no algo para tapar con un valor de ejemplo.
 */

/**
 * Canales que SON pauta paga. Google Maps y Google orgánico NO entran: contarlos
 * como "atribuido a ads" es el falso positivo que documenta src/lib/contact-source.ts
 * (el viejo `includes('google')` metía Maps adentro de Google Ads e inflaba el retorno).
 */
const CANALES_DE_PAUTA = new Set(['Google Ads', 'Meta']);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthStr = searchParams.get('month');
    const yearStr = searchParams.get('year');

    const now = new Date();
    const targetMonth = monthStr ? parseInt(monthStr) - 1 : now.getMonth();
    const targetYear = yearStr ? parseInt(yearStr) : now.getFullYear();

    const startDate = startOfMonth(new Date(targetYear, targetMonth));
    const endDate = endOfMonth(new Date(targetYear, targetMonth));

    // 1. Órdenes vivas del mes con su cliente y sus pagos.
    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        isDeleted: false,
        status: {
          notIn: ['LOST', 'CANCELED'],
        },
      },
      select: {
        total: true,
        labStatus: true,
        // `status` faltaba: sin él, esta pantalla contaba como facturación las
        // órdenes LOST y CANCELED que tuvieran algún pago o hubieran entrado a
        // fábrica. Lo destapó unificar la regla en un solo helper — la copia
        // local se había quedado sin ese filtro.
        status: true,
        payments: { select: { amount: true } },
        client: { select: { contactSource: true } },
      },
    });

    // 2. Ventas REALES, no presupuestos. Mismo criterio que el reporte diario de
    //    ads: `Order.paid` no prueba cobro (hay filas con `paid` y cero pagos),
    //    así que la venta se mide por filas de Payment o por haber entrado a
    //    fábrica. Sin este filtro, un presupuesto PENDING sin un peso cobrado
    //    entraba a la "facturación bruta" del mes.
    // La regla vive en src/lib/constants/ventas.ts, no re-escrita acá: estaba
    // repetida en cuatro lugares y una de las copias la escribió mal.
    const ventasReales = orders.filter((o) =>
      esVentaReal({
        status: o.status,
        labStatus: o.labStatus,
        cobrado: o.payments.reduce((s, p) => s + Number(p.amount || 0), 0),
      }),
    );

    const totalSales = ventasReales.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const totalCobrado = ventasReales.reduce(
      (sum, o) => sum + o.payments.reduce((s, p) => s + Number(p.amount || 0), 0),
      0
    );
    const ordersCount = ventasReales.length;

    // 3. Atribución por origen. El nombre del canal sale del vocabulario único
    //    (src/lib/contact-source.ts) para que un mismo cliente sea LA MISMA cosa
    //    en esta pantalla, en el tablero del admin y en la ficha.
    const sourceMap: Record<string, { orders: number; revenue: number }> = {};
    let adsAttributedOrders = 0;

    for (const order of ventasReales) {
      const sourceName = normalizeContactSource(order.client?.contactSource);
      if (CANALES_DE_PAUTA.has(sourceName)) adsAttributedOrders++;

      if (!sourceMap[sourceName]) {
        sourceMap[sourceName] = { orders: 0, revenue: 0 };
      }
      sourceMap[sourceName].orders += 1;
      sourceMap[sourceName].revenue += Number(order.total || 0);
    }

    const sources = Object.entries(sourceMap)
      .map(([name, data]) => ({
        name,
        orders: data.orders,
        revenue: data.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // 4. Inversión publicitaria: esta ruta no lee ninguna API de ads. No hay
    //    fuente ⇒ no hay número. null (no 0, que se leería como "no gastaste
    //    nada"), y sin gasto no existen ni CAC ni ROAS.
    const hasSpendData = false;
    const totalSpent: number | null = null;
    const googleSpent: number | null = null;
    const metaSpent: number | null = null;
    const cac: number | null = null;
    const roas: number | null = null;

    return NextResponse.json({
      success: true,
      data: {
        // Inversión — sin fuente conectada en esta ruta.
        hasSpendData,
        totalSpent,
        googleSpent,
        metaSpent,
        cac,
        roas,
        // Campañas — misma historia: la lista vacía es la verdad, no un placeholder.
        hasCampaignData: false,
        campaigns: [] as never[],
        // Estos SÍ salen de la base.
        totalSales,
        totalCobrado,
        ordersCount,
        adsAttributedOrders,
        sources,
        // Se mantienen por compatibilidad con la pantalla: esta ruta no está
        // conectada a ninguna de las dos plataformas, y decir lo contrario
        // porque existe un token en el entorno sería otra media verdad.
        isMetaConnected: false,
        isGoogleConnected: false,
      },
    });

  } catch (error: any) {
    console.error('Error fetching marketing dashboard data:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
