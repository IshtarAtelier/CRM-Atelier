import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { AdsService } from '@/services/ads.service';

/**
 * Datos del panel "Crecimiento y salud de medición" (/admin/analitica).
 *
 * Junta en un solo lugar lo que antes había que mirar en cuatro: si el píxel y
 * las etiquetas de conversión están vivos (Meta Graph API + env del server),
 * qué registró la analítica propia, y la serie mensual de cobros/tráfico para
 * ver crecimiento. Solo lecturas; nada acá muta datos.
 */

export type CheckEstado = 'ok' | 'falta' | 'atencion';

export interface CheckMedicion {
  id: string;
  label: string;
  estado: CheckEstado;
  detalle: string;
  /** Qué hacer para destrabarlo (solo cuando estado != ok). */
  accion?: string;
}

export interface SaludMedicion {
  checks: CheckMedicion[];
  pixelVivo: Awaited<ReturnType<typeof AdsService.getPixelHealth>> | null;
  propia: {
    ultimoEvento: string | null;
    eventos7d: { tipo: string; count: number }[];
  };
}

export interface MesCrecimiento {
  mes: string; // 'YYYY-MM'
  cobrado: number;
  ordenesCobradas: number;
  visitantes: number;
  pageViews: number;
  whatsappClicks: number;
  comprasWeb: number;
  ingresosWeb: number;
  clientesNuevos: number;
}

const num = (v: bigint | number | null | undefined) => Number(v ?? 0);

