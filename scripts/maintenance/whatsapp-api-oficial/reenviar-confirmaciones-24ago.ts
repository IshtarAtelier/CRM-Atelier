/**
 * One-off del 24/8/2026: manda las DOS confirmaciones de compra que quedaron
 * sin WhatsApp durante la ventana sin transporte (entre el escaneo del QR de
 * coexistencia y el encendido de la API oficial). Las fichas decían ✅ pero en
 * el buzón no había ninguna: la sesión vieja confirmaba envíos que ya no
 * salían. Por esas mismas notas, `sendSaleConfirmation` se niega a repetir
 * (idempotencia por versión) — así que este script arma el MISMO contenido con
 * las piezas reales (`buildSaleConfirmation` + `generateOrderPDF`) y manda solo
 * el WhatsApp (el mail sí les había llegado).
 *
 *   PROD=1 npx tsx scripts/maintenance/whatsapp-api-oficial/reenviar-confirmaciones-24ago.ts
 *
 * Va como plantilla aprobada `venta_confirmada` (ventana abierta o cerrada da
 * igual) con el PDF regenerado como encabezado. Borrar después de correrlo.
 */
import 'dotenv/config';

if (process.env.PROD !== '1') {
    console.error('Correr con PROD=1 (este one-off solo tiene sentido contra producción).');
    process.exit(1);
}
process.env.DATABASE_URL = process.env.PROD_DATABASE_URL || '';
if (!process.env.DATABASE_URL) { console.error('Falta PROD_DATABASE_URL'); process.exit(1); }

const WA = 'https://magnificent-courage-production-83d7.up.railway.app';
const KEY = process.env.BOT_API_KEY || '';

// Fernando (#2X2G) y Viviana (#ZM11) ya salieron el 24/8 23:03-23:04. Queda
// solo Adriana (#5LXO), cuyo primer intento murió por el @lid — ya migrado.
const ORDENES = ['cmt4kprm200cxmi7crmct5lxo'];

const plata = (n: number) => '$ ' + Math.round(n).toLocaleString('es-AR');

async function main() {
    const { prisma } = await import('../../../src/lib/db');
    const { SELECT_REPASO_CON_CLIENTE } = await import('../../../src/lib/order-recap-select');
    const { generateOrderPDF } = await import('../../../src/lib/order-pdf-generator');

    for (const id of ORDENES) {
        const order: any = await prisma.order.findUnique({ where: { id }, select: SELECT_REPASO_CON_CLIENTE as any });
        if (!order?.client) { console.error(`✖ ${id}: sin orden o sin cliente`); continue; }
        const nro = `#${String(order.id).slice(-4).toUpperCase()}`;
        const nombre = String(order.client.name || '').trim().split(/\s+/)[0] || 'cliente';
        console.log(`→ ${order.client.name} (${nro})`);

        const pdf = await generateOrderPDF(order, order.client, order.labSentBy || undefined);
        const bodyParams = [nombre, nro, plata(order.total || 0)];
        const preview = `Hola ${bodyParams[0]}, confirmamos tu compra ${nro} en Atelier Óptica por un total de ${bodyParams[2]}. Te adjuntamos el detalle. Te avisamos por acá cuando esté lista. ¡Gracias por elegirnos!`;

        const res = await fetch(`${WA}/api/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': KEY },
            body: JSON.stringify({
                chatId: (order.client.phone || '').replace(/\D/g, ''),
                message: preview,
                senderName: 'Sistema Atelier',
                isProactive: true,
                media: { base64: pdf.base64, mimetype: 'application/pdf', filename: pdf.filename },
                template: { name: 'venta_confirmada', bodyParams },
            }),
        });
        const j = await res.json().catch(() => ({}));
        console.log(`   ${res.ok ? '✅ WhatsApp enviado (plantilla venta_confirmada + PDF)' : '✖ ' + res.status + ' ' + JSON.stringify(j).slice(0, 200)}`);

        if (res.ok) {
            await prisma.interaction.create({
                data: {
                    clientId: order.client.id, type: 'NOTE', userId: 'sistema', userName: 'Sistema',
                    content: `📧 Confirmación de compra REENVIADA por WhatsApp (API oficial) · ${nro} — la del ${new Date().toLocaleDateString('es-AR')} había quedado sin salir por el cambio de transporte. Plantilla venta_confirmada + PDF.`,
                },
            }).catch((e: any) => console.error('   (nota en ficha falló:', e.message, ')'));
        }
    }
    await prisma.$disconnect();
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
