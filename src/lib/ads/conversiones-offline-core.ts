/**
 * Reglas PURAS de las conversiones offline hacia Google Ads: qué es una venta,
 * cuándo se cerró, cuánto vale y qué clic la originó. Sin imports ni Prisma,
 * para que `scripts/checks/google-conversiones.check.mjs` las pruebe con
 * strip-types y sin base.
 *
 * Por qué existe: Google ve el clic del anuncio y nunca se entera de que
 * terminó en una venta, porque el cierre pasa por WhatsApp o en el mostrador.
 * Sin esto, las campañas pujan contra "cómo llegar" y clics de llamar. El
 * service (`google-offline-conversions.service.ts`) usa estas reglas para
 * armar el lote que sube el cron.
 */

// Con alias y no relativo: así el check lo importa con el loader de `@/` sin extensión.
import { parseClickId, type ParsedClickId } from '@/lib/ads/ad-tag-core';

/** Ventana de atribución de Google para clics: una venta más vieja que esto no se une a ningún clic. */
export const VENTANA_CLIC_DIAS = 90;

export interface PagoDeVenta {
    amount: number;
    date: Date;
}

export interface VentaCandidata {
    id: string;
    total: number;
    labStatus: string | null;
    labSentAt: Date | null;
    payments: PagoDeVenta[];
}

export interface MensajeEntrante {
    content: string;
    createdAt: Date;
}

/**
 * Venta REAL, misma regla que el resto del sistema (CLAUDE.md): plata cobrada
 * (filas de Payment) o pedido en laboratorio. NUNCA `Order.paid` ni el total a
 * secas: hay presupuestos con total cargado y filas con `paid` sin un solo pago.
 */
export function esVentaReal(o: VentaCandidata): boolean {
    const enFabrica = o.labStatus != null && o.labStatus !== 'NONE';
    return enFabrica || o.payments.length > 0;
}

/**
 * Cuándo se cerró: el envío a fábrica si lo hubo (es el acto que define la
 * venta — el vendedor de una venta es quien la envió, CLAUDE.md), si no el
 * primer pago. Null si no es una venta.
 */
export function fechaDeCierre(o: VentaCandidata): Date | null {
    if (!esVentaReal(o)) return null;
    if (o.labSentAt) return o.labSentAt;
    const fechas = o.payments.map((p) => p.date.getTime()).filter((t) => Number.isFinite(t));
    return fechas.length ? new Date(Math.min(...fechas)) : null;
}

/**
 * Cuánto vale para Google: el total de la venta. Google puja por valor, y una
 * seña de $50.000 sobre $300.000 diría que el anuncio vale seis veces menos.
 * Si el total no está cargado, lo cobrado es lo único cierto.
 */
export function valorDeVenta(o: VentaCandidata): number {
    if (o.total > 0) return Math.round(o.total);
    return Math.round(o.payments.reduce((s, p) => s + (p.amount > 0 ? p.amount : 0), 0));
}

/**
 * El clic que originó la venta: el ÚLTIMO mensaje entrante con id de clic
 * anterior al cierre y dentro de la ventana de Google. Último y no primero:
 * si la persona tocó dos anuncios, Google atribuye al clic más reciente.
 */
export function clicParaLaVenta(
    mensajes: MensajeEntrante[],
    cierre: Date,
    ventanaDias: number = VENTANA_CLIC_DIAS,
): (ParsedClickId & { en: Date }) | null {
    const desde = cierre.getTime() - ventanaDias * 864e5;
    let mejor: (ParsedClickId & { en: Date }) | null = null;
    for (const m of mensajes) {
        const t = m.createdAt.getTime();
        if (t > cierre.getTime() || t < desde) continue;
        const clic = parseClickId(m.content);
        if (!clic) continue;
        if (!mejor || t > mejor.en.getTime()) mejor = { ...clic, en: m.createdAt };
    }
    return mejor;
}
