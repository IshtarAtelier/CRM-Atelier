import PDFParser from 'pdf2json';

/**
 * Descarga y parseo de las facturas de Grupo Óptico — POR LÍNEA de detalle.
 *
 * Cómo factura el lab (verificado sobre el PDF real del rango 8/4→15/7/2026):
 *
 *  - Cada página es un comprobante con columnas: Cant | Descripción | Cod.Opt |
 *    Pedido | Unitario | Dto | Unit.C/Dto | Importe. Los cristales van en DOS
 *    líneas de 0.50 (una por ojo) con el Unitario POR PAR → la suma de líneas
 *    de un pedido es el costo del par completo.
 *  - Hay DOS series de comprobantes y AMBAS son plata real del pedido:
 *      · FACTURAS (nº alto, ej. 0004-00339862, Total > 0): trabajos de
 *        laboratorio y armados/calibrados (~$2.670 por pedido de stock).
 *      · REMITOS X (nº bajo, ej. 00004-00021275, Total $0, "30 Días Lista"):
 *        cristales de STOCK entregados a cuenta corriente — el importe real
 *        está en las líneas aunque el total del comprobante diga 0.
 *    Un pedido de stock suma de las dos series (armado en factura + cristal en
 *    remito): NO es doble conteo, son conceptos distintos.
 *  - Algunas facturas traen líneas SIN nº de pedido (columna vacía). Esas se
 *    asignan por el vínculo pedido→factura que da la API del portal
 *    (invoices[].number de cada pedido): se reparten entre los pedidos de esa
 *    factura que no tengan líneas propias, o a prorrata si todos tienen.
 *
 * Endpoint de descarga (el mismo que usa la web del portal):
 *   GET /smartlab-api-v2/public/index.php/laboratory/order/invoice?cl={cliente}&t=2&c=1&s={DD-MM-YYYY}&e={DD-MM-YYYY}
 */

export interface ParsedInvoice {
    invoiceNumber: string;                  // "0004-00339862" (normalizado sin ceros extra del pto. de venta)
    total: number | null;                   // Total del comprobante (0 en remitos X)
    faImporte: number | null;               // "<FA> Importe:" = lo que REALMENTE se cobra (con descuento)
    descuento: number | null;               // factor aplicado (0.80 = 20% de descuento)
    attributed: Map<string, number>;        // nº de pedido → suma de sus líneas YA con descuento
    unattributed: number;                   // suma de líneas sin nº de pedido (ya con descuento)
}

const API_BASE = 'https://grupooptico.dyndns.info/smartlab-api-v2/public/index.php';

/**
 * Descuento de cuenta vigente con Grupo Óptico (0.80 = 20% off), confirmado por
 * el administrador el 22/7/2026. SOLO se usa como respaldo para los remitos X,
 * que llegan sin el recuadro "<FA> Importe" (todavía no facturados) pero al
 * facturarse llevan el mismo descuento. Cuando el comprobante SÍ trae su
 * importe final, manda ese — el factor se calcula del propio PDF y este valor
 * no interviene. Si el acuerdo comercial cambia, actualizar acá.
 */
const DESCUENTO_CUENTA_DEFAULT = 0.80;

/** Normaliza "00004-00339862" → "0004-00339862" (la API usa 4 dígitos de pto. de venta). */
export function normalizeInvoiceNumber(n: string): string {
    const [pv, num] = n.split('-');
    return `${pv.slice(-4).padStart(4, '0')}-${num}`;
}

function toDdMmYyyy(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
}

const money = (s: string): number | null => {
    const m = String(s).match(/^\d{1,3}(\.\d{3})*,\d{2}$/);
    return m ? parseFloat(s.replace(/\./g, '').replace(',', '.')) : null;
};

/** Descarga el PDF de comprobantes del rango usando la sesión Playwright autenticada. */
export async function downloadInvoicePdf(page: any, clientId: string, from: Date, to: Date): Promise<Buffer | null> {
    const url = `${API_BASE}/laboratory/order/invoice?cl=${clientId}&t=2&c=1&s=${toDdMmYyyy(from)}&e=${toDdMmYyyy(to)}`;
    const result: { status: number; b64: string; size: number } = await page.evaluate(async (u: string) => {
        // Tope duro: el PDF puede pesar; sin señal, un stall del portal cuelga el
        // evaluate (y el Chromium) para siempre. 5 minutos: el PDF de la era CRM
        // completa (meses de comprobantes) tarda más de 90s en generarse.
        const r = await fetch(u, { credentials: 'include', signal: AbortSignal.timeout(300000) });
        if (!r.ok) return { status: r.status, b64: '', size: 0 };
        const buf = await r.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let bin = '';
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
            bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
        }
        return { status: r.status, b64: btoa(bin), size: buf.byteLength };
    }, url);

    if (result.status !== 200 || result.size < 1000) return null;
    return Buffer.from(result.b64, 'base64');
}

