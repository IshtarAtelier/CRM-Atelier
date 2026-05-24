const { PrismaClient } = require('@prisma/client');
const PROD_URL = "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway";

async function main() {
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    await prod.$connect();
    
    // Fetch all products that might be related to these lines
    const products = await prod.product.findMany({
        where: {
            OR: [
                { name: { contains: 'varilux', mode: 'insensitive' } },
                { name: { contains: 'comfort', mode: 'insensitive' } },
                { name: { contains: 'physio', mode: 'insensitive' } },
                { name: { contains: 'xr design', mode: 'insensitive' } }
            ]
        },
        orderBy: {
            name: 'asc'
        }
    });

    console.log(`=== AUDITORÍA GENERAL DE PRODUCTOS VARILUX ===`);
    console.log(`Total encontrados: ${products.length}\n`);

    const nameCount = {};
    const rogueItems = [];
    const standardItems = [];
    const miPrimerVariluxItems = [];

    // The exact standardized names we created/updated
    const expectedNames = [
        // XR DESIGN (8)
        "XR DESIGN - AIRWEAR 1.59 + CRIZAL 2x1",
        "XR DESIGN - AIRWEAR 1.59 TRANSITIONS GEN S  + CRIZAL  (fotocromaticos 8) 2x1",
        "XR DESIGN - AIRWEAR 1.59 XPERIO  + CRIZAL  2x1",
        "XR DESIGN -  ORMA   + CRIZAL  2x1",
        "XR DESIGN - ORMA TRANSITIONS GEN S  + CRIZAL Prevencia   (fotocromaticos 8)  2x1",
        "XR DESIGN - ORMA XPERIO  + CRIZAL  2x1",
        "XR DESIGN - STYLIS 1.67  + CRIZAL  2x1",
        "XR DESIGN - STYLIS 1.67 TRANSITIONS GEN S  + CRIZAL  (fotocromaticos 8)  2x1",
        // PHYSIO 3.0 (9)
        "PHYSIO 3.0 - AIRWEAR 1.59 + CRIZAL 2x1",
        "PHYSIO 3.0 - AIRWEAR 1.59 TRANSITIONS GEN S + CRIZAL (fotocromaticos 2) 2x1",
        "PHYSIO 3.0 - AIRWEAR 1.59 XPERIO + CRIZAL 2x1",
        "PHYSIO 3.0 - ORMA + CRIZAL 2x1",
        "PHYSIO 3.0 - ORMA TRANSITIONS GEN S + CRIZAL (fotocromaticos 8) 2x1",
        "PHYSIO 3.0 - ORMA TRANSITIONS XTRACTIVE + CRIZAL (fotocromatico Gris) 2x1",
        "PHYSIO 3.0 - ORMA XPERIO + CRIZAL 2x1",
        "PHYSIO 3.0 - STYLIS 1.67 + CRIZAL 2x1",
        "PHYSIO 3.0 - STYLIS 1.67 TRANSITIONS GEN S + CRIZAL (fotocromaticos 2) 2x1",
        // COMFORT MAX (9)
        "COMFORT MAX - AIRWEAR 1.59  + CRIZAL  2x1",
        "COMFORT MAX - AIRWEAR 1.59 TRANSITIONS GEN S+CRIZAL (fotocromaticos 2)  2x1",
        "COMFORT MAX - AIRWEAR 1.59 XPERIO  + CRIZAL  2x1",
        "COMFORT MAX - ORMA  + CRIZAL  2x1",
        "COMFORT MAX - ORMA TRANSITIONS GEN S  + CRIZAL (fotocromaticos 8)  2x1",
        "COMFORT MAX - ORMA TRANSITIONS XTRACTIVE  + CRIZAL(fotocromatico Gris)  2x1",
        "COMFORT MAX - STYLIS 1.67  + CRIZAL 2x1",
        "COMFORT MAX - STYLIS 1.67 TRANSITIONS GEN S+CRIZAL (fotocromaticos 2)  2x1",
        "COMFORT MAX - ORMA XPERIO + CRIZAL 2x1",
        // COMFORT (9)
        "COMFORT - ORMA + CRIZAL 2x1",
        "COMFORT - AIRWEAR 1.59 + CRIZAL 2x1",
        "COMFORT - STYLIS 1.67 + CRIZAL 2x1",
        "COMFORT - ORMA TRANSITIONS GEN S + CRIZAL 2x1",
        "COMFORT - ORMA TRANSITIONS XTRACTIVE + CRIZAL 2x1",
        "COMFORT - AIRWEAR 1.59 TRANSITIONS GEN S + CRIZAL 2x1",
        "COMFORT - STYLIS 1.67 TRANSITIONS GEN S + CRIZAL 2x1",
        "COMFORT - ORMA XPERIO + CRIZAL 2x1",
        "COMFORT - AIRWEAR 1.59 XPERIO + CRIZAL 2x1",
        // PHYSIO (9)
        "PHYSIO - ORMA + CRIZAL 2x1",
        "PHYSIO - AIRWEAR 1.59 + CRIZAL 2x1",
        "PHYSIO - STYLIS 1.67 + CRIZAL 2x1",
        "PHYSIO - ORMA TRANSITIONS GEN S + CRIZAL 2x1",
        "PHYSIO - ORMA TRANSITIONS XTRACTIVE + CRIZAL 2x1",
        "PHYSIO - AIRWEAR 1.59 TRANSITIONS GEN S + CRIZAL 2x1",
        "PHYSIO - STYLIS 1.67 TRANSITIONS GEN S + CRIZAL 2x1",
        "PHYSIO - ORMA XPERIO + CRIZAL 2x1",
        "PHYSIO - AIRWEAR 1.59 XPERIO + CRIZAL 2x1"
    ];

    function normalizeString(str) {
        return str.replace(/\s+/g, ' ').trim().toUpperCase();
    }

    const normExpected = expectedNames.map(normalizeString);

    products.forEach(p => {
        const normName = normalizeString(p.name);
        
        // Count for duplicates
        nameCount[normName] = (nameCount[normName] || 0) + 1;

        if (normName.includes("MI PRIMER VARILUX")) {
            miPrimerVariluxItems.push(p.name);
        } else if (normExpected.includes(normName)) {
            standardItems.push(p.name);
        } else {
            rogueItems.push(p.name);
        }
    });

    // Report duplicates
    const duplicates = Object.entries(nameCount).filter(([_, count]) => count > 1);
    console.log("--- 1. DUPLICADOS ---");
    if (duplicates.length === 0) {
        console.log("✓ No se encontraron nombres duplicados en ninguna familia.");
    } else {
        duplicates.forEach(([name, count]) => {
            console.log(`❌ DUPLICADO (${count}x): ${name}`);
        });
    }

    // Report Rogue items
    console.log("\n--- 2. ÍTEMS FUERA DE LO ESTANDARIZADO ---");
    if (rogueItems.length === 0) {
        console.log("✓ Todos los productos pertenecen a la estandarización exacta (sin basura).");
    } else {
        console.log(`❌ Se encontraron ${rogueItems.length} ítems "basura" o mal escritos:`);
        rogueItems.forEach(n => console.log(`   - ${n}`));
    }

    console.log("\n--- 3. RESUMEN ---");
    console.log(`Ítems Estandarizados (XR, Physio, Comfort): ${standardItems.length} (Deberían ser 44)`);
    console.log(`Ítems 'Mi Primer Varilux': ${miPrimerVariluxItems.length}`);
    
    await prod.$disconnect();
}

main().catch(console.error);
