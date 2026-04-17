
const Afip = require('@afipsdk/afip.js');
const afip = new Afip({
  CUIT: 23386152314,
  access_token: process.env.AFIP_ACCESS_TOKEN_ISH,
  production: true
});

async function main() {
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
            description: 'Producto',
            quantity: 1,
            unit_price: 160194,
            total: 160194,
        }],
    });
    console.log('PDF info:', pdfInfo);
  } catch(e) {
    console.error('PDF error:', e.response ? e.response.data : e.message);
  }
}
main();
