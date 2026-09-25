import { fmtARS } from './types';
import type { InvoiceRef } from './types';

/**
 * Los comprobantes de un pedido, con su link y lo que cada uno le cobra, para
 * los correos (el reporte semanal y el aviso diario de pedidos sin venta). Un
 * solo lugar arma esto: la pantalla lo dibuja con los mismos datos
 * (`invoiceRefs`).
 *
 * Pedido de Ishtar del 25/9/2026: "en el cuadro dejame el link directo a ver
 * las facturas, para poder cruzar en nuestro sistema y en el de ellos; ídem
 * con los email de Optovisión". Un pedido de Grupo Óptico suele estar en DOS
 * comprobantes (el remito del cristal y la factura del calibrado): van los dos,
 * cada uno con lo que le cobra a ESE pedido.
 */

const esc = (v: unknown) => String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function refsDe(r: { invoiceRefs?: unknown }): InvoiceRef[] {
    return Array.isArray(r?.invoiceRefs) ? (r.invoiceRefs as InvoiceRef[]).filter(x => x && x.comprobante) : [];
}

/** HTML de los comprobantes con link; sin comprobantes guardados, `respaldo` tal cual. */
export function comprobantesHtml(r: { invoiceRefs?: unknown }, respaldo: string): string {
    const refs = refsDe(r);
    if (!refs.length) return respaldo;
    return refs.map(ref => {
        const nombre = ref.url
            ? `<a href="${esc(ref.url)}">${esc(ref.comprobante)}</a>`
            : esc(ref.comprobante);
        const donde = ref.url ? (ref.tipo === 'correo' ? ' ✉︎' : ' ↗') : '';
        const importe = ref.importe != null
            ? ` <span style="color:#6b7280;font-size:11px;font-family:Arial,sans-serif">${fmtARS(ref.importe)}</span>`
            : '';
        return `<div style="white-space:nowrap">${nombre}${donde}${importe}</div>`;
    }).join('');
}

/** Aclaración para el pie de cada correo: qué abre cada link. */
export const ACLARACION_LINKS = 'Los comprobantes con ↗ abren el PDF de la factura en el portal de Grupo Óptico; los que tienen ✉︎ abren en Gmail el correo de Optovisión con el PDF. Al lado de cada uno, lo que ese comprobante le cobra a ESE pedido.';
