import { LabCostReconciliationService } from '../lab-cost-reconciliation.service';
import { LAB_AUDIT_START_ISO } from '../../lib/constants';
import { prisma } from '../../lib/db';
import { buildPedidoAmountMap, normalizeInvoiceNumber } from './grupo-optico-invoices';
import type { InvoiceRef } from '../lab-recon/types';

/**
 * Proveedor de Grupo Óptico: lee los pedidos desde la API JSON interna del
 * portal SmartLab (la misma que usa su propia página web), paginada y estable —
 * sin scraping de pantallas. Registra TODOS los pedidos de la era CRM en la
 * conciliación con su COSTO REAL POR LÍNEA de factura: cada pedido suma sus
 * líneas de detalle en todos los comprobantes (facturas + remitos X de stock);
 * ver reglas en grupo-optico-invoices.ts. Los que tienen venta quedan
 * OK/OVERCOST/PENDING, los que no, UNMATCHED ("Sin venta") — con su importe.
 *
 * Credenciales: SMARTLAB_USER / SMARTLAB_PASSWORD (fallback a las actuales).
 */

const PORTAL_BASE = 'https://grupooptico.dyndns.info';
const API_BASE = `${PORTAL_BASE}/smartlab-api-v2/public/index.php`;
const ROWS_PER_PAGE = 100;
const MAX_PAGES = 50; // tope de seguridad (~5000 pedidos)

/**
 * UNA SOLA PASADA A LA VEZ CONTRA EL PORTAL.
 *
 * Todas las mañanas corrían dos pasadas completas juntas: la diaria de las
 * 8:30 y la "recuperación" del pase de 10 minutos (que hace una completa si la
 * última tiene más de 20 horas). Las dos pedían al mismo tiempo el PDF de
 * todos los comprobantes de la era CRM y el portal devolvía PDFs a medias:
 * medido en LabAuditRun, 374 y 195 comprobantes el 24/9/2026 contra ~640 de
 * una pasada normal. Esas lecturas escribieron importes disparatados (Rius
 * Belen con $162.872 en vez de $18.988), el resumen de las 8:38 los mandó, y
 * la pasada de las 8:47 los corrigió. Todos los días.
 *
 * El turno se reclama con un `updateMany` condicional (atómico en Postgres, y
 * sirve entre instancias). Vence solo: si una pasada muere a la mitad, a los
 * TURNO_MIN minutos otra lo puede tomar. 30 minutos cubre la pasada más larga
 * posible: la diaria tiene 25 de tope (instrumentation.ts).
 *
 * Quién espera y quién se saltea. La DIARIA espera el turno si lo tiene un
 * pase RÁPIDO (dura un par de minutos): si se salteara, ese día no habría
 * pasada completa, porque la diaria no se reintenta cuando la ruta responde
 * bien. Si lo tiene otra pasada COMPLETA (la recuperación), no espera: esa ya
 * hace el trabajo, y esperarla podía pasar el tope de 25 minutos de la diaria.
 * El pase rápido, la recuperación y el botón de la pantalla se saltean y
 * reintentan después. El valor guardado es "<vence>|<completa|rapida>".
 *
 * 45 minutos de vencimiento: la pasada normal tarda ~8, y el tope de 25 de la
 * diaria corta la espera del pedido, no el trabajo en el servidor. Solo una
 * pasada que muere sin llegar al `finally` deja el turno tomado hasta que vence.
 */
const TURNO_KEY = 'lab-provider:GRUPO_OPTICO:turno';
const TURNO_MIN = 45;
const ESPERA_TURNO_MIN = 8;
type Pasada = 'completa' | 'rapida';

export async function tomarTurnoDelPortal(pasada: Pasada = 'completa'): Promise<string | null> {
    const ahora = new Date();
    const hasta = `${new Date(ahora.getTime() + TURNO_MIN * 60000).toISOString()}|${pasada}`;
    await prisma.systemSetting.createMany({
        data: [{ key: TURNO_KEY, value: new Date(0).toISOString() }],
        skipDuplicates: true,
    });
    const tomado = await prisma.systemSetting.updateMany({
        where: { key: TURNO_KEY, value: { lt: ahora.toISOString() } },
        data: { value: hasta },
    });
    return tomado.count === 1 ? hasta : null;
}

