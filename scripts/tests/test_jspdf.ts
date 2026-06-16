import { prisma } from './src/lib/db';
import { generateOrderPDF } from './src/lib/order-pdf-generator';
import * as fs from 'fs';
import * as path from 'path';

async function test() {
    const order = await prisma.order.findFirst({ include: { items: { include: { product: true } }, client: true, payments: true }});
    if (!order) return;
    
    // Force jsPDF fallback by intentionally breaking the Playwright path
    process.env.PLAYWRIGHT_BROWSERS_PATH = '/invalid/path';
    
    const { base64 } = await generateOrderPDF(order, order.client);
    fs.writeFileSync(path.join('/Users/ishtarpissano/.gemini/antigravity/brain/404e3d3b-13bc-49ab-be65-b08acc5717eb/scratch', 'PremiumFallbackTest.pdf'), Buffer.from(base64, 'base64'));
    console.log('Premium PDF saved to scratch.');
}
test().catch(console.error).finally(() => process.exit(0));
