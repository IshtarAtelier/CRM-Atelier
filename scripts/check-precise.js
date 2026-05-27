require("dotenv").config();
const { PrismaClient } = require('@prisma/client');
const PROD_URL = process.env.PROD_DATABASE_URL;

async function main() {
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    await prod.$connect();
    
    const products = await prod.product.findMany({
        where: {
            name: {
                startsWith: 'KODAK PRECISE'
            }
        },
        orderBy: {
            name: 'asc'
        }
    });

    console.log("=== PRECIOS VIEJOS DE KODAK PRECISE ===");
    const tableData = products.map(p => {
        return {
            Nombre: p.name,
            "Precio Viejo": p.price
        };
    });
    console.table(tableData);
    
    await prod.$disconnect();
}

main().catch(console.error);