/** Qué pasada tiene hoy el turno (null si está libre o vencido). */
async function quienTieneElTurno(): Promise<Pasada | null> {
    const v = (await prisma.systemSetting.findUnique({ where: { key: TURNO_KEY } }))?.value || '';
    const [vence, pasada] = v.split('|');
    if (!vence || vence < new Date().toISOString()) return null;
    return pasada === 'rapida' ? 'rapida' : 'completa';
}

/**
 * Espera el turno hasta `maxMs`, preguntando cada `cadaMs`, SOLO mientras lo
 * tenga un pase rápido. Si lo tiene otra pasada completa, se rinde enseguida.
 */
export async function esperarTurnoDelPortal(maxMs: number, cadaMs = 20000, pasada: Pasada = 'completa'): Promise<string | null> {
    const limite = Date.now() + maxMs;
    for (;;) {
        const turno = await tomarTurnoDelPortal(pasada);
        if (turno || Date.now() + cadaMs > limite) return turno;
        if ((await quienTieneElTurno()) === 'completa') return null;
        await new Promise(r => setTimeout(r, cadaMs));
    }
}

export async function soltarTurnoDelPortal(hasta: string) {
    await prisma.systemSetting.updateMany({
        where: { key: TURNO_KEY, value: hasta },
        data: { value: new Date(0).toISOString() },
    }).catch(err => console.error('[GrupoOptico] No se pudo soltar el turno del portal (vence solo):', err));
}

/**
 * CONTROL DE PDF INCOMPLETO. La pasada completa recuerda cuántos comprobantes
 * leyó; si la próxima lee menos del 90% de esos, el PDF vino a medias y NO se
 * tocan los importes (se deja constancia como fuente degradada). En una pasada
 * sana la cantidad solo crece: la era CRM no pierde comprobantes.
 */
const CONTEO_KEY = 'lab-provider:GRUPO_OPTICO:comprobantes';
const CONTEO_DUDOSO_KEY = 'lab-provider:GRUPO_OPTICO:comprobantes-dudoso';
const CONTEO_MINIMO = 0.9;

/**
 * Qué hacer con los comprobantes que leyó una pasada COMPLETA. Pura: la prueba
 * `npm run check:go-lineas`.
 *
 *  - `usarImportes`: si se pueden escribir los importes. No, si el PDF trae
 *    menos del 90% de la última pasada buena (vino a medias).
 *  - `completo`: si además se puede BORRAR el importe de un pedido sin líneas
 *    (sinImporteDeEstaFuente). Solo con al menos los comprobantes de la última
 *    pasada buena, y nunca sin una base (la primera pasada tras el deploy): un
 *    PDF con el 95% pasaría el control y borraría los pedidos del 5% faltante.
 *  - Autocorrección: un PDF a medias sale distinto cada vez (374, 195, 130,
 *    463 en septiembre de 2026). Si dos pasadas completas SEGUIDAS coinciden en
 *    un conteo bajo, el portal cambió de verdad (comprobantes depurados, un
 *    tope nuevo) y ese conteo pasa a ser la base. Sin esto, un cambio así
 *    dejaba a Grupo Óptico sin importes para siempre. Al aceptarlo no se borra
 *    nada: un comprobante depurado no quiere decir que el pedido no se cobró.
 */
export function evaluarConteo(n: number, previo: number, dudoso: number): {
    usarImportes: boolean; completo: boolean; nuevaBase: number | null; nuevoDudoso: number | null;
} {
    const bajo = previo > 0 && n < previo * CONTEO_MINIMO;
    const confirmaElDudoso = bajo && dudoso > 0 && Math.abs(n - dudoso) <= Math.max(2, dudoso * 0.02);
    if (bajo && !confirmaElDudoso) return { usarImportes: false, completo: false, nuevaBase: null, nuevoDudoso: n };
    return {
        usarImportes: n > 0,
        completo: previo > 0 && n >= previo,
        nuevaBase: n > 0 ? n : null,
        nuevoDudoso: 0,
    };
}