/** Parsea el PDF a comprobantes con sus líneas de detalle (estructurado, por coordenadas). */
export function parseInvoicePdf(pdfBuffer: Buffer): Promise<ParsedInvoice[]> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Parseo de PDF de facturas excedió 120s')), 120000);
        const parser = new PDFParser(null as any, true);
        const dec = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

        parser.on('pdfParser_dataError', (err: any) => { clearTimeout(timeout); reject(err.parserError); });
        parser.on('pdfParser_dataReady', (data: any) => {
            clearTimeout(timeout);
            try {
                const out: ParsedInvoice[] = [];
                for (const pg of data.Pages || []) {
                    const texts = (pg.Texts || []).map((t: any) => ({
                        x: t.x, y: t.y, s: dec(t.R.map((r: any) => r.T).join('')).trim(),
                    })).filter((t: any) => t.s);

                    // Filas por proximidad vertical
                    const rows: Record<string, { x: number; s: string }[]> = {};
                    for (const t of texts) {
                        const k = String(Math.round(t.y * 2) / 2);
                        (rows[k] = rows[k] || []).push(t);
                    }

                    // Encabezado de columnas: fila que contiene "Pedido" e "Importe"
                    let xPedido = 22.4, xImporte = 33.8, yHeader = 9.5;
                    for (const [y, cells] of Object.entries(rows)) {
                        const ped = cells.find(c => c.s === 'Pedido');
                        const imp = cells.find(c => c.s === 'Importe');
                        if (ped && imp) { xPedido = ped.x; xImporte = imp.x; yHeader = Number(y); break; }
                    }

                    const inv: ParsedInvoice = { invoiceNumber: '', total: null, faImporte: null, descuento: null, attributed: new Map(), unattributed: 0 };
                    for (const [yKey, cellsRaw] of Object.entries(rows)) {
                        const y = Number(yKey);
                        const cells = cellsRaw.sort((a, b) => a.x - b.x);
                        const joined = cells.map(c => c.s).join(' ');

                        if (!inv.invoiceNumber && y < yHeader) {
                            const m = joined.match(/(\d{4,5}-\d{8})/);
                            if (m) inv.invoiceNumber = normalizeInvoiceNumber(m[1]);
                        }
                        const tm = joined.match(/Total\s*\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/);
                        if (tm) inv.total = money(tm[1]);
                        // Recuadro "<FA> Importe: $ 14.657,60": lo que el lab COBRA de
                        // verdad por este comprobante — el Sub Total de las líneas viene
                        // SIN el descuento de cuenta (habitualmente 20%).
                        const fm = joined.match(/Importe:\s*\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/);
                        if (fm) inv.faImporte = money(fm[1]);

                        // Zona de detalle: entre el encabezado y el pie (Sub Total ~y=41)
                        if (y <= yHeader + 0.3 || y >= 40) continue;
                        // Importe: celda money en la columna Importe (la más a la derecha)
                        let importe: number | null = null;
                        for (let i = cells.length - 1; i >= 0; i--) {
                            const v = money(cells[i].s);
                            if (v !== null && cells[i].x >= xImporte - 1.5) { importe = v; break; }
                        }
                        if (importe === null) continue;
                        // Pedido: celda 80xxxxxx cerca de la columna Pedido
                        const ped = cells.find(c => /^80\d{6}$/.test(c.s) && Math.abs(c.x - xPedido) < 3);
                        if (ped) inv.attributed.set(ped.s, (inv.attributed.get(ped.s) || 0) + importe);
                        else inv.unattributed += importe;
                    }

                    // DESCUENTO DE CUENTA (dato del administrador, 22/7): el lab agrupa
                    // varios pedidos en el comprobante y sobre ese Sub Total aplica un
                    // descuento (en general 20%). El costo REAL es el "Importe" del
                    // recuadro <FA>, no la suma de las líneas. Se prorratea ese descuento
                    // sobre cada pedido — así el factor sale del propio comprobante y no
                    // hay que hardcodear el 20% (puede variar por acuerdo comercial).
                    const sumaLineas = [...inv.attributed.values()].reduce((a, b) => a + b, 0) + inv.unattributed;
                    let f: number | null = null;
                    if (inv.faImporte !== null && inv.faImporte > 0 && sumaLineas > 0) {
                        const cand = inv.faImporte / sumaLineas;
                        // Guarda: solo descuentos plausibles (hasta 70% off). Si el <FA>
                        // agrupa varios comprobantes el factor daría >1 → se ignora.
                        if (cand >= 0.3 && cand <= 1.001) f = cand;
                    } else if (sumaLineas > 0) {
                        // REMITOS X (mercadería de stock a cuenta corriente): llegan con
                        // "<FA> Importe: $0" porque todavía no están facturados, pero al
                        // facturarse llevan el mismo descuento de cuenta (confirmado por
                        // el administrador el 22/7). Sin el <FA> no hay factor propio →
                        // se usa el vigente de la cuenta.
                        f = DESCUENTO_CUENTA_DEFAULT;
                    }
                    if (f !== null) {
                        inv.descuento = Math.round(f * 10000) / 10000;
                        for (const [ped, monto] of inv.attributed) {
                            inv.attributed.set(ped, Math.round(monto * f * 100) / 100);
                        }
                        inv.unattributed = Math.round(inv.unattributed * f * 100) / 100;
                    }
                    if (inv.invoiceNumber) out.push(inv);
                }
                resolve(out);
            } catch (err) {
                reject(err);
            }
        });

        parser.parseBuffer(pdfBuffer);
    });
}

