import type { Page } from 'playwright';
import { prisma } from '../../../lib/db';
import { formatDate, formatDateTime } from '../../../lib/format-date';
import { codigoCortoDeVenta, esCristal, esDeLab } from '../../../lib/laboratorios/identidad';
import { InternalMessagingService } from '../../internal-messaging.service';
import { claveDeModulo } from '../contrato';
import { destinatariosDeExtras } from '../carga/extras-no-cobrados';
import { API_BASE, clientIdSmartLab, LAB_GRUPO_OPTICO, NOMBRE_GRUPO_OPTICO, pedirJsonDesdeLaPagina } from './portal';

/**
 * EL STOCK VIRTUAL DE GRUPO ÓPTICO (Ishtar, 16/10/2026).
 *
 * La óptica compra por adelantado N pares de un cristal de stock a un precio
 * menor que el de lista ("stock virtual"); cada pedido de laboratorio entrega
 * medio par o un par de ese saldo. En SmartLab se ve en Sistema → Cuentas
 * corrientes → Comprobante "Virtuales" (comprado / entregado / pendiente), y
 * la API lo devuelve con `currentAcount/list … type=3` (1 facturas, 2 remitos).
 *
 * El sistema NO lleva ese stock: lo LEE el robot en cada pasada de
 * seguimiento (misma sesión que el listado de pedidos) y avisa dos cosas:
 *   · entró un pedido de un cristal que no tiene stock virtual → pedir que
 *     carguen (una vez por venta);
 *   · se acabó el stock virtual de un artículo → pedir que carguen (una vez
 *     por artículo, hasta que vuelva a haber).
 * Solo cristales: ni tratamientos, ni teñidos, ni promociones 2x1 (regla de
 * Ishtar). Los avisos van a las cuentas ADMIN por la mensajería interna.
 *
 * Lo leído queda en SystemSetting (`lab-modulo:GRUPO_OPTICO:stock-virtual`)
 * para que la ficha muestre el saldo al preparar sin tocar el portal.
 */

/** Una fila de "Virtuales" tal como la devuelve la API del portal. */
export interface FilaVirtual {
    IdVentaVirtual: string;
    IdArticulo: string;
    articuloNombre: string;
    Codigo: string;
    Comprado: string;
    Entregado: string;
    Pendiente: string;
    fecha: string;
    formularioVirtual?: string | null;
    puntoVentaVirtual?: string | null;
    formularioVirtualNro?: string | null;
}

export interface SaldoVirtual {
    articleId: string;
    nombre: string;
    codigo: string;
    /** En pares (0,5 = un cristal). */
    comprado: number;
    entregado: number;
    pendiente: number;
    ultimaCompra: string | null;
}

/** Lo que el sistema guarda de la última lectura (SystemSetting). */
export interface FotoStockVirtual {
    leidoEl: string;
    saldos: SaldoVirtual[];
    /** Artículo (nombre del portal) → cuándo se avisó que se acabó. Se borra al volver a haber. */
    agotadosAvisados: Record<string, string>;
    /** orderId → cuándo se avisó "entró un pedido sin stock virtual". */
    ventasAvisadas: Record<string, string>;
}

/**
 * Qué artículo virtual del portal corresponde a cada cristal de stock del CRM.
 * `crm` se aplica al nombre del producto ("Stock · Orgánico Blue c/AR 1.56 ·
 * Rango Extendido"); `portal` al `articuloNombre` de la fila virtual. Solo los
 * artículos que Grupo Óptico vende como virtual (visto en el portal el
 * 16/10/2026): fotocromático, policarbonato y mineral no tienen virtual y no
 * generan aviso.
 */
