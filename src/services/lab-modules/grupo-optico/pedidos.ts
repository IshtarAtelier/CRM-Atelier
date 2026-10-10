import { parseLabNumbers } from '../../../lib/lab-order-numbers';
import type { InvoiceRef } from '../../lab-recon/types';
import type { EstadoEnPortal, PedidoEnPortal } from '../contrato';
import { numeroProvisorio } from '../estados';

/**
 * LO PURO DEL SEGUIMIENTO DE GRUPO ÓPTICO (portal SmartLab): cómo se lee un
 * pedido de la API JSON del portal, qué estado del marco le corresponde, qué
 * es un pedido "trabado" y qué números del CRM el portal no tiene. Sin
 * navegador ni base: lo prueba `npm run check:lab-modulos`.
 *
 * La fuente es la API JSON interna del portal (la misma que usa su página:
 * `laboratory/order/list`, relevada el 3/10/2026), que trae TODO por pedido.
 * smartlab.service.ts (borrado ese día) raspaba la tabla HTML —barra de
 * progreso, columna "sector", fecha "dd-mm-yy"— y después buscaba cada nº con
 * el buscador, 7 s por pedido; la API devuelve lo mismo en una sola pasada.
 */

/** Un pedido tal como lo devuelve la API del portal (solo lo que se usa). */
export interface FilaApiSmartLab {
    IdPedido: string | number;
    /** "2026-10-02 18:02:01.000", hora argentina. */
    FechaRegistro?: string | null;
    /** null hasta que el pedido termina. */
    FechaFin?: string | null;
    Anulado?: string | number | null;
    /** El "Código interno" que carga el vendedor (hoy "Laura Santucho 1°par"). */
    CodigoOptica?: string | null;
    Observacion?: string | null;
    sector?: string | null;
    /** 2 = validación, 17 = facturación finalizado, 20 = entregado. */
    sector_id?: string | number | null;
    progress?: string | number | null;
    is_rework?: boolean | string | number | null;
    Reclamo?: string | null;
    invoices?: { salesId?: string | number | null; letter?: string | null; number?: string | null; type?: string | null }[] | null;
}

export const SECTOR_VALIDACION = 2;
export const SECTOR_FACTURACION_FINALIZADO = 17;
export const SECTOR_ENTREGADO = 20;

const API_BASE = 'https://grupooptico.dyndns.info/smartlab-api-v2/public/index.php';

/**
 * Link al PDF de un comprobante en el portal: el mismo que arma su página al
 * tocar la factura (`openInvoice`). Verificado el 25/9/2026 con los dos de
 * Rius Belen (80544194): devuelve el PDF aun sin la sesión. `t` es 2 para los
 * remitos X y 1 para las facturas. Puro.
 */
export function linkComprobante(salesId: string, pedido: string, tipo: string): string {
    return `${API_BASE}/laboratory/order/invoice?id=${encodeURIComponent(salesId)}&pedido=${encodeURIComponent(pedido)}&t=${tipo === 'r' ? 2 : 1}&c=1`;
}

const esUno = (v: unknown) => String(v ?? '').trim() === '1' || v === true;
const numero = (v: unknown) => { const n = parseFloat(String(v ?? '')); return Number.isNaN(n) ? null : n; };

/** El nº de pedido (solo dígitos); null si la fila no trae uno. Puro. */
export function numeroDeFila(row: Pick<FilaApiSmartLab, 'IdPedido'>): string | null {
    return parseLabNumbers(String(row.IdPedido ?? ''))[0] ?? null;
}

/**
 * La fecha de la API ("2026-10-02 18:02:01.000") es hora ARGENTINA sin zona.
 * El provider la parseaba con `new Date(s.replace(' ', 'T'))`, que es hora
 * local del servidor: en Railway (UTC) corría tres horas. Puro.
 */
