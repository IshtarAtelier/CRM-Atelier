import type { PedidoEnPortal } from '../contrato';
import { estadoDe } from './estados';

/**
 * LECTURA DEL LISTADO DE PEDIDOS DE VITOLEN, la parte pura: de la respuesta JS
 * del portal a `PedidoEnPortal`. Sin red ni base; todo lo prueba
 * `npm run check:lab-modulos`. El mapa de columnas y filtros está en
 * docs/vitolen-portal.md.
 */

export const BASE_VITOLEN = 'https://gestion.vitolen.com';

export type PeriodoListado = 'last_30_days' | 'last_90_days' | 'last_180_days' | 'all_history';

/** Qué período del portal cubre una ventana en días (sin ventana = todo). Puro. */
export function periodoDeListado(sinceDays?: number | null): PeriodoListado {
    if (!sinceDays || sinceDays <= 0) return 'all_history';
    if (sinceDays <= 30) return 'last_30_days';
    if (sinceDays <= 90) return 'last_90_days';
    if (sinceDays <= 180) return 'last_180_days';
    return 'all_history';
}

/** URL (relativa) de la búsqueda del listado, tal como la arma el formulario del portal. Puro. */
export function urlListado(periodo: PeriodoListado, pagina = 1): string {
    const q = new URLSearchParams({ utf8: '✓', 'q[cargado_en_periodo]': periodo, 'q[vista]': 'lista', commit: 'Buscar' });
    if (pagina > 1) q.set('page', String(pagina));
    return `/ventas/pedidos?${q.toString()}`;
}

/**
 * La respuesta es JS: `$("#pedidos-container").html("<table …>")`. Se saca el
 * literal y se deshace el escape de Rails (`\"`, `\/`, `\n`, `\'`). Puro.
 */
export function extraerHtmlDeRespuestaJs(js: string): string | null {
    const m = js.match(/\$\("#pedidos-container"\)\.html\("((?:[^"\\]|\\.)*)"\)/);
    if (!m) return null;
    return m[1].replace(/\\(.)/g, (_, c: string) => ({ n: '\n', r: '\r', t: '\t' } as Record<string, string>)[c] ?? c);
}

export interface FilaListado {
    id: string;            // id interno del portal (8669159)
    numero: string;        // nº de trabajo que ve la óptica (6981382L)
    fecha: string;         // "18/10/2024 14:24"
    nroCaso: string;
    estado: string;
    despachoEstimado: string; // "22/10/2024"
    pdfPedido: string | null;
    pdfFactura: string | null;
    codigoFactura: string | null;
}

export interface Paginador {
    desde: number | null;
    hasta: number | null;
    total: number | null;
    paginas: number[];
}

const sinTags = (html: string) => html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();

const celda = (tr: string, clase: string): string => {
    const m = tr.match(new RegExp(`<td class="${clase}[^"]*"[^>]*>([\\s\\S]*?)</td>`));
    return m ? sinTags(m[1]) : '';
};

/** Las filas de la tabla `#pedidos` del listado. Puro. */
export function parsearListado(html: string): FilaListado[] {
    const filas: FilaListado[] = [];
    const re = /<tr[^>]*id="pedido_laboratorio_(\d+)"[^>]*>([\s\S]*?)<\/tr>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
        const [, id, tr] = m;
        const factura = tr.match(/facturacion_automatica\.pdf\?codigo=(\d+)/);
        const pedidoPdf = tr.match(/href="(\/ventas\/pedidos_laboratorio\/\d+\.pdf)"/);
        filas.push({
            id,
            numero: celda(tr, 'nro_trabajo'),
            fecha: celda(tr, 'fecha'),
            nroCaso: celda(tr, 'nro_caso'),
            estado: celda(tr, 'estado'),
            despachoEstimado: celda(tr, 'frd'),
            pdfPedido: pedidoPdf ? pedidoPdf[1] : null,
            pdfFactura: factura ? `/ventas/facturacion_automatica.pdf?codigo=${factura[1]}` : null,
            codigoFactura: factura ? factura[1] : null,
        });
    }
    return filas;
}

/**
 * "Mostrando registros 1 - 7 de 7 en total" y los links `page=N` del paginador.
 * Si no hay `div.paginator` (la cuenta corriente lo pone suelto), se busca en
 * toda la página. Puro.
 */
export function leerPaginador(html: string): Paginador {
    const bloque = html.match(/<div class="paginator[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? html;
    const texto = sinTags(bloque);
    const m = texto.match(/registros\s+(\d+)\s*-\s*(\d+)\s+de\s+(\d+)/i);
    const paginas = new Set<number>();
    for (const p of bloque.matchAll(/[?&;](?:amp;)?page=(\d+)/g)) paginas.add(Number(p[1]));
    return {
        desde: m ? Number(m[1]) : null,
        hasta: m ? Number(m[2]) : null,
        total: m ? Number(m[3]) : null,
        paginas: [...paginas].filter(n => n > 1).sort((a, b) => a - b),
    };
}

/** "18/10/2024 14:24" o "22/10/2024" en hora de Argentina (sin horario de verano: −03:00). Puro. */
export function fechaArgentina(texto: string | null | undefined): Date | null {
    const m = String(texto || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
    if (!m) return null;
    const [, d, mes, a, h = '0', mi = '0'] = m;
    const iso = `${a}-${mes.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${mi.padStart(2, '0')}:00-03:00`;
    const fecha = new Date(iso);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/** De la fila del listado al pedido normalizado del marco. Puro. */
export function normalizarPedido(fila: FilaListado): PedidoEnPortal {
    const ref = fila.nroCaso.trim();
    return {
        portalNumber: fila.numero.trim(),
        internalRef: ref || null,
        pair: /\b(2\s*d?o\.?|segundo)\s*par\b/i.test(ref) ? 2 : null,
        statusRaw: fila.estado.trim(),
        status: estadoDe(fila.estado),
        cliente: ref || null,
        enteredAt: fechaArgentina(fila.fecha),
        estimatedAt: fechaArgentina(fila.despachoEstimado),
        finishedAt: null,
        dispatchedAt: null,
        // Sin `invoices`: el seguimiento no sabe de comprobantes y no debe pisar
        // lo que la etapa de costos escriba en el espejo.
        raw: {
            id: fila.id,
            pdfPedido: fila.pdfPedido ? `${BASE_VITOLEN}${fila.pdfPedido}` : null,
            pdfFactura: fila.pdfFactura ? `${BASE_VITOLEN}${fila.pdfFactura}` : null,
            codigoFactura: fila.codigoFactura,
        },
    };
}
