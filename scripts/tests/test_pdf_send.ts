import { PrismaClient } from '@prisma/client';
import { generateOrderPDF } from './src/lib/order-pdf-generator';

async function test() {
    const prisma = new PrismaClient();
    try {
        const order = await prisma.order.findFirst({
            where: { items: { some: {} } },
            orderBy: { createdAt: 'desc' },
            include: {
                client: true,
                items: { include: { product: true } },
                payments: true,
                prescription: true
            }
        });
        
        if (!order) { console.log('❌ No hay ordenes'); return; }
        console.log('✅ Orden:', order.id.slice(-6), '| Cliente:', order.client?.name);
        
        console.log('Generando PDF...');
        const start = Date.now();
        const { base64, filename } = await generateOrderPDF(order, order.client);
        console.log(`✅ PDF Generado: ${filename} | ${Date.now() - start}ms`);
        
        const isSale = order.orderType === 'SALE';
        const itemNames = (order.items || []).map((it: any) => it.product?.name || it.productNameSnapshot || 'Artículo').join(', ');
        const clientName = order.client?.name?.split(' ')[0] || 'Cliente';
        const text = `Hola ${clientName}, adjunto tu ${isSale ? 'orden' : 'presupuesto'} por: ${itemNames}.\n\nAtelier Óptica, la óptica mejor calificada.`;

        // Enviar via PRODUCCIÓN WhatsApp
        console.log('\nEnviando PDF por WhatsApp (producción)...');
        const res = await fetch('https://crm-atelier-production-ae72.up.railway.app/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chatId: '5493541215971@c.us',
                message: text,
                media: { base64, mimetype: 'application/pdf', filename }
            })
        });
        const data = await res.text();
        console.log('Status:', res.status, data);
        if (res.ok) console.log('\n🎉 ✅ PDF ENVIADO EXITOSAMENTE POR WHATSAPP');
        else console.log('\n❌ FALLÓ');
    } catch (err: any) {
        console.error('❌', err.message);
    } finally {
        await prisma.$disconnect();
    }
}
test();