export const ARTICULOS_VIRTUALES: { nombre: string; crm: RegExp; portal: RegExp }[] = [
    { nombre: 'Orgánico Blanco 1.49 (stock)', crm: /^stock\b.*org[aá]nico blanco 1\.49(?!.*rango)/i, portal: /^ORG BLANCO 1\.49 STOCK VIRTUAL/i },
    { nombre: 'Orgánico Blanco 1.49 (rango extendido)', crm: /^stock\b.*org[aá]nico blanco 1\.49.*rango extendido/i, portal: /^ORG BLANCO 1\.49 R\.? ?EXT/i },
    { nombre: 'Orgánico Blanco c/AR 1.56 (stock)', crm: /^stock\b.*org[aá]nico blanco c\/ar 1\.56(?!.*rango)/i, portal: /^ORG C\/AR BLANCO 1\.56 STOCK/i },
    { nombre: 'Orgánico Blanco c/AR 1.56 (rango extendido)', crm: /^stock\b.*org[aá]nico blanco c\/ar 1\.56.*rango extendido/i, portal: /^ORG C\/AR BLANCO 1\.56 R\.? ?EXT/i },
    { nombre: 'Orgánico Blue c/AR 1.56 (stock)', crm: /^stock\b.*org[aá]nico blue c\/ar 1\.56(?!.*rango)/i, portal: /^ORG BLUE C\/AR 1\.56 STOCK/i },
    { nombre: 'Orgánico Blue c/AR 1.56 (rango extendido)', crm: /^stock\b.*org[aá]nico blue c\/ar 1\.56.*rango extendido/i, portal: /^ORG BLUE C\/AR 1\.56 R\.? ?EXT/i },
    { nombre: 'Orgánico Super Blue 1.60 (stock)', crm: /^stock\b.*super blue.*1\.60(?!.*rango)/i, portal: /^ORG SUPER BLUE ASF C\/AR\.? 1\.60 STOCK/i },
    { nombre: 'Orgánico Super Blue 1.60 (rango extendido)', crm: /^stock\b.*super blue.*1\.60.*rango extendido/i, portal: /^ORG SUPER BLUE ASF C\/AR\.? 1\.60 R\.? ?EXT/i },
    { nombre: 'Bifocal Flat Top Orgánico Blanco', crm: /^bifocal flat top\b.*org[aá]nico blanco/i, portal: /^BIF F\.?T\.? ORGANICO VIRTUAL/i },
    { nombre: 'Bifocal Flat Top Blue Light Cut', crm: /^bifocal flat top\b.*blue light/i, portal: /^BIF F\.?T\.? ORG BLUE LIGHT CUT VIRTUAL/i },
];

/** Cuántos días hacia atrás se miran las ventas enviadas para avisar "entró un pedido sin stock virtual". */
export const VENTANA_PEDIDOS_NUEVOS_DIAS = 7;
/** Las ventas avisadas se recuerdan este tiempo (después no importa: ya salieron de la ventana). */
const RECORDAR_VENTAS_AVISADAS_DIAS = 60;

const n = (s: unknown) => { const v = Number(String(s ?? '').replace(',', '.')); return Number.isFinite(v) ? v : 0; };
const limpio = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** El artículo virtual que corresponde a un producto del CRM, o null si no tiene (no es un cristal de stock con virtual, o es 2x1). Puro. */
export function articuloVirtualDe(nombreProductoCRM: string | null | undefined): { nombre: string; portal: RegExp } | null {
    const nombre = limpio(nombreProductoCRM);
    if (!nombre || /\b2x1\b/i.test(nombre)) return null;
    const a = ARTICULOS_VIRTUALES.find(x => x.crm.test(nombre));
    return a ? { nombre: a.nombre, portal: a.portal } : null;
}

/** Suma las compras virtuales por artículo del portal. Puro. */
export function saldoPorArticulo(filas: FilaVirtual[]): SaldoVirtual[] {
    const por = new Map<string, SaldoVirtual>();
    for (const f of filas) {
        const id = limpio(f.IdArticulo) || limpio(f.articuloNombre);
        const s = por.get(id) ?? { articleId: id, nombre: limpio(f.articuloNombre), codigo: limpio(f.Codigo), comprado: 0, entregado: 0, pendiente: 0, ultimaCompra: null };
        s.comprado += n(f.Comprado); s.entregado += n(f.Entregado); s.pendiente += n(f.Pendiente);
        const fecha = limpio(f.fecha).slice(0, 10);
        if (fecha && (!s.ultimaCompra || fecha > s.ultimaCompra)) s.ultimaCompra = fecha;
        por.set(id, s);
    }
    // Redondeo a medio par: la API suma decimales ("1.500").
    for (const s of por.values()) { s.comprado = Math.round(s.comprado * 2) / 2; s.entregado = Math.round(s.entregado * 2) / 2; s.pendiente = Math.round(s.pendiente * 2) / 2; }
    return [...por.values()].sort((a, b) => b.pendiente - a.pendiente || a.nombre.localeCompare(b.nombre));
}

