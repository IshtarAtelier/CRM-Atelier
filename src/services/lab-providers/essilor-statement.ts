import PDFParser from 'pdf2json';

/**
 * Parser del resumen de cuenta de Essilor/Optovision ("Documentos Pendientes"),
 * que llega semanalmente por email desde procesos@essilor.com.ar. Es la cuenta
 * corriente oficial: lista las facturas impagas con importe original y saldo, y
 * el total adeudado. Fuente de verdad de la DEUDA (el portal no la expone).
 *
 * Layout observado (una tabla): columnas
 *   Vencimiento | Documento | Serie | Nro | Fecha | Importe Orig. | Saldo M/O | Saldo(acum)
 * y al pie "Totales ATELIER OPTICA : <total>". Se parsea por coordenadas
 * (ancladas a los encabezados) para ser robusto al orden del texto.
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
// Montos formato argentino "1.056.829,96"
const money = (s: string): number | null => {
    const m = String(s).trim().match(/^\d{1,3}(\.\d{3})*,\d{2}$/);
    return m ? parseFloat(s.replace(/\./g, '').replace(',', '.')) : null;
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
                    const texts = (pg.Texts || [])
                        .map((t: any) => ({ x: t.x, y: t.y, s: dec(t.R.map((r: any) => r.T).join('')).trim() }))
                        .filter((t: any) => t.s);

                    // Fecha del resumen ("FECHA HASTA : 19/07/2026")
                    const full = texts.map((t: any) => t.s).join(' ');
                    if (!statementDate) {
                        const fh = full.match(/FECHA\s*HASTA\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i);
                        if (fh) statementDate = parseDdMmYyyy(fh[1]);
                    }
                    // Total adeudado ("Totales ATELIER OPTICA : 4.305.353,01" / "Totales Moneda $")
                    const tot = full.match(/Totales?\s+(?:ATELIER\s+OPTICA|Moneda\s*\$?)\s*:?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i);
                    if (tot) { const v = money(tot[1]); if (v !== null) totalDebt = v; }

                    // Encabezados: ubicar columnas Serie / Nro / (última) Saldo
                    let xSerie = 0, xNro = 0, xImporte = 0;
                    for (const t of texts) {
                        if (/^Serie$/i.test(t.s)) xSerie = t.x;
                        else if (/^Nro\.?$/i.test(t.s)) xNro = t.x;
                        else if (/^Importe/i.test(t.s)) xImporte = t.x;
                    }
                    if (!xSerie || !xNro) continue; // esta página no tiene la tabla

                    // Filas por proximidad vertical
                    const rows: Record<string, { x: number; s: string }[]> = {};
                    for (const t of texts) {
                        const k = String(Math.round(t.y * 2) / 2);
                        (rows[k] = rows[k] || []).push(t);
                    }
                    for (const cells of Object.values(rows)) {
                        const sorted = cells.sort((a, b) => a.x - b.x);
                        // Serie = 3008/3025 cerca de la col Serie
                        const serieCell = sorted.find(c => /^\d{4}$/.test(c.s) && Math.abs(c.x - xSerie) < 3);
                        if (!serieCell) continue;
                        const nroCell = sorted.find(c => /^\d{3,8}$/.test(c.s) && c.x > xSerie && Math.abs(c.x - xNro) < 4);
                        if (!nroCell) continue;
                        const fechaCell = sorted.find(c => /^\d{2}\/\d{2}\/\d{4}$/.test(c.s));
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
