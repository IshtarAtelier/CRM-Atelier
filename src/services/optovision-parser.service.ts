import PDFParser from 'pdf2json';

export interface OptovisionInvoiceData {
    labOrderNumber: string | null;
    /** TODOS los pedidos de la línea "Ped:" — Optovision a veces factura 2-3
     *  juntos: "Ped: TI-7101568(587979) /TI-7101583(588049) /TI-7101638(588966)". */
    labOrderNumbers: string[];
    subtotal: number | null;
    total: number | null;
    rawText: string;
}

export class OptovisionParserService {
    /**
     * Normaliza un importe en formato argentino a número.
     * "45.360,00" (miles con '.', decimal con ',') → 45360.00
     * "45.360"    (sin decimal: los '.' son separadores de miles) → 45360
     * Antes se hacía parseFloat("45.360") = 45.36 → costo mil veces menor.
     */
    static parseARNumber(raw: string | null | undefined): number | null {
        if (!raw) return null;
        let s = String(raw).trim().replace(/\$/g, '').replace(/\s/g, '');
        if (s.includes(',')) {
            s = s.replace(/\./g, '').replace(',', '.');
        } else {
            // Sin coma decimal: los puntos son separadores de miles.
            s = s.replace(/\./g, '');
        }
        const n = parseFloat(s);
        return Number.isFinite(n) ? n : null;
    }

    /**
     * Parses a PDF buffer and extracts relevant invoice data.
     */
    static async parseInvoice(pdfBuffer: Buffer): Promise<OptovisionInvoiceData> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("PDF parsing timed out after 10 seconds"));
            }, 10000);

            const pdfParser = new PDFParser(null as any, true);
            
            pdfParser.on('pdfParser_dataError', (errData: any) => {
                clearTimeout(timeout);
                reject(errData.parserError);
            });
            
            pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
                clearTimeout(timeout);
                const text = pdfParser.getRawTextContent();
                
                // 1. Extract Lab Order Number(s) — solo de la línea "Ped:", con
                // 5+ dígitos (excluye el código postal "(1408)" de la dirección).
                const pedLine = text.match(/Ped:[^\n]*/);
                const labOrderNumbers = pedLine
                    ? [...pedLine[0].matchAll(/\((\d{5,})\)/g)].map(m => m[1])
                    : [];
                const labOrderNumber = labOrderNumbers[0] ?? null;
                
                // 2. Extract Subtotal (tolera miles con '.' y decimal con ',')
                const subtotalMatch = text.match(/Subtotal:\s*\$?\s*([0-9][0-9.,]*)/);
                const subtotal = subtotalMatch ? OptovisionParserService.parseARNumber(subtotalMatch[1]) : null;

                // 3. Extract Total
                let total = null;
                const ivaLines = text.split('\n').filter(l => l.includes('IVA INSC.'));
                if (ivaLines.length > 0) {
                    const lines = text.split('\n');
                    const ivaIndex = lines.findIndex(l => l.includes('IVA INSC.'));
                    if (ivaIndex > 0) {
                        const previousLine = lines[ivaIndex - 1];
                        // Tokens numéricos completos (con miles/decimales), tomamos el último.
                        const nums = previousLine.match(/[0-9][0-9.,]*[0-9]|[0-9]/g);
                        if (nums && nums.length > 0) {
                            total = OptovisionParserService.parseARNumber(nums[nums.length - 1]);
                        }
                    }
                }
                
                resolve({
                    labOrderNumber,
                    labOrderNumbers,
                    subtotal,
                    total,
                    rawText: text
                });
            });
            
            pdfParser.parseBuffer(pdfBuffer);
        });
    }
}