export function fechaDelPortal(texto: string | null | undefined): Date | null {
    const m = String(texto || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) return null;
    const [, a, mes, d, h = '00', mi = '00', s = '00'] = m;
    const fecha = new Date(`${a}-${mes}-${d}T${h}:${mi}:${s}-03:00`);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/**
 * La misma fecha como la ve una persona: "02/10/2026 18:02". Se reordena el
 * texto sin pasar por Date, así no depende de la zona del servidor (en el
 * contenedor, `format()` de date-fns la mostraría en UTC). Puro.
 */
export function fechaDelPortalEnTexto(texto: string | null | undefined): string {
    const m = String(texto || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    if (!m) return '';
    const [, a, mes, d, h, mi] = m;
    return h ? `${d}/${mes}/${a} ${h}:${mi}` : `${d}/${mes}/${a}`;
}

/** Días corridos enteros entre la fecha y ahora (nunca negativo). Puro. */
export function diasDesde(fecha: Date | null, ahora: Date): number {
    if (!fecha) return 0;
    return Math.max(0, Math.floor((ahora.getTime() - fecha.getTime()) / 86400000));
}

/** El progreso 0..100 de la fila (la API lo da como número o string). Puro. */
export function progresoDeFila(row: Pick<FilaApiSmartLab, 'progress'>): number {
    const p = numero(row.progress) ?? 0;
    return Math.max(0, Math.min(100, Math.round(p)));
}

/**
 * El estado del marco a partir de la fila. SmartLab no tiene UN campo de
 * estado: tiene anulado, el sector, el progreso y la fecha de fin. Puro.
 */
export function estadoDeFila(row: FilaApiSmartLab): EstadoEnPortal {
    if (esUno(row.Anulado)) return 'ANULADO';
    if (numero(row.sector_id) === SECTOR_ENTREGADO) return 'DESPACHADO';
    if (progresoDeFila(row) >= 100 || String(row.FechaFin || '').trim()) return 'TERMINADO';
    if (progresoDeFila(row) > 0) return 'EN_PROCESO';
    return 'INGRESADO';
}

/** El par que dice un texto ("1°par", "2° par", "2do par", "primer/segundo par"). null si no dice. Puro. */
function parEnTexto(texto: string): 1 | 2 | null {
    const t = texto.toLowerCase();
    const dos = /(?:^|\D)2\s*(?:[°ºo]|do)?\s*par\b|segundo\s+par/.test(t);
    const uno = /(?:^|\D)1\s*(?:[°ºo]|er|ro)?\s*par\b|primer\s+par/.test(t);
    if (dos) return 2; // la observación del 2º par nombra al 1º ("1° par n° 80…"): manda el 2
    if (uno) return 1;
    return null;
}

/** El par que dice el "Código interno" (es lo que escribe el robot: "#XXXX Nombre 2°par"). Puro. */
export function parDelCodigo(codigoOptica: string | null | undefined): 1 | 2 | null {
    return parEnTexto(String(codigoOptica || ''));
}

/**
 * Qué par es, si el vendedor lo escribió. Primero el código interno; si no
 * dice, la observación, donde "2° par" gana: la del 2º par nombra al 1º
 * ("2° par SIN CARGO - 1° par n° 80…", "vincular al 1°par pedido 80…"). Puro.
 */
export function parDeFila(row: Pick<FilaApiSmartLab, 'CodigoOptica' | 'Observacion'>): 1 | 2 | null {
    return parDelCodigo(row.CodigoOptica) ?? parEnTexto(String(row.Observacion || ''));
}

/**
 * Un pedido TRABADO: lleva dos días o más en validación (sector 2) o casi sin
 * avanzar (menos del 15 %), y no está anulado ni terminado. Misma regla que el
 * mail de "pedidos trabados" del servicio viejo; ahora va al reporte semanal. Puro.
 */
export const DIAS_PARA_TRABADO = 2;
export const PROGRESO_MINIMO_SANO = 15;

export function esTrabado(row: FilaApiSmartLab, ahora: Date): boolean {
    const estado = estadoDeFila(row);
    if (estado === 'ANULADO' || estado === 'TERMINADO' || estado === 'DESPACHADO') return false;
    if (diasDesde(fechaDelPortal(row.FechaRegistro), ahora) < DIAS_PARA_TRABADO) return false;
    return numero(row.sector_id) === SECTOR_VALIDACION || progresoDeFila(row) < PROGRESO_MINIMO_SANO;
}

/** Los comprobantes de la fila con su link; sin importe (eso lo sabe la etapa de costos). Puro. */
export function comprobantesDeFila(row: FilaApiSmartLab, pedido: string): InvoiceRef[] {
    return (row.invoices || [])
        .filter(i => i && String(i.number || '').trim())
        .map(i => ({
            comprobante: `${i.letter ? `${String(i.letter)}-` : ''}${String(i.number)}`,
            importe: null,
            url: i.salesId ? linkComprobante(String(i.salesId), pedido, String(i.type ?? '')) : null,
            tipo: String(i.type ?? '') === 'r' ? 'remito' as const : 'factura' as const,
        }));
}

/** El código corto de la venta (#A1B2) dentro del "Código interno"; null si no lo tiene. Puro. */
export function codigoDeVenta(codigoInterno: string | null | undefined): string | null {
    // La forma la fija lib/laboratorios/identidad.ts (codigoCortoDeVenta): "#" + 4 letras.
    const m = String(codigoInterno || '').match(/#([A-Za-z0-9]{4})\b/);
    return m ? `#${m[1].toUpperCase()}` : null;
}

/** De la fila de la API al pedido normalizado del marco; null si no trae nº. Puro. */
export function normalizarPedido(row: FilaApiSmartLab): PedidoEnPortal | null {
    const num = numeroDeFila(row);
    if (!num) return null;
    const codigo = String(row.CodigoOptica || '').trim();
    const comprobantes = comprobantesDeFila(row, num);
    return {
        portalNumber: num,
        // Solo el código corto de la venta (#A1B2) sirve para vincular. Hasta el
        // 3/10/2026 el "Código interno" era el nombre del cliente ("Laura
        // Santucho 1°par"), y vincular por nombre ESCRIBE el nº en la venta:
        // con dos ventas de la misma persona o un reproceso, el nº terminaría
        // en la venta equivocada. Sin código, vincula solo el nº tipeado.
        internalRef: codigoDeVenta(codigo),
        pair: parDeFila(row),
        statusRaw: String(row.sector || '').trim(),
        status: estadoDeFila(row),
        // El portal no tiene otro nombre que el código interno.
        cliente: codigo || null,
        enteredAt: fechaDelPortal(row.FechaRegistro),
        // FechaFinEstimada no sirve: casi siempre es igual a FechaRegistro.
        estimatedAt: null,
        finishedAt: fechaDelPortal(row.FechaFin),
        // No hay fecha de entrega en la API.
        dispatchedAt: null,
        ...(comprobantes.length ? { invoices: comprobantes } : {}),
        raw: { progress: progresoDeFila(row), sector_id: numero(row.sector_id), is_rework: esUno(row.is_rework) || esUno(row.Reclamo) },
    };
}

/**
 * ¿Hay que pedir la página siguiente? Sí mientras la página venga llena
 * (100 filas) y su pedido más viejo siga dentro de la ventana. La API viene
 * ordenada de más nuevo a más viejo. Puro.
 */
export const FILAS_POR_PAGINA = 100;

export function seguirPaginando(rows: Pick<FilaApiSmartLab, 'FechaRegistro'>[], desde: Date): boolean {
    if (rows.length < FILAS_POR_PAGINA) return false;
    const ultima = fechaDelPortal(rows[rows.length - 1]?.FechaRegistro);
    return !ultima || ultima >= desde;
}

/**
 * Los números activos del CRM que el portal NO tiene: ni en esta lectura ni
 * en el espejo (una lectura corta no trae lo viejo, pero el espejo lo guarda).
 * Casi siempre es un nº tipeado mal en la venta. Sin repetidos. Puro.
 */
export function numerosNoEncontrados(activos: Iterable<string>, vistos: Iterable<string>, enEspejo: Iterable<string>): string[] {
    const conocidos = new Set([...vistos, ...enEspejo]);
    return [...new Set(activos)].filter(n => !conocidos.has(n));
}

/**
 * Los números de pedido que el CRM tiene para una venta: los del campo de la
 * venta (salvo que sea provisorio, "SML-…" o "sin nº") y los de sus
 * reprocesos. Una sola regla de parseo: parseLabNumbers. Puro.
 */
export function numerosActivosDeVenta(v: { labOrderNumber: string | null; postSaleNumbers: string[] }): string[] {
    const propios = numeroProvisorio(v.labOrderNumber) ? [] : parseLabNumbers(v.labOrderNumber);
    return [...new Set([...propios, ...v.postSaleNumbers.flatMap(n => parseLabNumbers(n))])];
}

export const TEXTO_NO_ENCONTRADO = 'NO ENCONTRADO EN EL PORTAL';

/** Un pedido tal como lo muestra el tracker de la ficha. Puro. */
export interface DetalleTracker {
    num: string;
    sector: string;
    progress: number;
    /** "02/10/2026 18:02" */
    entryDate: string;
    days: number;
    anulado?: boolean;
}

export function detalleDeFila(row: FilaApiSmartLab, ahora: Date): DetalleTracker | null {
    const num = numeroDeFila(row);
    if (!num) return null;
    return {
        num,
        sector: String(row.sector || '').trim(),
        progress: progresoDeFila(row),
        entryDate: fechaDelPortalEnTexto(row.FechaRegistro),
        days: diasDesde(fechaDelPortal(row.FechaRegistro), ahora),
        anulado: esUno(row.Anulado),
    };
}

/** Lo que la ficha muestra en el "SmartLab Digital Tracker". Misma forma que escribía el servicio viejo. */
export interface Tracker {
    smartLabSector: string;
    smartLabProgress: number;
    smartLabLastSync: Date;
    smartLabEntryDate: string;
    smartLabDays: number;
    smartLabDetails: string;
}

/**
 * Resume los pedidos de una venta para la ficha: el progreso MÍNIMO (un 2x1
 * no está listo hasta que terminen los dos pares), los días del más viejo y
 * un sector por pedido. Un pedido anulado no frena el progreso de los demás.
 * Un nº que el portal no tiene queda a la vista como "NO ENCONTRADO EN EL
 * PORTAL": hasta el 3/10/2026 esa venta quedaba muda para siempre. Puro.
 */
export function resumenTracker(detalles: DetalleTracker[], noEncontrados: string[], ahora: Date): Tracker {
    const vivos = detalles.filter(d => !d.anulado);
    const paraProgreso = vivos.length ? vivos : detalles;
    const sectorDe = (d: DetalleTracker) => d.anulado ? `ANULADO (${d.sector})` : d.sector;
    const partes = [
        ...detalles.map(d => ({ num: d.num, texto: sectorDe(d) })),
        ...noEncontrados.map(n => ({ num: n, texto: TEXTO_NO_ENCONTRADO })),
    ];
    return {
        smartLabSector: partes.length === 1 ? partes[0].texto : partes.map(p => `${p.num.slice(-4)}: ${p.texto}`).join(' | '),
        smartLabProgress: paraProgreso.length ? Math.min(...paraProgreso.map(d => d.progress)) : 0,
        smartLabLastSync: ahora,
        smartLabEntryDate: detalles.map(d => d.entryDate).find(Boolean) || '',
        smartLabDays: detalles.length ? Math.max(...detalles.map(d => d.days)) : 0,
        // La forma de cada detalle la leen la ficha, el cotizador y /api/lab-ready: no cambiarla.
        smartLabDetails: JSON.stringify(detalles.map(d => ({ num: d.num, sector: sectorDe(d), progress: d.progress, entryDate: d.entryDate, days: d.days }))),
    };
}
