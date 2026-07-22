import { LabCostReconciliationService } from '../lab-cost-reconciliation.service';
import { LAB_AUDIT_START_ISO } from '../../lib/constants';
import { buildPedidoAmountMap } from './grupo-optico-invoices';

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

interface PortalOrder {
    num: string;
    fecha: string; // "YYYY-MM-DD HH:mm:ss.000"
    cliente: string;
    anulado: boolean;
    factura: string | null;
    invoiceNumbers: string[]; // todos los nº de factura del pedido (para cruzar importes)
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
    static async collect(opts: { sinceDays?: number } = {}) {
        const { chromium } = await import('playwright');
        const browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        });

        const summary: Record<string, any> = { pages: 0, seen: 0, anulados: 0, preCrm: 0, registered: 0, unmatched: 0, overcost: 0, withCost: 0 };
        try {
            const page = await browser.newContext().then(c => c.newPage());
            // Sin timeout, un stall del portal deja este Chromium colgado para
            // siempre — y el pase corre cada 10 min: browsers acumulados hasta
            // tumbar el contenedor. Todo lo que espere, espera con tope.
            page.setDefaultTimeout(60000);
            page.setDefaultNavigationTimeout(60000);

            // El portal (dyndns casero) tira errores transitorios de red
            // (ERR_HTTP2_PROTOCOL_ERROR y similares): un reintento con pausa
            // resuelve la mayoría sin esperar a la próxima corrida.
            let lastErr: any = null;
            for (let intento = 1; intento <= 2; intento++) {
                try {
                    await this.login(page);
                    // La app debe estar cargada para que fetch() comparta la sesión.
                    await page.goto(`${PORTAL_BASE}/smartlab/laboratory/list`, { waitUntil: 'domcontentloaded' });
                    lastErr = null;
                    break;
                } catch (err) {
                    lastErr = err;
                    console.warn(`[GrupoOptico] Login/carga del portal falló (intento ${intento}/2):`, err);
                    if (intento < 2) await new Promise(r => setTimeout(r, 15000));
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
                    const r = await fetch(u, { credentials: 'include', signal: AbortSignal.timeout(45000) });
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

            // Importes reales POR PEDIDO: líneas de detalle del PDF de comprobantes
            // (facturas + remitos X), con reparto de líneas sin nº por el vínculo
            // pedido→factura de la API. Si falla, seguimos sin importes.
            let pedidoAmounts = new Map<string, number>();
            try {
                const pedidoInvoices = new Map<string, string[]>();
                for (const o of orders) if (o.invoiceNumbers.length) pedidoInvoices.set(o.num, o.invoiceNumbers);
                const res = await buildPedidoAmountMap(page, clientId, auditStart, new Date(), pedidoInvoices);
                pedidoAmounts = res.amounts;
                console.log(`[GrupoOptico] Comprobantes parseados: ${res.stats.invoices} | ` +
                    `líneas con pedido $${Math.round(res.stats.attributedSum).toLocaleString('es-AR')} | ` +
                    `sin pedido $${Math.round(res.stats.unattributedSum).toLocaleString('es-AR')} ` +
                    `(repartido $${Math.round(res.stats.distributedSum).toLocaleString('es-AR')}) | ` +
                    `con descuento de cuenta: ${res.stats.conDescuento}/${res.stats.invoices}` +
                    `${res.stats.descuentoPromedio !== null ? ` (promedio ${Math.round((1 - res.stats.descuentoPromedio) * 100)}% off)` : ''}`);
                summary.comprobantesConDescuento = res.stats.conDescuento;
                summary.descuentoPromedio = res.stats.descuentoPromedio;
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
                    notes: `Pedido visto en el portal del laboratorio (${detail}).`,
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

        await page.goto(`${PORTAL_BASE}/smartlab/auth/authSmartlab/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForSelector('input', { timeout: 15000 });
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
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
                    btn.click({ delay: 200 }),
                ]);
                clicked = true;
                break;
            }
        }
        if (!clicked) {
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
                inputs[1].press('Enter', { delay: 150 }),
            ]);
        }
        await page.waitForTimeout(2500);
        if (page.url().includes('/auth/')) throw new Error('Login de SmartLab falló (sigue en la pantalla de auth).');
    }
}