/** El saldo virtual que le toca a un producto del CRM: cuántos pares quedan, o null si el producto no tiene artículo virtual. Puro. */
export function saldoDe(saldos: SaldoVirtual[], nombreProductoCRM: string | null | undefined): { articulo: string; pendiente: number; comprado: number; existe: boolean } | null {
    const a = articuloVirtualDe(nombreProductoCRM);
    if (!a) return null;
    const delPortal = saldos.filter(s => a.portal.test(s.nombre));
    return {
        articulo: a.nombre,
        pendiente: delPortal.reduce((t, s) => t + s.pendiente, 0),
        comprado: delPortal.reduce((t, s) => t + s.comprado, 0),
        existe: delPortal.length > 0,
    };
}

export interface VentaParaStock {
    id: string;
    cliente: string;
    labSentAt: Date | string | null;
    /** Una venta 2x1 no se mira (Ishtar: el stock virtual no aplica a promociones). */
    es2x1: boolean;
    items: { nombre: string; esCristalDeGO: boolean }[];
}

export interface AvisoDeVenta { orderId: string; cliente: string; cristal: string; articulo: string; pendiente: number; existe: boolean; labSentAt: Date | string | null }

/** Las ventas (no avisadas todavía) con un cristal cuyo saldo virtual está en cero. Puro. */
export function ventasSinStock(ventas: VentaParaStock[], saldos: SaldoVirtual[], yaAvisadas: Record<string, string> = {}): AvisoDeVenta[] {
    const out: AvisoDeVenta[] = [];
    for (const v of ventas) {
        if (v.es2x1 || yaAvisadas[v.id]) continue;
        const vistos = new Set<string>();
        for (const it of v.items) {
            if (!it.esCristalDeGO) continue;
            const s = saldoDe(saldos, it.nombre);
            if (!s || s.pendiente > 0 || vistos.has(s.articulo)) continue;
            vistos.add(s.articulo);
            out.push({ orderId: v.id, cliente: v.cliente, cristal: limpio(it.nombre), articulo: s.articulo, pendiente: s.pendiente, existe: s.existe, labSentAt: v.labSentAt });
        }
    }
    return out;
}

/**
 * Qué artículos se acabaron (pendiente en cero) y todavía no se avisaron, y
 * cuáles volvieron a tener (para olvidar el aviso). Solo artículos declarados
 * en ARTICULOS_VIRTUALES. Puro.
 */
export function transicionesDeStock(saldos: SaldoVirtual[], agotadosAvisados: Record<string, string>): { agotados: SaldoVirtual[]; repuestos: string[] } {
    const declarados = saldos.filter(s => ARTICULOS_VIRTUALES.some(a => a.portal.test(s.nombre)));
    return {
        agotados: declarados.filter(s => s.pendiente <= 0 && !agotadosAvisados[s.nombre]),
        repuestos: declarados.filter(s => s.pendiente > 0 && agotadosAvisados[s.nombre]).map(s => s.nombre),
    };
}

const pares = (x: number) => `${x.toLocaleString('es-AR')} ${x === 1 ? 'par' : 'pares'}`;

/** El texto del aviso "entró un pedido sin stock virtual". Puro. */
export function textoAvisoVenta(a: AvisoDeVenta, urlFicha: string): string {
    return [
        `📦 Entró un pedido de ${a.cristal} y NO hay stock virtual de ${a.articulo}${a.existe ? ` (quedan ${pares(a.pendiente)})` : ' (nunca se compró virtual de este artículo)'}. Pedí que carguen stock.`,
        `Venta ${codigoCortoDeVenta(a.orderId)} · ${a.cliente}${a.labSentAt ? ` · enviada ${formatDate(a.labSentAt)}` : ''}.`,
        `Ficha: ${urlFicha}`,
    ].join('\n');
}