/**
 * Link al PDF de un comprobante en el portal: el mismo que arma su página al
 * tocar la factura (`openInvoice` en su código). Verificado el 25/9/2026 con
 * los dos de Rius Belen (80544194): devuelve el PDF, aun sin la sesión del
 * portal. `t` es 2 para los remitos X y 1 para las facturas.
 */
function linkComprobante(salesId: string, pedido: string, tipo: string): string {
    return `${API_BASE}/laboratory/order/invoice?id=${encodeURIComponent(salesId)}&pedido=${encodeURIComponent(pedido)}&t=${tipo === 'r' ? 2 : 1}&c=1`;
}

/** "00004-00353854" → "0004-00353854"; si no tiene la forma esperada, tal cual. */
const nroComprobante = (n: string) => /^\d+-\d+$/.test(n) ? normalizeInvoiceNumber(n) : n;

interface PortalOrder {
    num: string;
    fecha: string; // "YYYY-MM-DD HH:mm:ss.000"
    cliente: string;
    anulado: boolean;
    factura: string | null;
    invoiceNumbers: string[]; // todos los nº de factura del pedido (para cruzar importes)
    /** Los comprobantes como los da la API: con ellos se arma el link a cada uno. */
    comprobantes: { salesId: string; letter: string; number: string; type: string }[];
    rework: boolean; // el portal lo marca como reproceso/reclamo
}

export class GrupoOpticoProvider {
    static readonly providerName = 'GRUPO_OPTICO';

    /**
     * Corre la recolección. Pagina la API desde el pedido más nuevo hacia atrás
     * y corta al llegar al inicio de la auditoría (LAB_AUDIT_START_ISO), así la
     * corrida diaria refresca la era CRM completa (hoy ~3 páginas).
     *
     * `sinceDays` = pase RÁPIDO (cada 10 min con el sync de SmartLab): solo la
     * ventana reciente — alcanza para completar lo recién facturado (el portal
     * asigna los importes cuando el pedido pasa a FINALIZADO) sin re-parsear
     * toda la era en cada corrida. La pasada completa sigue siendo la diaria.
     */
    static async collect(opts: { sinceDays?: number; esperarTurno?: boolean } = {}): Promise<Record<string, any>> {
        let turno: string | null = null;
        try {
            const pasada: Pasada = opts.sinceDays ? 'rapida' : 'completa';
            turno = opts.esperarTurno
                ? await esperarTurnoDelPortal(ESPERA_TURNO_MIN * 60000, 20000, pasada)
                : await tomarTurnoDelPortal(pasada);
        } catch (err) {
            // Sin base para el turno se corre igual: mejor datos que silencio.
            console.error('[GrupoOptico] No se pudo tomar el turno del portal (se corre igual):', err);
            turno = 'sin-turno';
        }
        if (!turno) {
            console.log(`[GrupoOptico] Otra pasada contra el portal está en curso: esta (${opts.sinceDays ? 'rápida' : 'completa'}) se saltea.`);
            return { skipped: true, reason: 'otra pasada contra el portal en curso' };
        }
        try {
            return await GrupoOpticoProvider.recolectar(opts);
        } finally {
            if (turno !== 'sin-turno') await soltarTurnoDelPortal(turno);
        }
    }

