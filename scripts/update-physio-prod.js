require("dotenv").config();
const { PrismaClient } = require('@prisma/client');
const PROD_URL = process.env.PROD_DATABASE_URL;

// Normalize name by removing "2x1" and extra spaces to find duplicates
function getBaseName(str) {
    return str.replace(/2x1/ig, '').replace(/\s+/g, ' ').trim().toUpperCase();
}

// Extract index from name
function getIndex(name) {
    if (name.includes('1.59') || name.toUpperCase().includes('AIRWEAR')) return '1.59';
    if (name.includes('1.67') || name.toUpperCase().includes('STYLIS')) return '1.67';
    if (name.includes('1.50') || name.toUpperCase().includes('ORMA')) return '1.50';
    return null;
}

async function main() {
    console.log("Connecting to Production Database...");
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    await prod.$connect();
    
    console.log("Fetching existing PHYSIO products...");
    const existingProducts = await prod.product.findMany({
        where: {
            name: {
                contains: 'physio',
                mode: 'insensitive'
            }
        },
        orderBy: {
            name: 'asc'
        }
    });

    console.log(`Found ${existingProducts.length} PHYSIO products in DB.`);

    // Group by base name
    const grouped = {};
    for (const p of existingProducts) {
        const baseName = getBaseName(p.name);
        if (!grouped[baseName]) grouped[baseName] = [];
        grouped[baseName].push(p);
    }

    for (const baseName in grouped) {
        const items = grouped[baseName];
        
        // Find if one of them already has "2x1" in the name to keep that specific name
        // Otherwise, append " 2x1" to the base name
        let itemToKeep = items.find(i => i.name.toUpperCase().includes('2X1')) || items[0];
        
        // Ensure name has "2x1"
        let newName = itemToKeep.name;
        if (!newName.toUpperCase().includes('2X1')) {
            newName = `${newName} 2x1`;
        }
        newName = newName.replace(/\s+/g, ' ').trim(); // clean spaces

        const newIndex = getIndex(newName);

        // Delete duplicates
        if (items.length > 1) {
            console.log(`Found duplicates for ${baseName}. Deleting ${items.length - 1} duplicates...`);
            for (const item of items) {
                if (item.id !== itemToKeep.id) {
                    await prod.product.delete({ where: { id: item.id } });
                    console.log(`  Deleted duplicate ID: ${item.id} (${item.name})`);
                }
            }
        }

        // Update the remaining item
        console.log(`Updating ${itemToKeep.name} -> ${newName}`);
        await prod.product.update({
            where: { id: itemToKeep.id },
            data: {
                name: newName,
                is2x1: true,
                laboratory: 'GRUPO OPTICO',
                lensIndex: newIndex
            }
        });
        console.log(`  -> Lab: GRUPO OPTICO, is2x1: true, Index: ${newIndex}`);
    }

    console.log("Update process complete.");
    await prod.$disconnect();
}

main().catch(console.error);
