import { LabCostReconciliationService } from '../lab-cost-reconciliation.service';
import { LAB_AUDIT_START_ISO } from '../../lib/constants';
import { prisma } from '../../lib/db';
import { buildPedidoAmountMap, normalizeInvoiceNumber } from './grupo-optico-invoices';
import type { InvoiceRef } from '../lab-recon/types';
import { conTurno, type Pasada } from '../lab-modules/portal/turno';
import { conSesionSmartLab, clientIdSmartLab, LAB_GRUPO_OPTICO, pedirJsonDesdeLaPagina, urlListadoApi } from '../lab-modules/grupo-optico/portal';
import { linkComprobante } from '../lab-modules/grupo-optico/pedidos';

/**
 * Proveedor de Grupo Óptico: lee los pedidos desde la API JSON interna del
 * portal SmartLab (la misma que usa su propia página web), paginada y estable —
 * sin scraping de pantallas. Registra TODOS los pedidos de la era CRM en la
 * conciliación con su COSTO REAL POR LÍNEA de factura: cada pedido suma sus
 * líneas de detalle en todos los comprobantes (facturas + remitos X de stock);
 * ver reglas en grupo-optico-invoices.ts. Los que tienen venta quedan
 * OK/OVERCOST/PENDING, los que no, UNMATCHED ("Sin venta") — con su importe.
 *
 * Credenciales: SMARTLAB_USER / SMARTLAB_PASSWORD, SOLO del entorno (sin ellas
 * no se abre el navegador). El login, el navegador y el turno del portal son
 * los del módulo de seguimiento (lab-modules/grupo-optico/portal.ts): un solo
 * lugar para entrar al portal y una sola pasada a la vez contra él, compartida
 * con el seguimiento. El sello `lab-provider:GRUPO_OPTICO:lastOkAt` sigue
 * siendo el de los COSTOS (lo escribe runAllProviders).
 */

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
 * Desde el 3/10/2026 el turno es el del marco (`lab-modules/portal/turno.ts`,
 * clave `lab-modulo:GRUPO_OPTICO:turno`), el MISMO que usa el seguimiento:
 * antes cada uno tenía el suyo y los dos podían abrir un Chromium contra el
 * portal a la vez. Quién espera y quién se saltea lo decide `debeEsperar`: la
 * DIARIA espera si el turno lo tiene un pase RÁPIDO (si se salteara, ese día
 * no habría pasada completa); a otra completa no la espera.
 */
const ESPERA_TURNO_MIN = 8;

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
        // La base SOLO SUBE, salvo que dos pasadas seguidas confirmen un conteo
        // bajo. Si un PDF al 95% la bajara, la pasada siguiente —todavía
        // incompleta— ya contaría como entera y borraría importes (tercera
        // auditoría, 25/9/2026). El portal suma comprobantes todos los días,
        // así que una baja chica real (un comprobante anulado) se alcanza sola.
        nuevaBase: n > 0 ? (confirmaElDudoso ? n : Math.max(n, previo)) : null,
        nuevoDudoso: 0,
    };
}

// El link al PDF de cada comprobante (`linkComprobante`) vive en
// lab-modules/grupo-optico/pedidos.ts: el seguimiento lo escribe en el espejo
// y acá va en `invoiceRefs`. Un solo lugar para la URL del portal.

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
        const pasada: Pasada = opts.sinceDays ? 'rapida' : 'completa';
        const r = await conTurno(LAB_GRUPO_OPTICO, pasada, () => GrupoOpticoProvider.recolectar(opts), {
            esperar: opts.esperarTurno, esperaMaxMs: ESPERA_TURNO_MIN * 60000,
        });
        if ('skipped' in r && r.skipped) {
            console.log(`[GrupoOptico] Otra pasada contra el portal está en curso: esta (${pasada === 'rapida' ? 'rápida' : 'completa'}) se saltea.`);
            return { skipped: true, reason: r.reason };
        }
        return r as Record<string, any>;
    }

    private static async recolectar(opts: { sinceDays?: number }): Promise<Record<string, any>> {
        const summary: Record<string, any> = { pages: 0, seen: 0, anulados: 0, preCrm: 0, registered: 0, unmatched: 0, overcost: 0, withCost: 0 };
        // conSesionSmartLab abre Chromium (con la ruta de `.playwright-browsers`
        // y sin HTTP/2), entra con reintentos y deja la página del listado
        // cargada, que es lo que hace falta para que fetch() comparta la sesión.
        return conSesionSmartLab(async (page) => {
            await page.waitForTimeout(3000);

            // Corte: inicio de la era CRM, o la ventana corta del pase rápido
            // (nunca antes del inicio de auditoría).
            const eraStart = new Date(LAB_AUDIT_START_ISO);
            const auditStart = opts.sinceDays
                ? new Date(Math.max(eraStart.getTime(), Date.now() - opts.sinceDays * 86400000))
                : eraStart;
            const clientId = clientIdSmartLab();
            const orders: PortalOrder[] = [];

            for (let current = 1; current <= MAX_PAGES; current++) {
                const res = await pedirJsonDesdeLaPagina<{ rows?: any[] }>(page, urlListadoApi(current, clientId));
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
        });
    }
}
