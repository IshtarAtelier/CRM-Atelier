import PDFParser from 'pdf2json';

export interface OptovisionInvoiceData {
    labOrderNumber: string | null;
    /** TODOS los pedidos de la línea "Ped:" — Optovision a veces factura 2-3
     *  juntos: "Ped: TI-7101568(587979) /TI-7101583(588049) /TI-7101638(588966)".
     *  Ese ejemplo es real y son TRES CLIENTES distintos en un mismo comprobante. */
    labOrderNumbers: string[];
    /** pedido → el otro identificador, el de la planilla ("587979" → "7101568"). */
    aliasPorPedido: Record<string, string>;
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
                // Optovisión escribe la línea "Ped:" de DOS formas:
                //   a) "Ped: TI-7101568(587979)" — el pedido es el de paréntesis
                //      y el de la letra es el alias de la planilla del vendedor.
                //   b) "Ped: TM-3578630" — SIN paréntesis. Acá no hay alias: el
                //      número de la letra ES el pedido, y así está cargado en la
                //      venta (los de 7 dígitos). Exigir paréntesis dejaba estas
                //      facturas con cero pedidos y por lo tanto huérfanas para
                //      siempre, aunque la venta estuviera cargada: pasó con la
                //      3025-00044882 (Federico Paulucci) y la 3025-00045490
                //      (Paola de Diaz), verificadas contra el PDF el 24/8/2026.
                const conParentesis = pedLine
                    ? [...pedLine[0].matchAll(/([A-Za-z]{1,3})-?(\d{5,})\s*\((\d{5,})\)/g)]
                    : [];
                const sueltos = pedLine
                    // El `(?!\d)` es imprescindible: sin él, ante "TI-7101568(587979)"
                    // el motor retrocede y matchea "710156" (dejando afuera el 8)
                    // para que el siguiente carácter no sea un paréntesis, e
                    // inventa un pedido que no existe.
                    ? [...pedLine[0].matchAll(/\b([A-Za-z]{1,3})-(\d{5,})(?!\d)(?!\s*\()/g)].map(m => m[2])
                    : [];
                const labOrderNumbers = [
                    ...(pedLine ? [...pedLine[0].matchAll(/\((\d{5,})\)/g)].map(m => m[1]) : []),
                    ...sueltos,
                ];
                const labOrderNumber = labOrderNumbers[0] ?? null;

                // 1b. EL OTRO IDENTIFICADOR. Cada pedido viene con DOS números:
                // "Ped: TI-7101568(587979)". El de paréntesis es el pedido; el de
                // la T es el que Optovisión escribe en la planilla que recibe el
                // vendedor, y es el que a veces termina cargado en la venta (sin
                // la letra: 7101568). Guardar los dos es lo único que permite
                // encontrar la venta cuando se cargó con el de la planilla — si
                // no, la factura queda huérfana para siempre con la venta ahí.
                const aliasPorPedido: Record<string, string> = {};
                for (const m of conParentesis) {
                    aliasPorPedido[m[3]] = m[2];
                }
                
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
                    aliasPorPedido,
                    subtotal,
                    total,
                    rawText: text
                });
            });
            
            pdfParser.parseBuffer(pdfBuffer);
        });
    }
}
