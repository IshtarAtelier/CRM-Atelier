const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient({ 
    datasources: { 
        db: { url: 'postgresql://postgres:RrPSyEGtnMDeqWUAqHKGEIEHUmPcBSAL@interchange.proxy.rlwy.net:12759/railway' } 
    } 
});

async function run() {
    const orders = await prisma.order.findMany({
        where: { orderType: 'SALE', isDeleted: false },
        include: {
            client: true,
            items: { include: { product: true } }
        }
    });

    const clients = [];
    let grandTotalCost = 0;
    let grandTotalRevenue = 0;

    for (const order of orders) {
        let clientCost = 0;
        let clientRevenue = 0;
        let itemsDesc = [];
        let hasLab = false;

        for (const item of order.items) {
            const product = item.product;
            if (!product) continue;
            
            const cat = (product.category || '').toUpperCase();
            const isLens = cat.includes('LENS') || cat.includes('CRISTAL') || (product.type || '').includes('Cristal') || (product.type || '').includes('Multifocal') || (product.type || '').includes('Monofocal');
            const labName = product.laboratory;

            if (isLens && labName === 'GRUPO OPTICO') {
                hasLab = true;
                let cost = (product.cost || 0) * item.quantity;
                let calculation = "Normal";
                
                if (product.unitType === 'PAR' && item.eye && (product.cost || 0) > 0) {
                    cost = ((product.cost || 0) / 2) * item.quantity;
                    calculation = "Por Ojo (Costo Base / 2)";
                }

                const itemRevenue = item.price * item.quantity;

                clientCost += cost;
                clientRevenue += itemRevenue;

                itemsDesc.push(`  - **${product.name}** | Cantidad: ${item.quantity} | Ojo: ${item.eye || 'N/A'}\n    - Precio Venta (Total Ítem): $${itemRevenue}\n    - Costo Calculado: $${cost} *(Método: ${calculation})*`);
            }
        }

        if (hasLab) {
            grandTotalCost += clientCost;
            grandTotalRevenue += clientRevenue;
            clients.push({
                client: order.client?.name || 'Desconocido',
                date: order.createdAt,
                revenue: clientRevenue,
                cost: clientCost,
                items: itemsDesc
            });
        }
    }

    // Sort by revenue descending
    clients.sort((a,b) => b.revenue - a.revenue);

    let md = '# Reporte de Ventas: GRUPO OPTICO\n\n';
    md += `**Facturación Total:** $${grandTotalRevenue}\n`;
    md += `**Costo Total Calculado:** $${grandTotalCost}\n`;
    md += `**Total de Clientes / Órdenes:** ${clients.length}\n\n`;
    md += `---\n\n`;

    for (const c of clients) {
        md += `### Cliente: ${c.client}\n`;
        md += `- **Fecha:** ${c.date.toISOString().split('T')[0]}\n`;
        md += `- **Total Facturado (Grupo Óptico):** $${c.revenue}\n`;
        md += `- **Costo Asignado:** $${c.cost}\n`;
        md += `- **Ítems:**\n`;
        for (const i of c.items) {
            md += `${i}\n`;
        }
        md += '\n';
    }
    
    fs.writeFileSync('C:\\Users\\pisan\\.gemini\\antigravity\\brain\\7f20a10a-6741-4fc4-8a2d-8dc9ea3ab868\\reporte_grupo_optico.md', md);
    console.log('Done!');
}

run().catch(console.error).finally(() => process.exit(0));
