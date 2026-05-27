require("dotenv").config();
const { PrismaClient } = require('@prisma/client');
const PROD_URL = process.env.PROD_DATABASE_URL;

const updates = [
  {
    nameMatch: "XR DESIGN - AIRWEAR 1.59 + CRIZAL 2x1",
    cost: 815104,
    price: 1956251,
    lensIndex: "1.59"
  },
  {
    nameMatch: "XR DESIGN - AIRWEAR 1.59 TRANSITIONS GEN S  + CRIZAL  (fotocromaticos 8) 2x1",
    cost: 1069840,
    price: 2567615,
    lensIndex: "1.59"
  },
  {
    nameMatch: "XR DESIGN - AIRWEAR 1.59 XPERIO  + CRIZAL  2x1",
    cost: 1069840,
    price: 2567615,
    lensIndex: "1.59"
  },
  {
    nameMatch: "XR DESIGN -  ORMA   + CRIZAL  2x1",
    cost: 764436,
    price: 1834646,
    lensIndex: "1.50"
  },
  {
    nameMatch: "XR DESIGN - ORMA TRANSITIONS GEN S  + CRIZAL Prevencia   (fotocromaticos 8)  2x1",
    cost: 1015765,
    price: 2437835,
    lensIndex: "1.50"
  },
  {
    nameMatch: "XR DESIGN - ORMA XPERIO  + CRIZAL  2x1",
    cost: 1015765,
    price: 2437835,
    lensIndex: "1.50"
  },
  {
    nameMatch: "XR DESIGN - STYLIS 1.67  + CRIZAL  2x1",
    cost: 847756,
    price: 2034615,
    lensIndex: "1.67"
  },
  {
    nameMatch: "XR DESIGN - STYLIS 1.67 TRANSITIONS GEN S  + CRIZAL  (fotocromaticos 8)  2x1",
    cost: 1095867,
    price: 2630081,
    lensIndex: "1.67"
  }
];

// Helper to normalize strings for comparison (removes extra spaces)
function normalizeString(str) {
    return str.replace(/\s+/g, ' ').trim().toUpperCase();
}

async function main() {
    console.log("Connecting to Production Database...");
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    await prod.$connect();
    
    console.log("Fetching existing XR Design products...");
    const existingProducts = await prod.product.findMany({
        where: {
            name: {
                contains: 'xr design',
                mode: 'insensitive'
            }
        }
    });

    console.log(`Found ${existingProducts.length} XR Design products in DB.`);

    // Group by normalized name to find duplicates
    const grouped = {};
    for (const p of existingProducts) {
        const normName = normalizeString(p.name);
        if (!grouped[normName]) grouped[normName] = [];
        grouped[normName].push(p);
    }

    // Process duplicates and prepare updates
    for (const normName in grouped) {
        const items = grouped[normName];
        
        // Find the matching update data
        const updateData = updates.find(u => normalizeString(u.nameMatch) === normName);
        
        if (!updateData) {
            console.log(`Warning: Found product in DB not in our update list: ${normName}`);
            // Still enforce OPTOVISION and 2x1 if they are Varilux XR
            for (const item of items) {
                await prod.product.update({
                    where: { id: item.id },
                    data: {
                        laboratory: 'OPTOVISION',
                        is2x1: true
                    }
                });
            }
            continue;
        }

        // If duplicates exist, keep the first one, delete the rest
        const itemToKeep = items[0];
        if (items.length > 1) {
            console.log(`Found duplicates for ${normName}. Deleting ${items.length - 1} duplicates...`);
            for (let i = 1; i < items.length; i++) {
                await prod.product.delete({ where: { id: items[i].id } });
                console.log(`  Deleted duplicate ID: ${items[i].id}`);
            }
        }

        // Update the remaining item
        console.log(`Updating ${normName}...`);
        await prod.product.update({
            where: { id: itemToKeep.id },
            data: {
                cost: updateData.cost,
                price: updateData.price,
                lensIndex: updateData.lensIndex,
                is2x1: true,
                laboratory: 'OPTOVISION'
            }
        });
        console.log(`  -> Cost: ${updateData.cost}, Price: ${updateData.price}, Index: ${updateData.lensIndex}`);
    }

    // Check if any from our update list were completely missing
    for (const u of updates) {
        const normU = normalizeString(u.nameMatch);
        if (!grouped[normU]) {
            console.log(`Warning: Product missing from DB: ${u.nameMatch}`);
        }
    }

    console.log("Update process complete.");
    await prod.$disconnect();
}

main().catch(console.error);