/**
 * Costo real POR PEDIDO: suma de sus líneas en todos los comprobantes (ambas
 * series) + reparto de las líneas sin nº de pedido usando el vínculo
 * pedido→facturas de la API. Devuelve también métricas de conciliación.
 */
export async function buildPedidoAmountMap(
    page: any,
    clientId: string,
    from: Date,
    to: Date,
    pedidoInvoices: Map<string, string[]>, // nº pedido → nº de facturas (de la API)
): Promise<{ amounts: Map<string, number>; stats: { invoices: number; attributedSum: number; unattributedSum: number; distributedSum: number; conDescuento: number; descuentoPromedio: number | null } }> {
    const amounts = new Map<string, number>();
    const stats = { invoices: 0, attributedSum: 0, unattributedSum: 0, distributedSum: 0, conDescuento: 0, descuentoPromedio: null as number | null };

    const pdf = await downloadInvoicePdf(page, clientId, from, to);
    if (!pdf) return { amounts, stats };
    const invoices = await parseInvoicePdf(pdf);
    stats.invoices = invoices.length;

    // Índice inverso: factura → pedidos que la referencian según la API
    const invoicePedidos = new Map<string, string[]>();
    for (const [ped, invs] of pedidoInvoices) {
        for (const n of invs) {
            const key = normalizeInvoiceNumber(n);
            invoicePedidos.set(key, [...(invoicePedidos.get(key) || []), ped]);
        }
    }

    const factores: number[] = [];
    for (const inv of invoices) {
        if (inv.descuento !== null) { stats.conDescuento++; factores.push(inv.descuento); }
        for (const [ped, sum] of inv.attributed) {
            amounts.set(ped, (amounts.get(ped) || 0) + sum);
            stats.attributedSum += sum;
        }
        if (inv.unattributed > 0) {
            stats.unattributedSum += inv.unattributed;
            const peds = invoicePedidos.get(inv.invoiceNumber) || [];
            // Preferir los pedidos de esta factura SIN líneas propias en ella;
            // si todos tienen, repartir a prorrata simple entre todos.
            const sinLineas = peds.filter(p => !inv.attributed.has(p));
            const target = sinLineas.length > 0 ? sinLineas : peds;
            if (target.length > 0) {
                const share = inv.unattributed / target.length;
                for (const ped of target) {
                    amounts.set(ped, (amounts.get(ped) || 0) + share);
                    stats.distributedSum += share;
                }
            }
        }
    }
    if (factores.length > 0) {
        stats.descuentoPromedio = Math.round((factores.reduce((a, b) => a + b, 0) / factores.length) * 10000) / 10000;
    }
    return { amounts, stats };
}
