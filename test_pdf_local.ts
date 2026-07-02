import { PrismaClient } from '@prisma/client';
import { generateOrderPDF } from './src/lib/order-pdf-generator';

const prisma = new PrismaClient();

async function test() {
    const order = await prisma.order.findFirst({
        include: {
            client: true,
            items: { include: { product: true } },
            payments: true,
            prescription: true
        }
    });
    
    if (!order) {
        console.log('No order found');
        return;
    }
    
    console.log('Generating PDF for order', order.id);
    try {
        const result = await generateOrderPDF(order, order.client);
        console.log('Success! Filename:', result.filename);
        console.log('Base64 length:', result.base64.length);
    } catch (e: any) {
        console.error('Error generating PDF:', e);
    } finally {
        await prisma.$disconnect();
    }
}

test();
