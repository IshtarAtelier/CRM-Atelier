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
     * Normaliza un importe a número tolerando LOS DOS formatos que emite
     * Optovision/Essilor según la serie de la factura (verificado con PDFs
     * reales de julio 2026):
     *   "45.360,00"  (AR: miles '.', decimal ',')       → 45360.00
     *   "362042.89"  (EN: decimal '.', serie 3025/3008) → 362042.89
     *   "45.360"     (un '.' + 3 dígitos: miles)        → 45360
     *   "1.234.567"  (varios '.': miles)                → 1234567
     * La regla anterior asumía siempre formato AR y convertía "438071.90" en
     * $43.807.190 (×100): sobrecostos fantasma de millones en el cruce.
     */
    static parseARNumber(raw: string | null | undefined): number | null {
        if (!raw) return null;
        let s = String(raw).trim().replace(/\$/g, '').replace(/\s/g, '');
        const lastDot = s.lastIndexOf('.');
        const lastComma = s.lastIndexOf(',');
        if (lastDot !== -1 && lastComma !== -1) {
            // Ambos separadores: el que está MÁS A LA DERECHA es el decimal.
            const dec = lastDot > lastComma ? '.' : ',';
            const thou = dec === '.' ? ',' : '.';
            s = s.split(thou).join('');
            if (dec === ',') s = s.replace(',', '.');
        } else if (lastComma !== -1) {
            // Solo comas: decimal si termina en ",dd"; si no, separador de miles.
            s = /,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.split(',').join('');
        } else if (lastDot !== -1) {
            // Solo puntos: UN punto seguido de exactamente 2 decimales = decimal
            // (formato de las facturas serie 3025/3008); cualquier otro caso, miles.
            const single = s.indexOf('.') === lastDot;
            if (!(single && /\.\d{2}$/.test(s))) s = s.split('.').join('');
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