export class GrowthService {
  /**
   * Estado de toda la cadena de medición, con un checklist accionable.
   * `consultarMeta: false` evita el viaje a la Graph API (p. ej. en tests).
   */
  static async getSaludMedicion(consultarMeta = true): Promise<SaludMedicion> {
    const pixelVivo = consultarMeta ? await AdsService.getPixelHealth() : null;

    const [ultimo, porTipo] = await Promise.all([
      prisma.analyticsEvent.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      prisma.analyticsEvent.groupBy({
        by: ['type'],
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } },
        _count: { _all: true },
      }),
    ]);

    const checks: CheckMedicion[] = [];
    const add = (id: string, label: string, estado: CheckEstado, detalle: string, accion?: string) =>
      checks.push({ id, label, estado, detalle, ...(accion ? { accion } : {}) });

    // — Meta Pixel (navegador) —
    const pixelPublico = process.env.NEXT_PUBLIC_META_PIXEL_ID;
    add(
      'pixel-navegador',
      'Meta Pixel (navegador)',
      pixelPublico ? 'ok' : 'falta',
      pixelPublico ? `Configurado (${pixelPublico})` : 'NEXT_PUBLIC_META_PIXEL_ID sin cargar',
      pixelPublico ? undefined : 'Cargar NEXT_PUBLIC_META_PIXEL_ID en Railway y reiniciar el servicio.',
    );

    // — Meta CAPI (server) —
    const capiOk = Boolean(process.env.META_PIXEL_ID && process.env.META_ACCESS_TOKEN);
    add(
      'meta-capi',
      'Meta Conversions API (server)',
      capiOk ? 'ok' : 'falta',
      capiOk
        ? 'Credenciales presentes: el embudo se espeja server-side (resiste adblock/iOS)'
        : 'Faltan META_PIXEL_ID y/o META_ACCESS_TOKEN en el server',
      capiOk ? undefined : 'Cargar META_PIXEL_ID y META_ACCESS_TOKEN en Railway.',
    );

    // — Pixel disparando de verdad (Graph API) —
    if (pixelVivo) {
      if (pixelVivo.pixel?.lastFiredTime) {
        const horas = (Date.now() - new Date(pixelVivo.pixel.lastFiredTime).getTime()) / 3600_000;
        add(
          'pixel-disparo',
          'Último disparo del píxel',
          horas < 48 ? 'ok' : 'atencion',
          `${pixelVivo.pixel.name || 'Pixel'} disparó por última vez: ${new Date(pixelVivo.pixel.lastFiredTime).toLocaleString('es-AR')}`,
          horas < 48
            ? undefined
            : 'Hace más de 48 h que Meta no recibe nada: revisar consentimiento, adblock del tester y que el sitio tenga tráfico.',
        );
      } else if (pixelVivo.error) {
        add(
          'pixel-disparo',
          'Último disparo del píxel',
          'atencion',
          `No se pudo consultar a Meta: ${pixelVivo.error}`,
          'Probable falta de permiso del token para leer stats del píxel. Verificar el token de Ads en Business Manager.',
        );
      }
    }

    // — Google Analytics —
    const gaId = process.env.NEXT_PUBLIC_GA_ID;
    add(
      'ga4',
      'Google Analytics 4',
      gaId ? 'ok' : 'falta',
      gaId ? `Configurado (${gaId})` : 'NEXT_PUBLIC_GA_ID sin cargar',
      gaId ? undefined : 'Cargar NEXT_PUBLIC_GA_ID en Railway.',
    );

    // — Google Ads: etiqueta base + acciones de conversión —
    const adsTag = process.env.NEXT_PUBLIC_GOOGLE_ADS_TAG_ID || process.env.GOOGLE_ADS_CONVERSION_ID;
    add(
      'ads-tag',
      'Etiqueta de Google Ads',
      adsTag?.startsWith('AW-') ? 'ok' : 'falta',
      adsTag ? `Configurada (${adsTag})` : 'Sin etiqueta AW-',
      adsTag?.startsWith('AW-')
        ? undefined
        : 'Cargar NEXT_PUBLIC_GOOGLE_ADS_TAG_ID (formato AW-…) en Railway.',
    );
    const labels: Array<[string, string, string | undefined]> = [
      ['ads-compra', 'Conversión "Compra web" (Google Ads)', process.env.GOOGLE_ADS_CONVERSION_LABEL],
      ['ads-whatsapp', 'Conversión "WhatsApp" (Google Ads)', process.env.GOOGLE_ADS_WHATSAPP_LABEL],
      ['ads-llamada', 'Conversión "Llamada" (Google Ads)', process.env.GOOGLE_ADS_CALL_LABEL],
    ];
    for (const [id, label, valor] of labels) {
      add(
        id,
        label,
        valor ? 'ok' : 'falta',
        valor ? 'Etiqueta instalada' : 'Sin etiqueta: Google Ads no ve esta conversión',
        valor
          ? undefined
          : 'En Google Ads → Objetivos → Conversiones → la acción → "Instalar manualmente": copiar la parte después de la barra y cargarla en Railway.',
      );
    }

    // — Analítica propia —
    const eventos7d = porTipo
      .map((r) => ({ tipo: r.type, count: r._count._all }))
      .sort((a, b) => b.count - a.count);
    const horasPropia = ultimo ? (Date.now() - ultimo.createdAt.getTime()) / 3600_000 : Infinity;
    add(
      'analitica-propia',
      'Analítica propia (embudo interno)',
      ultimo ? (horasPropia < 48 ? 'ok' : 'atencion') : 'falta',
      ultimo
        ? `Último evento: ${ultimo.createdAt.toLocaleString('es-AR')} · ${eventos7d.reduce((a, e) => a + e.count, 0)} eventos en 7 días`
        : 'Nunca registró un evento',
      horasPropia < 48
        ? undefined
        : 'Sin eventos recientes: si hay tráfico real, revisar /api/web/track y el AnalyticsTracker del layout.',
    );

    return {
      checks,
      pixelVivo,
      propia: {
        ultimoEvento: ultimo ? ultimo.createdAt.toISOString() : null,
        eventos7d,
      },
    };
  }

  /**
   * Serie mensual de crecimiento (últimos `meses` meses, incluido el actual).
   *
   * "Cobrado" sale de filas de Payment — la única prueba de venta real
   * (Order.paid NO prueba cobro, regla de negocio del proyecto). Lo web sale de
   * la analítica propia. Los meses sin datos aparecen en cero, no desaparecen.
   */
  static async getCrecimiento(meses = 12): Promise<MesCrecimiento[]> {
    const desde = new Date();
    desde.setDate(1);
    desde.setHours(0, 0, 0, 0);
    desde.setMonth(desde.getMonth() - (meses - 1));

    const [pagos, web, clientes] = await Promise.all([
      prisma.$queryRaw<Array<{ mes: string; cobrado: number; ordenes: bigint }>>(
        Prisma.sql`
          SELECT to_char(date_trunc('month', "date"), 'YYYY-MM') AS mes,
                 COALESCE(sum("amount"), 0) AS cobrado,
                 count(DISTINCT "orderId") AS ordenes
          FROM "Payment"
          WHERE "date" >= ${desde}
          GROUP BY 1`,
      ),
      prisma.$queryRaw<
        Array<{
          mes: string;
          visitantes: bigint;
          page_views: bigint;
          whatsapp: bigint;
          compras: bigint;
          ingresos: number | null;
        }>
      >(
        Prisma.sql`
          SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS mes,
                 count(DISTINCT "sessionId") AS visitantes,
                 count(*) FILTER (WHERE "type" = 'page_view') AS page_views,
                 count(*) FILTER (WHERE "type" IN ('whatsapp_click', 'phone_click')) AS whatsapp,
                 count(*) FILTER (WHERE "type" = 'purchase') AS compras,
                 sum("value") FILTER (WHERE "type" = 'purchase') AS ingresos
          FROM "AnalyticsEvent"
          WHERE "createdAt" >= ${desde}
          GROUP BY 1`,
      ),
      prisma.$queryRaw<Array<{ mes: string; nuevos: bigint }>>(
        Prisma.sql`
          SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS mes,
                 count(*) AS nuevos
          FROM "Client"
          WHERE "createdAt" >= ${desde} AND "isDeleted" = false
          GROUP BY 1`,
      ),
    ]);

    const porMes = new Map<string, MesCrecimiento>();
    const cursor = new Date(desde);
    for (let i = 0; i < meses; i++) {
      const clave = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      porMes.set(clave, {
        mes: clave,
        cobrado: 0,
        ordenesCobradas: 0,
        visitantes: 0,
        pageViews: 0,
        whatsappClicks: 0,
        comprasWeb: 0,
        ingresosWeb: 0,
        clientesNuevos: 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    for (const p of pagos) {
      const fila = porMes.get(p.mes);
      if (!fila) continue;
      fila.cobrado = Math.round(num(p.cobrado));
      fila.ordenesCobradas = num(p.ordenes);
    }
    for (const w of web) {
      const fila = porMes.get(w.mes);
      if (!fila) continue;
      fila.visitantes = num(w.visitantes);
      fila.pageViews = num(w.page_views);
      fila.whatsappClicks = num(w.whatsapp);
      fila.comprasWeb = num(w.compras);
      fila.ingresosWeb = Math.round(num(w.ingresos));
    }
    for (const c of clientes) {
      const fila = porMes.get(c.mes);
      if (!fila) continue;
      fila.clientesNuevos = num(c.nuevos);
    }

    return [...porMes.values()];
  }
}
