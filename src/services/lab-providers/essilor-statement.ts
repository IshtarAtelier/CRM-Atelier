import PDFParser from 'pdf2json';

/**
 * Parser del resumen de cuenta de Essilor/Optovision ("Documentos Pendientes"),
 * que llega semanalmente por email desde procesos@essilor.com.ar. Es la cuenta
 * corriente oficial: lista las facturas impagas con importe original y saldo, y
 * el total adeudado. Fuente de verdad de la DEUDA (el portal no la expone).
 *
 * Layout observado (una tabla): columnas
 *   Vencimiento | Documento | Serie | Nro | Fecha | Importe Orig. | Saldo M/O | Saldo(acum)
 * y al pie "Tolales ATELIER OPTICA : <total>" (sic: el sistema de Essilor emite
 * "Tolales" con ele). Se parsea por coordenadas (ancladas a los encabezados)
 * para ser robusto al orden del texto.
 */

export interface StatementRow {
    serie: string;          // "3008"
    nro: string;            // "62896"
    invoiceNumber: string;  // "0004-00062896"? no: Essilor usa serie-nro → "3008-00062896" normalizado
    fecha: string | null;   // dd/mm/yyyy
    importe: number;        // importe original
    saldo: number;          // saldo pendiente de esa factura
}

export interface ParsedStatement {
    statementDate: Date | null;
    totalDebt: number | null;
    rows: StatementRow[];
}

const dec = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };
// Montos en los TRES formatos que emite Essilor según el documento (verificado
// con PDFs reales):
//   "1.056.829,96" (AR)  ·  "1,056,829.96" (US — el resumen de cuenta usa este)
//   ·  "1056829.96" (decimal con punto, sin separador de miles).
// AR y US se distinguen sin ambigüedad por el separador decimal (",dd" vs ".dd").
const money = (s: string): number | null => {
    const t = String(s).trim();
    if (/^\d{1,3}(\.\d{3})*,\d{2}$/.test(t)) return parseFloat(t.replace(/\./g, '').replace(',', '.'));
    if (/^\d{1,3}(,\d{3})*\.\d{2}$/.test(t) || /^\d+\.\d{2}$/.test(t)) return parseFloat(t.replace(/,/g, ''));
    return null;
};
const parseDdMmYyyy = (s: string): Date | null => {
    const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])) : null;
};

/** Normaliza serie-nro de Essilor a "SSSS-NNNNNNNN" (nro a 8 dígitos, como las facturas). */
export function essilorInvoiceKey(serie: string, nro: string): string {
    return `${serie}-${nro.padStart(8, '0')}`;
}

