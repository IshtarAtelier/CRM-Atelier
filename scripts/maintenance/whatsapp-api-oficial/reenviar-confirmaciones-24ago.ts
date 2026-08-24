/**
 * One-off del 24/8/2026: manda las DOS confirmaciones de compra que quedaron
 * sin WhatsApp durante la ventana sin transporte (entre el escaneo del QR de
 * coexistencia y el encendido de la API oficial). Las fichas decían ✅ pero en
 * el buzón no había ninguna: la sesión vieja confirmaba envíos que ya no salían.
 *
 *   PROD=1 npx tsx scripts/maintenance/whatsapp-api-oficial/reenviar-confirmaciones-24ago.ts
 *
 * Va por la plantilla aprobada `venta_confirmada` (sirve con ventana abierta o
 * cerrada) con el MISMO PDF que ya se generó para cada pedido, bajado del
 * storage con las credenciales de Firebase del .env. El mail ya les había
 * llegado a los dos: esto repone solo el WhatsApp.
 *
 * Borrar después de correrlo (queda en git como constancia).
 */
import 'dotenv/config';

if (process.env.PROD !== '1') {
    console.error('Correr con PROD=1 (este one-off solo tiene sentido contra producción).');
    process.exit(1);
}

const WA = 'https://magnificent-courage-production-83d7.up.railway.app';
const KEY = process.env.BOT_API_KEY || '';

const VENTAS = [
    { nro: '#2X2G', nombre: 'Fernando Berretta', phone: '5493516529797', total: 915688, pdfKey: 'confirmaciones/cmt1rjddv006f5s4gd5ue2x2g-1.pdf' },
    { nro: '#ZM11', nombre: 'Viviana Infante', phone: '5493516509183', total: 1048711, pdfKey: 'confirmaciones/cmt4hcnyi00aemi7cx4hczm11-2.pdf' },
];

const plata = (n: number) => '$ ' + n.toLocaleString('es-AR');

async function main() {
    const { getFileBuffer } = await import('../../../src/lib/storage');
    for (const v of VENTAS) {
        console.log(`→ ${v.nombre} (${v.nro})`);
        const pdf = await getFileBuffer(v.pdfKey);
        if (!pdf) { console.error('   ✖ no se pudo bajar el PDF', v.pdfKey); continue; }
        const bodyParams = [v.nombre.split(' ')[0], v.nro, plata(v.total)];
        const preview = `Hola ${bodyParams[0]}, confirmamos tu compra ${v.nro} en Atelier Óptica por un total de ${bodyParams[2]}. Te adjuntamos el detalle. Te avisamos por acá cuando esté lista. ¡Gracias por elegirnos!`;
        const res = await fetch(`${WA}/api/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': KEY },
            body: JSON.stringify({
                chatId: v.phone,
                message: preview,
                senderName: 'Sistema Atelier',
                isProactive: true,
                media: { base64: pdf.toString('base64'), mimetype: 'application/pdf', filename: `Pedido ${v.nro} - Atelier Optica.pdf` },
                template: { name: 'venta_confirmada', bodyParams },
            }),
        });
        const j = await res.json().catch(() => ({}));
        console.log(`   ${res.ok ? '✅ enviado' : '✖ ' + res.status + ' ' + JSON.stringify(j).slice(0, 200)}`);
    }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
