import PDFParser from 'pdf2json';

export interface OptovisionInvoiceData {
    labOrderNumber: string | null;
    subtotal: number | null;
    total: number | null;
    rawText: string;
}

export class OptovisionParserService {
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
                
                // 1. Extract Lab Order Number
                const pedMatch = text.match(/Ped:.*?\((.*?)\)/);
                const labOrderNumber = pedMatch ? pedMatch[1].trim() : null;
                
                // 2. Extract Subtotal
                const subtotalMatch = text.match(/Subtotal:\s*([0-9]+\.[0-9]+)/);
                const subtotal = subtotalMatch ? parseFloat(subtotalMatch[1]) : null;
                
                // 3. Extract Total
                let total = null;
                const ivaLines = text.split('\n').filter(l => l.includes('IVA INSC.'));
                if (ivaLines.length > 0) {
                    const lines = text.split('\n');
                    const ivaIndex = lines.findIndex(l => l.includes('IVA INSC.'));
                    if (ivaIndex > 0) {
                        const previousLine = lines[ivaIndex - 1];
                        const floats = previousLine.match(/[0-9]+\.[0-9]+/g);
                        if (floats && floats.length > 0) {
                            total = parseFloat(floats[floats.length - 1]);
                        }
                    }
                }
                
                resolve({
                    labOrderNumber,
                    subtotal,
                    total,
                    rawText: text
                });
            });
            
            pdfParser.parseBuffer(pdfBuffer);
        });
    }
}
