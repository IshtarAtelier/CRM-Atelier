import { fechaArgentina, leerPaginador, type Paginador } from './pedidos';

/**
 * LECTURA DE LA CUENTA CORRIENTE DE VITOLEN (`/contabilidad/movimientos`), la
 * parte pura: de la página HTML a movimientos. Sin red ni base; lo prueba
 * `npm run check:lab-modulos`. Columnas y filtros en docs/vitolen-portal.md.
 *
 * Qué trae: cada comprobante (FA factura, NCA nota de crédito, REC recibo) con
 * fecha, estado, vencimiento, a qué comprobante cancela, debe/haber/saldo, el
 * total (del `title`) y el PDF. Qué NO trae: a qué pedido pertenece cada
 * factura — eso está en el PDF de cada pedido (`facturacion_automatica.pdf`).
 */

/** Las dos cuentas de Atelier en el portal (11302 y 11303), como ids internos del filtro. */
export const CUENTAS_VITOLEN = '12019,12020';

export type TipoComprobante = 'FA' | 'NCA' | 'REC' | 'OTRO';

export interface MovimientoCuenta {
    cuenta: string | null;      // "11302 - ATELIER OPTICA- CORDOBA"
    fecha: Date | null;
    comprobante: string;        // "FA 0067-01168210"
    tipo: TipoComprobante;
    numero: string;             // "0067-01168210"
    estado: string;             // "Cancelado", "Pendiente"…
    vencimiento: Date | null;
    cancelaA: string | null;    // "FA 0067-01168210" en un recibo o nota de crédito
    debe: number | null;
    haber: number | null;
    saldo: number | null;
    total: number | null;       // "Total: $159.359,90" del title (el comprobante entero)
    pdf: string | null;         // "/ventas/comprobantes/8182860.pdf"
}

const fechaDdMmYyyy = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

/** URL (relativa) de la cuenta corriente con "Todos" desde una fecha, tal como la arma el formulario. Puro. */
export function urlCuentaCorriente(desde: Date, hasta: Date | null = null, pagina = 1): string {
    const q = new URLSearchParams({
        utf8: '✓', 'q[condicion_eq]': '', 'q[desde]': fechaDdMmYyyy(desde), 'q[hasta]': hasta ? fechaDdMmYyyy(hasta) : '',
        'q[cuentas_ids]': CUENTAS_VITOLEN, 'q[cuentas_ids_mode]': 'include', commit: 'Buscar',
    });
    if (pagina > 1) q.set('page', String(pagina));
    return `/contabilidad/movimientos?${q.toString()}`;
}

/** "$159.359,90" → 159359.9; vacío → null. Puro. */
export function importeArgentino(texto: string | null | undefined): number | null {
    const t = String(texto || '').replace(/\s/g, '');
    if (!t) return null;
    const negativo = /^-|\(.*\)/.test(t);
    const n = parseFloat(t.replace(/[^\d,]/g, '').replace(',', '.'));
    if (!Number.isFinite(n)) return null;
    return negativo ? -n : n;
}

const sinTags = (html: string) => html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();

export function tipoDeComprobante(comprobante: string): TipoComprobante {
    const m = comprobante.trim().match(/^([A-Z]+)\b/);
    const sigla = m ? m[1] : '';
    return sigla === 'FA' || sigla === 'NCA' || sigla === 'REC' ? sigla : 'OTRO';
}

/** Las filas de la tabla `#movimientos`. Una fila con `colspan` es el encabezado de cuenta. Puro. */
export function parsearCuentaCorriente(html: string): MovimientoCuenta[] {
    const tabla = html.match(/<table[^>]*id="movimientos"[^>]*>([\s\S]*?)<\/table>/);
    if (!tabla) return [];
    const movimientos: MovimientoCuenta[] = [];
    let cuenta: string | null = null;
    for (const m of tabla[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
        const tr = m[1];
        if (/<th/.test(tr)) continue;
        if (/colspan=/.test(tr)) { cuenta = sinTags(tr) || null; continue; }
        const celdas = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c => c[1]);
        if (celdas.length < 8) continue;
        const comprobante = sinTags(celdas[1]);
        const total = celdas[1].match(/title="Total:\s*([^"]+)"/);
        const pdf = celdas[1].match(/href="([^"]+\.pdf)"/);
        movimientos.push({
            cuenta,
            fecha: fechaArgentina(sinTags(celdas[0])),
            comprobante,
            tipo: tipoDeComprobante(comprobante),
            numero: comprobante.replace(/^[A-Z]+\s+/, ''),
            estado: sinTags(celdas[2]),
            vencimiento: fechaArgentina(sinTags(celdas[3])),
            cancelaA: sinTags(celdas[4]) || null,
            debe: importeArgentino(sinTags(celdas[5])),
            haber: importeArgentino(sinTags(celdas[6])),
            saldo: importeArgentino(sinTags(celdas[7])),
            total: total ? importeArgentino(total[1]) : null,
            pdf: pdf ? pdf[1] : null,
        });
    }
    return movimientos;
}

/** El paginador de la cuenta corriente ("Mostrando registros 1 - 20 de 22 en total", links `page=N`). Puro. */
export function leerPaginadorCuenta(html: string): Paginador {
    return leerPaginador(html);
}

/**
 * Qué facturas están vivas (una FA anulada por una NCA que la cancela entera
 * no se cuenta como costo). Puro.
 */
export function facturasVigentes(movimientos: MovimientoCuenta[]): MovimientoCuenta[] {
    const anuladas = new Set(
        movimientos
            .filter(m => m.tipo === 'NCA' && m.cancelaA)
            .filter(nca => {
                const fa = movimientos.find(f => f.tipo === 'FA' && f.comprobante === nca.cancelaA);
                return fa && fa.debe !== null && nca.haber !== null && Math.abs(fa.debe - nca.haber) < 0.01;
            })
            .map(nca => nca.cancelaA!),
    );
    return movimientos.filter(m => m.tipo === 'FA' && !anuladas.has(m.comprobante));
}
