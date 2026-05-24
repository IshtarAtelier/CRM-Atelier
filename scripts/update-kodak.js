const { PrismaClient } = require('@prisma/client');
const PROD_URL = "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway";

async function main() {
    console.log("Connecting to Production Database...");
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    await prod.$connect();

    // 1. UPDATE UNIQUE DRO PRICES AND NAMES
    const uniqueUpdates = [
        { oldName: "UNIQUE DRO ORMA BLUE UV 2x1", cost: 383534, price: 920482 },
        { oldName: "UNIQUE DRO AIRWEAR 1.59 2x1", cost: 370103, price: 888247 },
        { oldName: "UNIQUE DRO AIRWEAR 1.59 BLUE UV 2x1", cost: 383534, price: 920482 },
        { oldName: "UNIQUE DRO STYLIS 1.67 2x1", cost: 445377, price: 1068905 },
        { oldName: "UNIQUE DRO STYLIS 1.67 BLUE UV 2x1", cost: 457186, price: 1097246 },
        { oldName: "UNIQUE DRO ORMA ACCLIMATES (Fotocromatico Gris) 2x1", cost: 479432, price: 1150637 },
        { oldName: "UNIQUE DRO ORMA TRANSITIONS GEN S  (Fotocromatico 8 Tonos) 2x1", cost: 599864, price: 1439674 },
        { oldName: "UNIQUE DRO AIRWEAR 1.59 TRANSITIONS GEN S (Fotocromatico Gris, Sepia) 2x1", cost: 645051, price: 1548122 },
        { oldName: "UNIQUE DRO STYLIS 1.67 TRANSITIONS GEN S (Fotocromatico Gris, Sepia) 2x1", cost: 669668, price: 1607203 },
        { oldName: "UNIQUE DRO ORMA XPERIO 2x1", cost: 599864, price: 1439674 },
        { oldName: "UNIQUE DRO AIRWEAR 1.59 XPERIO 2x1", cost: 645051, price: 1548122 }
    ];

    for (const u of uniqueUpdates) {
        const product = await prod.product.findFirst({ where: { name: u.oldName } });
        if (product) {
            // Clean up name by replacing "UNIQUE DRO" with "KODAK UNIQUE DRO -"
            // and removing the extra descriptors like "(Fotocromatico Gris)" for consistency
            let newName = `KODAK UNIQUE DRO - ${u.oldName.replace('UNIQUE DRO ', '')}`;
            // Clean parenthesis
            newName = newName.replace(/ \(.*?\)/g, '');
            // Fix double spaces
            newName = newName.replace(/  +/g, ' ');
            
            console.log(`Updating: ${u.oldName} -> ${newName}`);
            await prod.product.update({
                where: { id: product.id },
                data: {
                    name: newName,
                    cost: u.cost,
                    price: u.price,
                    laboratory: "OPTOVISION",
                    type: "Cristal Multifocal"
                }
            });
        }
    }

    // 2. CREATE THE MISSING UNIQUE DRO ORMA
    console.log(`Creating missing: KODAK UNIQUE DRO - ORMA 2x1`);
    await prod.product.create({
        data: {
            name: "KODAK UNIQUE DRO - ORMA 2x1",
            cost: 370103,
            price: 888247,
            laboratory: "OPTOVISION",
            is2x1: true,
            lensIndex: "1.50",
            category: "Cristal",
            type: "Cristal Multifocal"
        }
    });

    // 3. RENAME PRECISE ITEMS TO ADD KODAK
    const preciseProducts = await prod.product.findMany({
        where: { name: { startsWith: 'PRECISE' } }
    });

    for (const p of preciseProducts) {
        let newName = `KODAK PRECISE - ${p.name.replace('PRECISE ', '')}`;
        newName = newName.replace(/ \(.*?\)/g, '');
        newName = newName.replace(/  +/g, ' ');

        console.log(`Renaming: ${p.name} -> ${newName}`);
        await prod.product.update({
            where: { id: p.id },
            data: {
                name: newName,
                laboratory: "OPTOVISION",
                type: "Cristal Multifocal"
            }
        });
    }

    console.log("Process complete.");
    await prod.$disconnect();
}

main().catch(console.error);
