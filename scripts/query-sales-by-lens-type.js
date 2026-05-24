const { PrismaClient } = require('@prisma/client');
const PROD_URL = "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway";

async function main() {
    console.log("Connecting to Production Database...");
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    await prod.$connect();

    const startOfMonth = new Date(2026, 4, 1);
    const endOfMonth = new Date(2026, 5, 1);

    const sales = await prod.order.findMany({
        where: {
            orderType: 'SALE',
            isDeleted: false,
            createdAt: {
                gte: startOfMonth,
                lt: endOfMonth
            }
        },
        include: {
            items: {
                include: {
                    product: true
                }
            }
        }
    });

    const byLensType = {
        Multifocal: 0,
        Monofocal: 0,
        Ocupacional: 0,
        Contacto: 0,
        Otro: 0
    };

    for (const s of sales) {
        for (const it of s.items) {
            const p = it.product;
            if (!p) continue;
            
            const name = (p.name || "").toUpperCase();
            const type = (p.type || "").toUpperCase();
            const cat = (p.category || "").toUpperCase();

            const amount = it.price * it.quantity;

            if (cat === 'CRISTAL' || type.includes('CRISTAL') || name.includes('CRISTAL') || name.includes('TRANSITIONS') || name.includes('VARILUX') || name.includes('KODAK')) {
                if (name.includes('MULTIFOCAL') || name.includes('VARILUX') || name.includes('PRECISE') || name.includes('UNIQUE') || type.includes('MULTIFOCAL')) {
                    byLensType.Multifocal += amount;
                } else if (name.includes('INTERVIEW') || name.includes('OCUPACIONAL') || type.includes('OCUPACIONAL') || type.includes('INTERVIEW')) {
                    byLensType.Ocupacional += amount;
                } else {
                    byLensType.Monofocal += amount;
                }
            } else if (cat === 'LENTES DE CONTACTO' || type.includes('CONTACTO')) {
                byLensType.Contacto += amount;
            } else {
                byLensType.Otro += amount;
            }
        }
    }

    console.log("\nSales by Lens/Product Type:");
    console.log(byLensType);

    await prod.$disconnect();
}

main().catch(console.error);
