import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getActorValidated } from '@/lib/session-revalidation';

/**
 * KPIs del embudo web a partir de la analítica propia (AnalyticsEvent) + carritos
 * (CheckoutSession). Protegido por el middleware (requiere sesión no-OPTICA).
 * Responde: tráfico, embudo por etapa, zonas, productos, fuentes y carritos.
 */
export const dynamic = 'force-dynamic';

function parseRange(url: string) {
  const { searchParams } = new URL(url);
  const now = new Date();
  const defFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : defFrom;
  const toRaw = searchParams.get('to') ? new Date(searchParams.get('to')!) : now;
  // incluir todo el día "to"
  const to = new Date(toRaw.getTime());
  if (!searchParams.get('to')) to.setTime(now.getTime());
  return { from, to };
}

export async function GET(request: Request) {
  try {
    // Revalidación contra la DB: aunque el JWT sea válido, si el usuario fue
    // borrado o degradado (o es OPTICA) se rechaza sin esperar a que expire el token.
    const actor = await getActorValidated(request);
    if (!actor.valid || !actor.role || !['ADMIN', 'STAFF'].includes(actor.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { from, to } = parseRange(request.url);
    const range = { gte: from, lte: to };

    // Conteos por tipo de evento
    const byType = await prisma.analyticsEvent.groupBy({
      by: ['type'],
      where: { createdAt: range },
      _count: { _all: true },
    });
    const countOf = (t: string) => byType.find((r) => r.type === t)?._count._all ?? 0;

    // Visitantes únicos (sesiones distintas) y sesiones que llegaron a cada etapa
    const uniqueSessions = await prisma.analyticsEvent.findMany({
      where: { createdAt: range },
      distinct: ['sessionId'],
      select: { sessionId: true },
    });

    const sessionsAtStage = async (type: string) => {
      const rows = await prisma.analyticsEvent.findMany({
        where: { createdAt: range, type },
        distinct: ['sessionId'],
        select: { sessionId: true },
      });
      return rows.length;
    };

    const [sViewContent, sAddToCart, sBeginCheckout, sPurchase] = await Promise.all([
      sessionsAtStage('view_content'),
      sessionsAtStage('add_to_cart'),
      sessionsAtStage('begin_checkout'),
      sessionsAtStage('purchase'),
    ]);

    // Ingresos de compras registradas
    const revenueAgg = await prisma.analyticsEvent.aggregate({
      where: { createdAt: range, type: 'purchase' },
      _sum: { value: true },
      _count: { _all: true },
    });

    // Serie temporal de visitas (page_view por día)
    const traffic = await prisma.$queryRaw<Array<{ day: Date; visits: bigint; visitors: bigint }>>(
      Prisma.sql`
        SELECT date_trunc('day', "createdAt") AS day,
               count(*) AS visits,
               count(DISTINCT "sessionId") AS visitors
        FROM "AnalyticsEvent"
        WHERE "type" = 'page_view' AND "createdAt" BETWEEN ${from} AND ${to}
        GROUP BY 1 ORDER BY 1 ASC`,
    );

    // Zonas más exploradas (desde zone_view.meta.zone)
    const zones = await prisma.$queryRaw<Array<{ zone: string; views: bigint }>>(
      Prisma.sql`
        SELECT COALESCE("meta"->>'zone', 'otras') AS zone, count(*) AS views
        FROM "AnalyticsEvent"
        WHERE "type" = 'zone_view' AND "createdAt" BETWEEN ${from} AND ${to}
        GROUP BY 1 ORDER BY views DESC LIMIT 15`,
    );

    // Productos más vistos
    const topProducts = await prisma.analyticsEvent.groupBy({
      by: ['productId', 'productName'],
      where: { createdAt: range, type: 'view_content', productId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { productId: 'desc' } },
      take: 15,
    });

    // Fuentes de tráfico (utmSource; null = directo/orgánico)
    const sources = await prisma.$queryRaw<Array<{ source: string; visitors: bigint }>>(
      Prisma.sql`
        SELECT COALESCE(NULLIF("utmSource", ''), 'directo/orgánico') AS source,
               count(DISTINCT "sessionId") AS visitors
        FROM "AnalyticsEvent"
        WHERE "createdAt" BETWEEN ${from} AND ${to}
        GROUP BY 1 ORDER BY visitors DESC LIMIT 12`,
    );

    // Carritos (CheckoutSession) por estado
    const cartsByStatus = await prisma.checkoutSession.groupBy({
      by: ['status'],
      where: { createdAt: range },
      _count: { _all: true },
    });
    const cartCount = (s: string) => cartsByStatus.find((r) => r.status === s)?._count._all ?? 0;
    const cartsTotal = cartsByStatus.reduce((a, r) => a + r._count._all, 0);

    const num = (v: bigint | number) => Number(v);

    return NextResponse.json({
      range: { from, to },
      traffic: {
        visits: countOf('page_view'),
        uniqueVisitors: uniqueSessions.length,
        series: traffic.map((r) => ({
          day: r.day,
          visits: num(r.visits),
          visitors: num(r.visitors),
        })),
      },
      funnel: {
        // visitantes que alcanzaron cada etapa (para conversión honesta)
        visitors: uniqueSessions.length,
        viewedProduct: sViewContent,
        addedToCart: sAddToCart,
        beganCheckout: sBeginCheckout,
        purchased: sPurchase,
        // totales de eventos (por si interesa el volumen bruto)
        totals: {
          view_content: countOf('view_content'),
          add_to_cart: countOf('add_to_cart'),
          begin_checkout: countOf('begin_checkout'),
          add_contact: countOf('add_contact'),
          purchase: countOf('purchase'),
        },
      },
      revenue: {
        orders: revenueAgg._count._all,
        total: revenueAgg._sum.value ?? 0,
      },
      zones: zones.map((z) => ({ zone: z.zone, views: num(z.views) })),
      topProducts: topProducts.map((p) => ({
        productId: p.productId,
        productName: p.productName || '(sin nombre)',
        views: p._count._all,
      })),
      sources: sources.map((s) => ({ source: s.source, visitors: num(s.visitors) })),
      carts: {
        total: cartsTotal,
        pending: cartCount('PENDING'),
        emailSent: cartCount('EMAIL_SENT'),
        recovered: cartCount('RECOVERED'),
        completed: cartCount('COMPLETED'),
      },
    });
  } catch (error) {
    console.error('[admin/analytics] error:', error);
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 });
  }
}
