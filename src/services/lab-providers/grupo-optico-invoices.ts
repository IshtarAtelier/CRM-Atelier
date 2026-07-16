import PDFParser from 'pdf2json';

/**
 * Descarga y parseo de las facturas de Grupo Óptico.
 *
 * El portal SmartLab no expone importes por pedido en JSON: la cuenta corriente
 * solo lista deuda impaga (vacía si se paga al contado). El único origen de los
 * montos es el PDF de facturas emitidas por rango de fechas, que su propia app
 * descarga con:
 *   GET /smartlab-api-v2/public/index.php/laboratory/order/invoice?cl={cliente}&t=2&c=1&s={DD-MM-YYYY}&e={DD-MM-YYYY}
 * Devuelve un PDF con una factura por página (nº de factura + nº de pedido + Total).
 *
 * Este módulo lo parsea a un mapa nº-de-factura → importe. El proveedor lo cruza
 * contra el nº de factura que ya trae cada pedido de la API (invoices[].number).
 */

export interface InvoiceAmount {
    invoiceNumber: string; // "0004-00340415"
    amount: number;        // total facturado (los consumidor-final no discriminan IVA: el total ES el monto)
    orderNumbers: string[]; // pedidos referidos en esa página (respaldo del join)
}

const API_BASE = 'https://grupooptico.dyndns.info/smartlab-api-v2/public/index.php';

/** Formatea una fecha a DD-MM-YYYY (lo que espera el endpoint de descarga). */
function toDdMmYyyy(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/**
 * Descarga el PDF de facturas del rango [from, to] usando la sesión autenticada
 * de la página Playwright que se le pasa. Devuelve un Buffer, o null si el lab
 * respondió que no hay facturas (404).
 */
export async function downloadInvoicePdf(page: any, clientId: string, from: Date, to: Date): Promise<Buffer | null> {
    const url = `${API_BASE}/laboratory/order/invoice?cl=${clientId}&t=2&c=1&s=${toDdMmYyyy(from)}&e=${toDdMmYyyy(to)}`;
    const result: { status: number; b64: string; size: number } = await page.evaluate(async (u: string) => {
        const r = await fetch(u, { credentials: 'include' });
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

/** Parsea el PDF de facturas a una lista de { nº factura, importe, pedidos }. */
export function parseInvoicePdf(pdfBuffer: Buffer): Promise<InvoiceAmount[]> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Parseo de PDF de facturas excedió 60s')), 60000);
        const parser = new PDFParser(null as any, true);

        parser.on('pdfParser_dataError', (err: any) => { clearTimeout(timeout); reject(err.parserError); });
        parser.on('pdfParser_dataReady', () => {
            clearTimeout(timeout);
            try {
                const text = parser.getRawTextContent();
                const pages = text.split(/----------------Page \(\d+\).*?----------------/);
                const out: InvoiceAmount[] = [];
                for (const pg of pages) {
                    const invMatch = pg.match(/(\d{4}-\d{8})/);
                    // "Sub Total 352.232,00" es el neto de la factura (== total en consumidor final)
                    const totMatch = pg.match(/Sub\s*Total\s+([\d.]+,\d{2})/) || pg.match(/Total\s*\$?\s*([\d.]+,\d{2})/);
                    if (!invMatch || !totMatch) continue;
                    const amount = parseFloat(totMatch[1].replace(/\./g, '').replace(',', '.'));
                    const orderNumbers = [...new Set([...pg.matchAll(/\b(80\d{6})\b/g)].map(m => m[1]))];
                    out.push({ invoiceNumber: invMatch[1], amount, orderNumbers });
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
 * Descarga + parsea + arma el mapa nº-de-factura → importe para el rango dado.
 * Suma cuando una factura aparece repetida. Ignora importes 0 (remitos letra X).
 */
export async function buildInvoiceAmountMap(page: any, clientId: string, from: Date, to: Date): Promise<Map<string, number>> {
    const pdf = await downloadInvoicePdf(page, clientId, from, to);
    const map = new Map<string, number>();
    if (!pdf) return map;
    const invoices = await parseInvoicePdf(pdf);
    for (const inv of invoices) {
        if (inv.amount > 0) map.set(inv.invoiceNumber, (map.get(inv.invoiceNumber) || 0) + inv.amount);
    }
    return map;
}
