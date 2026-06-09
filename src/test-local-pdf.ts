import { PrismaClient } from '@prisma/client';
import { generateReceiptPDF } from './lib/receipt-pdf-generator';
import * as fs from 'fs';
import * as path from 'path';

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
        
        const { base64, filename } = await generateReceiptPDF(payment, payment.order, payment.order.client);
        
        const finalPath = path.join(process.cwd(), filename);
        fs.writeFileSync(finalPath, Buffer.from(base64, 'base64'));
        console.log(`__SUCCESS__:${finalPath}`);
        
    } finally {
        await prisma.$disconnect();
    }
}
run();