export function parseEssilorStatement(pdfBuffer: Buffer): Promise<ParsedStatement> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Parseo del resumen de cuenta excedió 60s')), 60000);
        const parser = new PDFParser(null as any, true);
        parser.on('pdfParser_dataError', (err: any) => { clearTimeout(timeout); reject(err.parserError); });
        parser.on('pdfParser_dataReady', (data: any) => {
            clearTimeout(timeout);
            try {
                const out: StatementRow[] = [];
                let statementDate: Date | null = null;
                let totalDebt: number | null = null;

                for (const pg of data.Pages || []) {
                    // Orden VISUAL (y, x): el stream del PDF trae los textos en
                    // cualquier orden, y los matches sobre `full` ("FECHA HASTA :"
                    // seguido de su fecha, "Tolales … :" seguido del total) solo
                    // valen si el texto se lee como en la página.
                    const texts = (pg.Texts || [])
                        .map((t: any) => ({ x: t.x, y: t.y, s: dec(t.R.map((r: any) => r.T).join('')).trim() }))
                        .filter((t: any) => t.s)
                        .sort((a: any, b: any) => (a.y - b.y) || (a.x - b.x));

                    // Fecha del resumen ("FECHA HASTA : 19/07/2026")
                    const full = texts.map((t: any) => t.s).join(' ');
                    if (!statementDate) {
                        const fh = full.match(/FECHA\s*HASTA\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i);
                        if (fh) statementDate = parseDdMmYyyy(fh[1]);
                    }
                    // Total adeudado. El pie real dice "Tolales ATELIER OPTICA : 4,305,353.01"
                    // (typo "Tolales" incluido) y abajo "Totales Moneda $ : …". Se tolera
                    // typo, cualquier nombre de titular y los tres formatos de monto.
                    const tot = full.match(/To[tl]ales?[^:]{0,60}:\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2}|\d+[.,]\d{2})/i);
                    if (tot) { const v = money(tot[1]); if (v !== null) totalDebt = v; }

                    // Encabezados: ubicar columnas Serie / Nro / Fecha
                    let xSerie = 0, xNro = 0, xFecha = 0;
                    for (const t of texts) {
                        if (/^Serie$/i.test(t.s)) xSerie = t.x;
                        else if (/^Nro\.?$/i.test(t.s)) xNro = t.x;
                        else if (/^Fecha$/i.test(t.s)) xFecha = t.x;
                    }
                    if (!xSerie || !xNro) continue; // esta página no tiene la tabla

                    // Filas por proximidad vertical
                    const rows: Record<string, { x: number; s: string }[]> = {};
                    for (const t of texts) {
                        const k = String(Math.round(t.y * 2) / 2);
                        (rows[k] = rows[k] || []).push(t);
                    }
                    // Celda candidata más CERCANA al ancla de su columna. Elegir por
                    // distancia mínima (y no el primer match por x) es clave: la celda
                    // de Serie ("3008") también cae dentro de la tolerancia de Nro, y
                    // si se cuela como Nro todas las filas quedan "3008-3008" y el
                    // dedup las colapsa (así salió la "deuda $40,30" del 22/7).
                    const nearest = (cells: { x: number; s: string }[], re: RegExp, anchor: number, tol: number, skip?: { x: number; s: string }) =>
                        cells.filter(c => c !== skip && re.test(c.s) && Math.abs(c.x - anchor) < tol)
                            .sort((a, b) => Math.abs(a.x - anchor) - Math.abs(b.x - anchor))[0];
                    for (const [, cells] of Object.entries(rows).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))) {
                        const sorted = cells.sort((a, b) => a.x - b.x);
                        // Serie = 3008/3025 cerca de la col Serie
                        const serieCell = nearest(sorted, /^\d{4}$/, xSerie, 3);
                        if (!serieCell) continue;
                        const nroCell = nearest(sorted, /^\d{3,8}$/, xNro, 4, serieCell);
                        if (!nroCell) continue;
                        // Fecha de la factura: la celda dd/mm/yyyy anclada a la columna
                        // "Fecha" (la primera de la fila es el Vencimiento, no confundir).
                        const fechaCell = sorted.find(c => /^\d{2}\/\d{2}\/\d{4}$/.test(c.s)
                            && (!xFecha || Math.abs(c.x - xFecha) < 3));
                        // montos de la fila, en orden de x: [importe orig, saldo m/o, saldo acum]
                        const montos = sorted.filter(c => money(c.s) !== null).map(c => money(c.s) as number);
                        if (montos.length < 1) continue;
                        // El saldo de la factura es el 2º monto si hay 3 (importe, saldoMO, saldoAcum);
                        // si hay 2 (importe, saldo) es el 2º; si hay 1, ese.
                        const importe = montos[0];
                        const saldo = montos.length >= 3 ? montos[1] : (montos.length === 2 ? montos[1] : montos[0]);
                        out.push({
                            serie: serieCell.s, nro: nroCell.s,
                            invoiceNumber: essilorInvoiceKey(serieCell.s, nroCell.s),
                            fecha: fechaCell ? fechaCell.s : null,
                            importe, saldo,
                        });
                    }
                }

                // Dedup por serie-nro (por si una fila se partió)
                const seen = new Set<string>();
                const rowsUniq = out.filter(r => {
                    const k = `${r.serie}-${r.nro}`;
                    if (seen.has(k)) return false; seen.add(k); return true;
                });
                // Fallback del total: suma de saldos si no se detectó el pie
                if (totalDebt === null && rowsUniq.length) {
                    totalDebt = Math.round(rowsUniq.reduce((t, r) => t + r.saldo, 0) * 100) / 100;
                }
                resolve({ statementDate, totalDebt, rows: rowsUniq });
            } catch (err) {
                reject(err);
            }
        });
        parser.parseBuffer(pdfBuffer);
    });
}
