require("dotenv").config();
const { PrismaClient } = require('@prisma/client');
const PROD_URL = process.env.PROD_DATABASE_URL;

async function main() {
    console.log("Connecting to Production Database...");
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    await prod.$connect();
    
    const myopiluxProducts = await prod.product.findMany({
        where: {
            name: {
                startsWith: 'MYOPILUX KIDS'
            }
        }
    });

    for (const p of myopiluxProducts) {
        // Change name from "MYOPILUX KIDS LITE - ..." to "MYOPILUX KIDS LITE (Control miopico) - ..."
        const newName = p.name.replace(" - ", " (Control miopico) - ");
        console.log(`Updating: ${newName}`);
        
        await prod.product.update({
            where: { id: p.id },
            data: {
                name: newName,
                type: "Cristal Control Miopico" // Creating a special type for them
            }
        });
    }

    console.log(`Successfully updated ${myopiluxProducts.length} products.`);
    await prod.$disconnect();
}

main().catch(console.error);
