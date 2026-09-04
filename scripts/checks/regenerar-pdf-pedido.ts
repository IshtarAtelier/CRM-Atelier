/**
 * Regenera LOCALMENTE el PDF de un pedido (presupuesto/venta) para revisar cómo
 * quedó, sin tocar nada. Solo lee la base que diga DATABASE_URL (con la de
 * producción, SOLO con OK explícito) y escribe el PDF en la ruta pedida.
 *
 *   DATABASE_URL=… npx tsx scripts/checks/regenerar-pdf-pedido.ts <sufijo-o-id> [salida.pdf]
 *
 * El `select` de Product es explícito a propósito: el schema local suele ir
 * adelantado y un `include` contra producción pide columnas que allá no existen.
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { prisma } from '../../src/lib/db';
import { generateOrderPDF } from '../../src/lib/order-pdf-generator';

const [sufijo, salida = `./pedido-${process.argv[2] || 'x'}.pdf`] = process.argv.slice(2);
if (!sufijo) { console.error('Uso: regenerar-pdf-pedido.ts <sufijo-o-id> [salida.pdf]'); process.exit(1); }

const productSelect = Object.fromEntries('id name category type brand model stock lensIndex unitType laboratory price cost baseCost sphereMin sphereMax cylinderMin cylinderMax additionMin additionMax createdAt updatedAt is2x1 eligible2x1 botRecommended botLabel ageGroup bridgeWidth customSlug frameHeight gender imageProcessingStatus imagenesCatalogo lensWidth mpn publishToWeb rawImageUrls seoDescription seoTags seoTitle templeLength labType origin diameterMax diameterMin wholesalePrice publishToWholesale salePrice'.split(' ').map(c => [c, true]));

async function main() {
    const order: any = await prisma.order.findFirst({
        where: { OR: [{ id: sufijo }, { id: { endsWith: sufijo.toLowerCase() } }], isDeleted: false },
        include: { client: true, items: { include: { product: { select: productSelect } } }, payments: true, prescription: true, frames: true },
        orderBy: { createdAt: 'desc' },
    });
    if (!order) { console.error('Pedido no encontrado'); process.exit(1); }
    console.log(`Pedido ${order.id} (${order.orderType}) · ${order.items.length} ítems · ${order.client?.name}`);
    const r = await generateOrderPDF(order, order.client, order.labSentBy || 'Atelier');
    const buf = Buffer.from(r.base64, 'base64');
    writeFileSync(salida, buf);
    console.log(`OK ${r.filename} → ${salida} (${buf.length} bytes)`);
    await prisma.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
