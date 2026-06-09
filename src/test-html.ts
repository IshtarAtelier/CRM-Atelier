import { PrismaClient } from '@prisma/client';
import { getReceiptHtml } from './lib/receipt-pdf-generator';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function run() {
    try {
        const payment = await prisma.payment.findFirst({
            orderBy: { date: 'desc' },
            include: {
                order: {
                    include: { client: true }
                }
            }
        });

        if (!payment) return;
        
        const html = getReceiptHtml(payment, payment.order, payment.order.client);
        fs.writeFileSync('test-receipt.html', html);
        console.log('HTML guardado como test-receipt.html');
        
    } finally {
        await prisma.$disconnect();
    }
}
run();
