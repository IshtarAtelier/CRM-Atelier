import { PrismaClient } from '@prisma/client';
import { generateOrderPDF } from './src/lib/order-pdf-generator';
import fs from 'fs';

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
        if (!order) { console.log('No orders'); return; }
        
        const { base64, filename } = await generateOrderPDF(order, order.client);
        
        // Save to file
        const buf = Buffer.from(base64, 'base64');
        fs.writeFileSync('/tmp/test_atelier.pdf', buf);
        console.log('Saved to /tmp/test_atelier.pdf |', buf.length, 'bytes');
        console.log('First bytes:', buf.slice(0, 20).toString('ascii'));
    } catch (err: any) {
        console.error(err.message);
    } finally {
        await prisma.$disconnect();
    }
}
test();
