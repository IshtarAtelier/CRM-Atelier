
import { getAfipInstance } from '../src/lib/afip';

async function testPdf() {
    const afip = getAfipInstance('ISH');
    console.log('Produccion mode?', afip.options.production);
    try {
        const pdfInfo = await afip.ElectronicBilling.createPDF({
            CbteTipo: 11,
            PtoVta: 3,
            CbteNro: 1,
            CbteFch: '20260416',
            ImpTotal: 160194,
            CAE: '86161914321109',
            CAEFchVto: '20260427',
            DocTipo: 96,
            DocNro: '44490849',
            condicion_venta: 'Otra',
            forma_de_pago: 'Otra',
            items: [{
                description: 'Producto prueba',
                quantity: 1,
                unit_price: 160194,
                total: 160194,
            }],
        });
        console.log('PDF info:', pdfInfo);
    } catch(e: any) {
        console.error('PDF error:', e.message || e);
    }
}
testPdf();
