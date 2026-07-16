import { LabCostReconciliationService } from '../lab-cost-reconciliation.service';
import { LAB_AUDIT_START_ISO } from '../../lib/constants';
import { buildInvoiceAmountMap } from './grupo-optico-invoices';

/**
 * Proveedor de Grupo Óptico: lee los pedidos desde la API JSON interna del
 * portal SmartLab (la misma que usa su propia página web), paginada y estable —
 * sin scraping de pantallas. Registra TODOS los pedidos de la era CRM en la
 * conciliación con su COSTO REAL: cruza cada pedido con el PDF de facturas del
 * rango (buildInvoiceAmountMap) por nº de factura. Los que tienen venta quedan
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
}

export class GrupoOpticoProvider {
    static readonly providerName = 'GRUPO_OPTICO';

    /**
     * Corre la recolección diaria. Pagina la API desde el pedido más nuevo hacia
     * atrás y corta al llegar al inicio de la auditoría (LAB_AUDIT_START_ISO),
     * así cada corrida refresca la era CRM completa (hoy ~3 páginas).
     */
    static async collect() {
        const { chromium } = await import('playwright');
        const browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        });

        const summary = { pages: 0, seen: 0, anulados: 0, preCrm: 0, registered: 0, unmatched: 0, overcost: 0, withCost: 0 };
        try {
            const page = await browser.newContext().then(c => c.newPage());
            await this.login(page);

            // La app debe estar cargada para que fetch() comparta la sesión.
            await page.goto(`${PORTAL_BASE}/smartlab/laboratory/list`, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(3000);

            const auditStart = new Date(LAB_AUDIT_START_ISO);
            const clientId = process.env.SMARTLAB_CLIENT_ID || '2462';
            const orders: PortalOrder[] = [];

            for (let current = 1; current <= MAX_PAGES; current++) {
                const url = `${API_BASE}/laboratory/order/list?rowPerPage=${ROWS_PER_PAGE}&current=${current}` +
                    `&isClient=1&isSeller=0&userId=${clientId}&sellerId=0` +
                    `&search=&invoiceNumber=&sector=0&client=null&invoice=0&lensType=0&calibratedBy=0&zone=0`;
                const res: any = await page.evaluate(async (u) => {
                    const r = await fetch(u, { credentials: 'include' });
                    if (!r.ok) return { error: r.status };
                    return await r.json();
                }, url);

                if (res?.error) throw new Error(`API SmartLab respondió ${res.error} en la página ${current}`);
                const rows: any[] = res?.rows || [];
                if (rows.length === 0) break;
                summary.pages = current;

                let reachedPreCrm = false;
                for (const r of rows) {
                    const fecha = new Date((r.FechaRegistro || '').replace(' ', 'T'));
                    if (isNaN(fecha.getTime())) continue;
                    if (fecha < auditStart) { reachedPreCrm = true; summary.preCrm++; continue; }
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
                    });
                }
                if (reachedPreCrm) break; // la API viene ordenada de más nuevo a más viejo
                await page.waitForTimeout(400);
            }

            summary.seen = orders.length;

            // Importes reales: el PDF de facturas del rango (nº de factura → monto).
            // Si la descarga/parseo falla, seguimos sin importes (no rompe el cruce).
            let invoiceAmounts = new Map<string, number>();
            try {
                invoiceAmounts = await buildInvoiceAmountMap(page, clientId, auditStart, new Date());
                console.log(`[GrupoOptico] ${invoiceAmounts.size} facturas con importe descargadas del portal`);
            } catch (err) {
                console.error('[GrupoOptico] No se pudo obtener el PDF de facturas (se sigue sin importes):', err);
            }

            for (const o of orders) {
                if (!o.num.match(/\d{4,}/)) continue;
                if (o.anulado) { summary.anulados++; continue; }

                // Costo real = suma de los importes de las facturas del pedido.
                let billed: number | null = null;
                for (const inv of o.invoiceNumbers) {
                    const amount = invoiceAmounts.get(inv);
                    if (amount) billed = (billed || 0) + amount;
                }

                const detail = [o.cliente, `ingreso ${o.fecha.slice(0, 16)}`].filter(Boolean).join(', ');
                const entry = await LabCostReconciliationService.upsertEntry({
                    lab: 'GRUPO_OPTICO',
                    labOrderNumber: o.num,
                    // Consumidor final: el total del PDF es el monto final (IVA no discriminado).
                    billedNet: billed,
                    billedTotal: billed,
                    source: 'SCRAPER',
                    sourceFile: o.factura ? `Fact ${o.factura}` : null,
                    notes: `Pedido visto en el portal del laboratorio (${detail}).`,
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