/** El texto del aviso "se acabó el stock virtual". Puro. */
export function textoAvisoAgotado(s: SaldoVirtual): string {
    return `📦 Se acabó el stock virtual de ${s.nombre} en ${NOMBRE_GRUPO_OPTICO} (comprado ${pares(s.comprado)}, entregado ${pares(s.entregado)}${s.ultimaCompra ? `, última compra ${formatDate(s.ultimaCompra)}` : ''}). Pedí que carguen stock.`;
}

// ── Portal ──

const urlVirtuales = (clientId = clientIdSmartLab()) => `${API_BASE}/system/currentAcount/list?rowCount=1000&current=1&clientId=${clientId}&type=3&category=1`;

/** Las compras virtuales del cliente, tal como las lista el portal (solo lectura). */
export async function leerStockVirtual(page: Page): Promise<FilaVirtual[]> {
    const r = await pedirJsonDesdeLaPagina<unknown>(page, urlVirtuales());
    if (!Array.isArray(r)) throw new Error(`La API de ${NOMBRE_GRUPO_OPTICO} no devolvió la lista de virtuales (${typeof r}).`);
    return r.filter((f): f is FilaVirtual => !!f && typeof f === 'object' && 'articuloNombre' in f);
}

// ── Sistema ──

const CLAVE = claveDeModulo(LAB_GRUPO_OPTICO, 'stock-virtual');

export async function leerFotoStockVirtual(): Promise<FotoStockVirtual | null> {
    const fila = await prisma.systemSetting.findUnique({ where: { key: CLAVE } }).catch(() => null);
    if (!fila?.value) return null;
    try { return JSON.parse(fila.value) as FotoStockVirtual; } catch { return null; }
}

async function guardarFoto(foto: FotoStockVirtual): Promise<void> {
    const value = JSON.stringify(foto);
    await prisma.systemSetting.upsert({ where: { key: CLAVE }, update: { value }, create: { key: CLAVE, value } })
        .catch(err => console.error('[Grupo Óptico] no se pudo guardar el stock virtual:', err));
}

/** Las ventas de Grupo Óptico enviadas en los últimos días, con sus cristales, para cruzar contra el saldo. */
async function ventasRecientes(ahora: Date): Promise<VentaParaStock[]> {
    const desde = new Date(ahora.getTime() - VENTANA_PEDIDOS_NUEVOS_DIAS * 86400000);
    const ordenes = await prisma.order.findMany({
        where: { isDeleted: false, orderType: 'SALE', labStatus: { in: ['SENT', 'IN_PROGRESS'] }, labSentAt: { gte: desde } },
        select: {
            id: true, labSentAt: true,
            client: { select: { name: true } },
            items: { select: { productNameSnapshot: true, productCategorySnapshot: true, laboratorySnapshot: true, product: { select: { name: true, category: true, laboratory: true, is2x1: true } } } },
        },
    });
    return ordenes.map(o => ({
        id: o.id,
        cliente: o.client?.name || 'sin cliente',
        labSentAt: o.labSentAt,
        // El 2x1 vive en el producto (Product.is2x1 o "2x1" en el nombre); la venta no tiene bandera propia.
        es2x1: o.items.some(i => i.product?.is2x1 || /\b2x1\b/i.test(i.product?.name ?? i.productNameSnapshot ?? '')),
        items: o.items.map(i => ({ nombre: i.product?.name ?? i.productNameSnapshot ?? '', esCristalDeGO: esCristal(i) && esDeLab(i, LAB_GRUPO_OPTICO) })),
    })).filter(v => v.items.some(i => i.esCristalDeGO));
}

const urlFicha = (orderId: string) => `${(process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')}/admin/ventas?id=${orderId}`;

