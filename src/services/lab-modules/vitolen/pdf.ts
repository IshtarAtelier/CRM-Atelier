import PDFParser from 'pdf2json';

/**
 * Texto de un PDF del portal de Vitolen, página por página (pdf2json, la
 * misma librería que leen las facturas de Grupo Óptico y Optovisión). El
 * orden de las líneas dentro de la página no es el visual: el parser de
 * comprobantes.ts ancla cada dato por su etiqueta y no por posición.
 */
export function textoPorPagina(buffer: Buffer, timeoutMs = 30_000): Promise<string[]> {
    return new Promise((resolve, reject) => {
        const parser = new PDFParser(null as any, true);
        const timeout = setTimeout(() => reject(new Error(`pdf2json no terminó de leer el PDF en ${timeoutMs / 1000} s`)), timeoutMs);
        parser.on('pdfParser_dataError', (e: any) => { clearTimeout(timeout); reject(new Error(e?.parserError?.message || e?.parserError || String(e))); });
        parser.on('pdfParser_dataReady', () => {
            clearTimeout(timeout);
            const crudo = parser.getRawTextContent();
            resolve(crudo.split(/\r?\n-{10,}Page \(\d+\) Break-{10,}\r?\n/).map(p => p.trim()).filter(Boolean));
        });
        parser.parseBuffer(buffer);
    });
}