    private static async recolectar(opts: { sinceDays?: number }): Promise<Record<string, any>> {
        // Dónde está Chromium. Mismo caso —y misma consecuencia— que
        // `smartlab.service.ts`: el build lo instala en `.playwright-browsers`
        // y Playwright lo busca por defecto en ~/.cache/ms-playwright, vacía en
        // el contenedor. Sin esta línea el launch falla y no entra NINGÚN costo
        // de Grupo Óptico: la última entrada era del 21/8/26, y por eso dejaron
        // de salir los avisos por mail de lo que se carga en el laboratorio.
        const nodePath = await import('path');
        process.env.PLAYWRIGHT_BROWSERS_PATH = nodePath.join(process.cwd(), '.playwright-browsers');
        const { chromium } = await import('playwright');
        const browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
                // El servidor del lab (dyndns casero) negocia mal HTTP/2 desde el
                // contenedor: tira ERR_HTTP2_PROTOCOL_ERROR corrida tras corrida,
                // mientras que desde Argentina responde bien. Forzar HTTP/1.1
                // evita el problema sin tocar nada más.
                '--disable-http2',
            ],
        });

        const summary: Record<string, any> = { pages: 0, seen: 0, anulados: 0, preCrm: 0, registered: 0, unmatched: 0, overcost: 0, withCost: 0 };
        try {
            const page = await browser.newContext().then(c => c.newPage());
            // Sin timeout, un stall del portal deja este Chromium colgado para
            // siempre — y el pase corre cada 10 min: browsers acumulados hasta
            // tumbar el contenedor. Todo lo que espere, espera con tope.
            // Portal muy lento durante la migración (8/9/26): 5 min por paso.
        page.setDefaultTimeout(300000);
            page.setDefaultNavigationTimeout(60000);

            // El portal (dyndns casero) tira errores transitorios de red
            // (ERR_HTTP2_PROTOCOL_ERROR y similares): un reintento con pausa
            // resuelve la mayoría sin esperar a la próxima corrida.
            let lastErr: any = null;
            const INTENTOS = 3;
            for (let intento = 1; intento <= INTENTOS; intento++) {
                try {
                    await this.login(page);
                    // La app debe estar cargada para que fetch() comparta la sesión.
                    await page.goto(`${PORTAL_BASE}/smartlab/laboratory/list`, { waitUntil: 'domcontentloaded' });
                    lastErr = null;
                    if (intento > 1) console.log(`[GrupoOptico] Portal OK en el intento ${intento}.`);
                    break;
                } catch (err) {
                    lastErr = err;
                    console.warn(`[GrupoOptico] Login/carga del portal falló (intento ${intento}/${INTENTOS}):`, err);
                    if (intento < INTENTOS) await new Promise(r => setTimeout(r, 20000));
                }
            }
            if (lastErr) throw lastErr;
            await page.waitForTimeout(3000);

            // Corte: inicio de la era CRM, o la ventana corta del pase rápido
            // (nunca antes del inicio de auditoría).
            const eraStart = new Date(LAB_AUDIT_START_ISO);
            const auditStart = opts.sinceDays
                ? new Date(Math.max(eraStart.getTime(), Date.now() - opts.sinceDays * 86400000))
                : eraStart;
            const clientId = process.env.SMARTLAB_CLIENT_ID || '2462';
            const orders: PortalOrder[] = [];

            for (let current = 1; current <= MAX_PAGES; current++) {
                const url = `${API_BASE}/laboratory/order/list?rowPerPage=${ROWS_PER_PAGE}&current=${current}` +
                    `&isClient=1&isSeller=0&userId=${clientId}&sellerId=0` +
                    `&search=&invoiceNumber=&sector=0&client=null&invoice=0&lensType=0&calibratedBy=0&zone=0`;
                const res: any = await page.evaluate(async (u) => {
                    // AbortSignal.timeout: un fetch que el portal nunca responde
                    // colgaría el evaluate (y el browser) indefinidamente.
                    const r = await fetch(u, { credentials: 'include', signal: AbortSignal.timeout(180000) });
                    if (!r.ok) return { error: r.status };
                    return await r.json();
                }, url);

                if (res?.error) throw new Error(`API SmartLab respondió ${res.error} en la página ${current}`);
                const rows: any[] = res?.rows || [];
                if (rows.length === 0) break;
                summary.pages = current;

                let vigentesEnPagina = 0;
                for (const r of rows) {
                    const fecha = new Date((r.FechaRegistro || '').replace(' ', 'T'));
                    if (isNaN(fecha.getTime())) continue;
                    if (fecha < auditStart) { summary.preCrm++; continue; }
                    vigentesEnPagina++;
                    const invoiceNumbers = (r.invoices || [])
                        .map((i: any) => i?.number)
                        .filter((n: any): n is string => typeof n === 'string' && n.length > 0);
                    orders.push({
                        num: String(r.IdPedido || ''),
                        fecha: r.FechaRegistro,
                        cliente: (r.CodigoOptica || '').trim(),
                        anulado: r.Anulado === '1',
                        factura: r.invoices?.[0]?.number || r.Factura || null,
                        invoiceNumbers,
                        comprobantes: (r.invoices || [])
                            .filter((i: any) => i && i.number)
                            .map((i: any) => ({
                                salesId: String(i.salesId ?? ''), letter: String(i.letter ?? ''),
                                number: String(i.number), type: String(i.type ?? ''),
                            })),
                        rework: !!r.is_rework || r.Reclamo === '1',
                    });
                }
                // La API viene ordenada de más nuevo a más viejo, pero un reproceso
                // puede aparecer con su FechaRegistro ORIGINAL en medio de una
                // página: cortar en la primera fila vieja saltearía páginas enteras
                // de pedidos vigentes. Se corta recién cuando la página completa
                // quedó fuera de la ventana.
                if (vigentesEnPagina === 0) break;
                await page.waitForTimeout(400);
            }

            summary.seen = orders.length;

            // Importes reales POR PEDIDO: SOLO las líneas de detalle que llevan
            // su número, en todos los comprobantes (facturas + remitos X). Las
            // líneas sin nº no se le asignan a nadie. Si falla, seguimos sin importes.
            let pedidoAmounts = new Map<string, number>();
            let porComprobante = new Map<string, Map<string, number>>();
            // ¿Se puede borrar el importe de un pedido sin líneas? Solo con el
            // PDF entero (ver evaluarConteo).
            let pdfCompleto = false;
            try {
                const res = await buildPedidoAmountMap(page, clientId, auditStart, new Date());
                pedidoAmounts = res.amounts;
                porComprobante = res.porComprobante;
                console.log(`[GrupoOptico] Comprobantes parseados: ${res.stats.invoices} | ` +
                    `líneas con pedido $${Math.round(res.stats.attributedSum).toLocaleString('es-AR')} | ` +
                    `sin nº de pedido $${Math.round(res.stats.unattributedSum).toLocaleString('es-AR')} (no se asignan) | ` +
                    `con descuento de cuenta: ${res.stats.conDescuento}/${res.stats.invoices}` +
                    `${res.stats.descuentoPromedio !== null ? ` (promedio ${Math.round((1 - res.stats.descuentoPromedio) * 100)}% off)` : ''}`);
                summary.comprobantes = res.stats.invoices;
                summary.comprobantesConDescuento = res.stats.conDescuento;
                summary.descuentoPromedio = res.stats.descuentoPromedio;

                // PDF a medias (ver evaluarConteo): no se tocan importes.
                if (!opts.sinceDays) {
                    const leer = async (key: string) => Number((await prisma.systemSetting.findUnique({ where: { key } }).catch(() => null))?.value || 0);
                    const guardar = (key: string, value: number) => prisma.systemSetting.upsert({
                        where: { key }, update: { value: String(value) }, create: { key, value: String(value) },
                    }).catch(err => console.error(`[GrupoOptico] No se pudo guardar ${key}:`, err));
                    const previo = await leer(CONTEO_KEY);
                    const decision = evaluarConteo(res.stats.invoices, previo, await leer(CONTEO_DUDOSO_KEY));
                    if (decision.nuevoDudoso !== null) await guardar(CONTEO_DUDOSO_KEY, decision.nuevoDudoso);
                    if (decision.nuevaBase !== null) await guardar(CONTEO_KEY, decision.nuevaBase);
                    if (!decision.usarImportes) {
                        summary.invoiceError = res.stats.invoices === 0
                            ? 'No llegó el PDF de comprobantes (o vino vacío). No se tocaron importes.'
                            : `PDF de comprobantes incompleto: ${res.stats.invoices} comprobantes contra ${previo} de la última pasada completa. No se tocaron importes.`;
                        console.error(`[GrupoOptico] ${summary.invoiceError}`);
                        pedidoAmounts = new Map();
                        porComprobante = new Map();
                    } else if (previo > 0 && res.stats.invoices < previo * CONTEO_MINIMO) {
                        console.warn(`[GrupoOptico] Dos pasadas seguidas leyeron ${res.stats.invoices} comprobantes (antes ${previo}): el portal cambió; se toma como nueva base.`);
                    }
                    pdfCompleto = decision.completo;
                }
            } catch (err: any) {
                console.error('[GrupoOptico] No se pudo obtener el PDF de facturas (se sigue sin importes):', err);
                // Dejar constancia en el resumen: si esto falla corrida tras corrida,
                // los pedidos se registran pero NUNCA llegan importes y el watchdog
                // vería todo verde — el cron diario lo reporta como fuente degradada.
                summary.invoiceError = err?.message || 'Error obteniendo comprobantes';
            }

            for (const o of orders) {
                if (!o.num.match(/\d{4,}/)) continue;
                if (o.anulado) { summary.anulados++; continue; }

                // Costo real = suma de las líneas de detalle del pedido (par completo).
                // OJO: 0 es un importe VÁLIDO (el par gratis del 2x1 se factura $0);
                // tratarlo como "sin factura" dejaba esas ventas PENDING para siempre.
                const raw = pedidoAmounts.get(o.num);
                const billed: number | null = raw != null ? Math.round(raw * 100) / 100 : null;
                // Pasada COMPLETA y sana (PDF leído entero): si el pedido no
                // tiene líneas con su número, no tiene importe — y se borra el
                // que esta misma fuente le hubiera puesto antes (el viejo
                // reparto de líneas sin nº). Nunca en el pase rápido (ve solo
                // 21 días) ni con el PDF a medias.
                const importeAutoritativo = !opts.sinceDays && !summary.invoiceError && pedidoAmounts.size > 0 && pdfCompleto;

                // Los comprobantes del pedido con lo que cada uno le cobra y el
                // link para verlo en el portal (pedido de Ishtar, 25/9/2026).
                // Si esta corrida no tiene importes, van sin importe y se
                // conservan los que ya estaban guardados (juntarComprobantes).
                const delPedido = porComprobante.get(o.num);
                const invoiceRefs: InvoiceRef[] = o.comprobantes.map(c => {
                    const nro = nroComprobante(c.number);
                    return {
                        comprobante: `${c.letter ? `${c.letter}-` : ''}${nro}`,
                        importe: delPedido?.get(nro) ?? null,
                        url: c.salesId ? linkComprobante(c.salesId, o.num, c.type) : null,
                        tipo: c.type === 'r' ? 'remito' : 'factura',
                    };
                });
                // Un comprobante con líneas del pedido que la API no listó: sin link.
                for (const [nro, importe] of delPedido || []) {
                    if (!invoiceRefs.some(r => r.comprobante.endsWith(nro))) invoiceRefs.push({ comprobante: nro, importe, url: null });
                }

                const detail = [o.cliente, `ingreso ${o.fecha.slice(0, 16)}`, o.rework ? 'REPROCESO' : null]
                    .filter(Boolean).join(', ');
                const entry = await LabCostReconciliationService.upsertEntry({
                    lab: 'GRUPO_OPTICO',
                    labOrderNumber: o.num,
                    // Consumidor final: el total del PDF es el monto final (IVA no discriminado).
                    billedNet: billed,
                    billedTotal: billed,
                    source: 'SCRAPER',
                    sourceFile: o.factura ? `Fact ${o.factura}` : null,
                    // El portal manda la fecha de cada pedido (FechaRegistro) y
                    // hasta acá se escribía SOLO dentro de la nota: la columna
                    // quedaba vacía en las 284 filas de Grupo Óptico, y cualquier
                    // informe con corte por fecha lo dejaba afuera entero. Se
                    // guarda. Para este lab es la fecha de ingreso del pedido al
                    // laboratorio (el portal no expone la de emisión de la
                    // factura); para Optovisión sigue siendo la del comprobante.
                    invoiceDate: new Date(String(o.fecha).replace(' ', 'T')),
                    notes: `Pedido visto en el portal del laboratorio (${detail}).`,
                    invoiceRefs: invoiceRefs.length ? invoiceRefs : undefined,
                    sinImporteDeEstaFuente: importeAutoritativo && billed === null,
                    // Pase rápido (ventana corta): solo COMPLETA importes faltantes;
                    // los ya registrados por la pasada completa no se pisan (el
                    // reparto de líneas con menos comprobantes daría otro número).
                    preferExistingBilling: !!opts.sinceDays,
                });
                if (entry) {
                    summary.registered++;
                    if (billed) summary.withCost++;
                    if (entry.status === 'UNMATCHED') summary.unmatched++;
                    if (entry.status === 'OVERCOST') summary.overcost++;
                }
            }
            return summary;
        } finally {
            await browser.close();
        }
    }

    private static async login(page: any) {
        const user = process.env.SMARTLAB_USER || 'pisano.ishtar@gmail.com';
        const pass = process.env.SMARTLAB_PASSWORD || 'atelier';

        await page.goto(`${PORTAL_BASE}/smartlab/auth/authSmartlab/login`, { waitUntil: 'domcontentloaded', timeout: 300000 });
        // El portal es un dyndns casero y la app tarda en hidratar; desde el
        // contenedor (Singapur) los 15s originales se agotaban seguido y la
        // corrida entera se perdía. 45s da margen sin colgar el pase.
        await page.waitForSelector('input', { timeout: 300000 });
        const inputs = await page.$$('input');
        if (inputs.length < 2) throw new Error('No se encontraron los campos de login de SmartLab.');
        await page.waitForTimeout(1500);
        await inputs[0].fill(user);
        await inputs[1].fill(pass);
        await page.waitForTimeout(800);

        let clicked = false;
        for (const btn of await page.$$('button')) {
            const t = ((await btn.innerText()) || '').toLowerCase();
            if (t.includes('iniciar') || t.includes('ingresar') || t.includes('login')) {
                await btn.click({ delay: 200 });
                clicked = true;
                break;
            }
        }
        if (!clicked) {
            await inputs[1].press('Enter', { delay: 150 }).catch(() => {});
        }

        // ACÁ ESTABA EL BUG (8/9/26). Después del clic esperaba 2,5 SEGUNDOS y
        // si la URL seguía en /auth/ daba el login por fallado. Con el portal
        // lento —están migrando de servidor— eso es siempre: el error
        // "Login de SmartLab falló (sigue en la pantalla de auth)" no era un
        // login rechazado, era una espera de dos segundos y medio. Por eso no
        // entró un solo costo de Grupo Óptico desde el 21/8.
        //
        // Ahora se espera POR EL RESULTADO: se mira la URL cada 5 s hasta cinco
        // minutos. El login se resuelve por JavaScript ("Iniciando sesión…"),
        // así que tampoco sirve atarse a `waitForNavigation`.
        // UNA CREDENCIAL RECHAZADA NO ES LENTITUD (8/9/26). Esperar por la URL
        // era necesario pero no suficiente: cuando el portal contesta "Usuario o
        // contraseña incorrectos" la URL se queda en /auth/ para siempre, así que
        // el ciclo agotaba los 5 minutos y avisaba "el portal está muy lento".
        // Con esa cara, el corte duró 15 días —del 24/8 al 8/9— buscando un
        // problema de red que no existía: medido, el portal contesta en 2,4 s.
        // Ahora se mira TAMBIÉN el cartel de error y se corta al instante,
        // diciendo lo que de verdad pasa y qué hay que tocar.
        const ESPERA_LOGIN_MS = 300_000;
        const limite = Date.now() + ESPERA_LOGIN_MS;
        while (Date.now() < limite) {
            if (!page.url().includes('/auth/')) return;
            const enPantalla = (await page.innerText('body').catch(() => '') || '').toLowerCase();
            if (/incorrect|no se pudo iniciar sesi|credenciales inv/i.test(enPantalla)) {
                const configurada = !!process.env.SMARTLAB_USER && !!process.env.SMARTLAB_PASSWORD;
                throw new Error(
                    'CREDENCIAL RECHAZADA por el portal de Grupo Óptico: dice "usuario o contraseña incorrectos". '
                    + (configurada
                        ? 'SMARTLAB_USER/SMARTLAB_PASSWORD están configuradas pero el portal no las acepta: hay que pedirle la clave nueva a Grupo Óptico y actualizarlas.'
                        : 'SMARTLAB_USER/SMARTLAB_PASSWORD NO están configuradas, así que se usó la clave escrita en el código, que ya no sirve: cargarlas en las variables de entorno.')
                );
            }
            await page.waitForTimeout(5000);
        }
        throw new Error(`Login de SmartLab no salió de /auth/ en ${ESPERA_LOGIN_MS / 60000} min (el portal está muy lento).`);
    }
}