async function avisarALasAdmin(texto: string, dedupePrefijo: string): Promise<void> {
    const admins = await destinatariosDeExtras(null);
    if (!admins.length) { console.error('[Grupo Óptico] stock virtual: no hay cuentas ADMIN a quien avisar'); return; }
    for (const paraUserId of admins) {
        // Urgente y con copia al celular: es para que Ishtar pida que carguen stock (19/10/2026: "que me mande mensaje por WhatsApp").
        await InternalMessagingService.mensajeDeIA({ paraUserId, cuerpo: texto, urgent: true, copiaWhatsapp: true, dedupePrefijo })
            .catch(err => console.error('[Grupo Óptico] stock virtual: no se pudo avisar:', err));
    }
}

/**
 * Con las filas recién leídas del portal: guarda el saldo, avisa lo que
 * cambió (agotados) y lo que entró sin stock (ventas), y recuerda qué avisó.
 * Nunca lanza: un error acá no puede frenar el seguimiento de pedidos.
 */
export async function procesarStockVirtual(filas: FilaVirtual[], ahora = new Date()): Promise<{ saldos: number; agotados: string[]; ventasAvisadas: number }> {
    const saldos = saldoPorArticulo(filas);
    const previa = await leerFotoStockVirtual();
    const agotadosAvisados = { ...(previa?.agotadosAvisados ?? {}) };
    const ventasAvisadas = { ...(previa?.ventasAvisadas ?? {}) };
    const resultado = { saldos: saldos.length, agotados: [] as string[], ventasAvisadas: 0 };
    try {
        const { agotados, repuestos } = transicionesDeStock(saldos, agotadosAvisados);
        for (const nombre of repuestos) delete agotadosAvisados[nombre];
        for (const s of agotados) {
            await avisarALasAdmin(textoAvisoAgotado(s), `📦 Se acabó el stock virtual de ${s.nombre}`);
            agotadosAvisados[s.nombre] = ahora.toISOString();
            resultado.agotados.push(s.nombre);
        }
        const ventas = await ventasRecientes(ahora);
        for (const a of ventasSinStock(ventas, saldos, ventasAvisadas)) {
            await avisarALasAdmin(textoAvisoVenta(a, urlFicha(a.orderId)), `📦 Entró un pedido de ${a.cristal} y NO hay stock virtual`);
            ventasAvisadas[a.orderId] = ahora.toISOString();
            resultado.ventasAvisadas++;
        }
        // Lo avisado hace mucho ya no importa (salió de la ventana).
        const corte = ahora.getTime() - RECORDAR_VENTAS_AVISADAS_DIAS * 86400000;
        for (const [id, iso] of Object.entries(ventasAvisadas)) if (new Date(iso).getTime() < corte) delete ventasAvisadas[id];
    } catch (err) {
        console.error('[Grupo Óptico] stock virtual: fallaron los avisos (el saldo se guarda igual):', err);
    }
    await guardarFoto({ leidoEl: ahora.toISOString(), saldos, agotadosAvisados, ventasAvisadas });
    console.log(`[Grupo Óptico] Stock virtual: ${saldos.length} artículos leídos (${formatDateTime(ahora)}); ${resultado.agotados.length} agotados avisados, ${resultado.ventasAvisadas} ventas sin stock avisadas.`);
    return resultado;
}

/** Para la ficha: una línea con el saldo virtual del cristal de un par, o null si no aplica. */
export function lineaDeStockVirtual(foto: FotoStockVirtual | null, nombreProductoCRM: string | null | undefined): string | null {
    const a = articuloVirtualDe(nombreProductoCRM);
    if (!a) return null;
    if (!foto) return `Stock virtual de ${a.nombre}: el robot todavía no lo leyó del portal.`;
    const s = saldoDe(foto.saldos, nombreProductoCRM)!;
    const cuando = formatDateTime(foto.leidoEl);
    if (s.pendiente <= 0) return `⚠️ SIN stock virtual de ${a.nombre}${s.existe ? '' : ' (nunca se compró)'}: este par sale a precio de lista. Pedí que carguen stock (leído ${cuando}).`;
    return `Stock virtual de ${a.nombre}: quedan ${pares(s.pendiente)} (leído ${cuando}).`;
}
