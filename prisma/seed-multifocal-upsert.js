// Seed: Upsert Multifocal Crystals — Varilux, Smart, Sygnus, Kodak
const { PrismaClient } = require('../prisma/generated/client');
const prisma = new PrismaClient();

// Lab auto-assignment by brand
const labMap = {
    'Varilux': 'OPTOVISION',
    'Smart': 'GRUPO OPTICO',
    'Sygnus': 'OPTOVISION',
    'Kodak': 'OPTOVISION',
};

const crystals = [
    // ===== VARILUX MI PRIMER VARILUX =====
    { brand: 'Varilux', name: 'COMFORT MAX - ORMA MI PRIMER VARILUX', lensIndex: '1.5', price: 567732, cost: 391000 },
    { brand: 'Varilux', name: 'COMFORT MAX - AIRWEAR 1.59 MI PRIMER VARILUX', lensIndex: '1.59', price: 624360, cost: 430000 },
    { brand: 'Varilux', name: 'COMFORT MAX - STYLIS 1.67 MI PRIMER VARILUX', lensIndex: '1.67', price: 656304, cost: 452000 },
    { brand: 'Varilux', name: 'COMFORT MAX - ORMA TRANSITIONS GEN S (Fotocrom) MI PRIMER VARILUX', lensIndex: 'Foto', price: 836352, cost: 576000 },

    // ===== SMART FREE =====
    { brand: 'Smart', name: 'SMART FREE - Orgánico Blue Light con Ar Essential', lensIndex: '1.56', price: 646250, cost: 175000 },
    { brand: 'Smart', name: 'SMART FREE - Orgánico Blue Light con Ar Essential Fotocromático Gris', lensIndex: '1.56', price: 1058145, cost: 228000 },
    { brand: 'Smart', name: 'SMART FREE - Policarbonato Blue Light con Ar Essential', lensIndex: '1.56', price: 981612.50, cost: 205000 },
    { brand: 'Smart', name: 'SMART FREE - Stylis BLUE LIGHT', lensIndex: '1.67', price: 998250, cost: 210000 },
    { brand: 'Smart', name: 'SMART FREE - Stylis Fotocromático', lensIndex: '1.67', price: 1157970, cost: 258000 },
    { brand: 'Smart', name: 'SMART FREE - Stylis Blanco', lensIndex: '1.74', price: 1287742.50, cost: 297000 },

    // ===== SYGNUS - ESSILOR NEW EDITIONS =====
    { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Orma 1.50 BLUE UV + AR Numax', lensIndex: '1.5', price: 1079289.75, cost: 164850 },
    { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Orma Transitions GEN S 1.50 + AR Numax (Fotocromático 8 colores)', lensIndex: '1.5', price: 1697388, cost: 310800 },
    { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Orma Acclimates 1.50 + AR Numax (Fotocromático Gris)', lensIndex: '1.5', price: 1332754.50, cost: 224700 },
    { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Orma Xperio 1.50 + AR Numax (Sol Gris / Café / Gris-Verde)', lensIndex: '1.5', price: 1697388, cost: 310800 },
    { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Airwear 1.59 + AR Numax', lensIndex: '1.59', price: 1168224.75, cost: 185850 },
    { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Airwear 1.59 BLUE UV + AR Numax', lensIndex: '1.59', price: 1215049.03, cost: 196906.50 },
    { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Airwear 1.59 Transitions GEN S + AR Numax (Fotocromáticos 8)', lensIndex: '1.59', price: 1897202.71, cost: 357981.75 },
    { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Airwear 1.59 Xperio Café / Gris + AR Numax', lensIndex: '1.59', price: 1897202.71, cost: 357981.75 },
    { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Stylis 1.67 + AR Numax', lensIndex: '1.67', price: 1473249.57, cost: 257874.75 },
    { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Stylis 1.67 BLUE UV + AR Numax', lensIndex: '1.67', price: 1540951.34, cost: 273861 },
    { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Stylis 1.67 Transitions GEN S + AR Numax (Fotocromáticos 8)', lensIndex: '1.67', price: 2159138.52, cost: 419832 },
    { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Orgánico Espejado (Azul / Plata) + AR Numax', lensIndex: '1.5', price: 1185166.87, cost: 189850.50 },
    { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Policarbonato Polarizado Espejado (Azul / Plata) + AR Numax', lensIndex: '1.59', price: 1363992.92, cost: 232076.25 },
    { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Orgánico Fotosensible BLC + AR Numax', lensIndex: '1.56', price: 1274346.44, cost: 210908.25 },
    { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Alto Índice 1.74 + AR Numax', lensIndex: '1.74', price: 1630597.82, cost: 295029 },

    // ===== KODAK UNIQUE DRO =====
    { brand: 'Kodak', name: 'UNIQUE DRO ORMA BLUE UV', lensIndex: '1.5', price: 1148853.48, cost: 255260.25 },
    { brand: 'Kodak', name: 'UNIQUE DRO AIRWEAR 1.59', lensIndex: '1.59', price: 1114648.45, cost: 244980.75 },
    { brand: 'Kodak', name: 'UNIQUE DRO AIRWEAR 1.59 BLUE UV', lensIndex: '1.59', price: 1148853.48, cost: 255260.25 },
    { brand: 'Kodak', name: 'UNIQUE DRO STYLIS 1.67', lensIndex: '1.67', price: 1306322.43, cost: 302583.75 },
    { brand: 'Kodak', name: 'UNIQUE DRO STYLIS 1.67 BLUE UV', lensIndex: '1.67', price: 1336387.22, cost: 311619 },
    { brand: 'Kodak', name: 'UNIQUE DRO ORMA ACCLIMATES (Fotocromático Gris)', lensIndex: '1.5', price: 1393040.41, cost: 328644.75 },
    { brand: 'Kodak', name: 'UNIQUE DRO ORMA TRANSITIONS GEN S (Fotocromático 8 Tonos)', lensIndex: '1.5', price: 1699680.35, cost: 420798 },
    { brand: 'Kodak', name: 'UNIQUE DRO AIRWEAR 1.59 TRANSITIONS GEN S (Fotocromático Gris, Sepia)', lensIndex: '1.59', price: 1814751.12, cost: 455379.75 },
    { brand: 'Kodak', name: 'UNIQUE DRO STYLIS 1.67 TRANSITIONS GEN S (Fotocromático Gris, Sepia)', lensIndex: '1.67', price: 1877448.71, cost: 474222 },
    { brand: 'Kodak', name: 'UNIQUE DRO ORMA XPERIO', lensIndex: '1.5', price: 1699680.35, cost: 420798 },
    { brand: 'Kodak', name: 'UNIQUE DRO AIRWEAR 1.59 XPERIO', lensIndex: '1.59', price: 1814751.12, cost: 455379.75 },

    // ===== KODAK PRECISE =====
    { brand: 'Kodak', name: 'PRECISE ORMA BLUE UV', lensIndex: '1.5', price: 1072337.62, cost: 232265.25 },
    { brand: 'Kodak', name: 'PRECISE AIRWEAR 1.59', lensIndex: '1.59', price: 1041591.52, cost: 223025.25 },
    { brand: 'Kodak', name: 'PRECISE AIRWEAR 1.59 BLUE UV', lensIndex: '1.59', price: 1072337.62, cost: 232265.25 },
    { brand: 'Kodak', name: 'PRECISE STYLIS 1.67', lensIndex: '1.67', price: 1227535.55, cost: 278906.25 },
    { brand: 'Kodak', name: 'PRECISE STYLIS 1.67 BLUE UV', lensIndex: '1.67', price: 1263539.93, cost: 289726.50 },
    { brand: 'Kodak', name: 'PRECISE ORMA ACCLIMATES (Fotocromático Gris)', lensIndex: '1.5', price: 1306322.43, cost: 302583.75 },
    { brand: 'Kodak', name: 'PRECISE ORMA TRANSITIONS GEN S (Fotocromáticos 8)', lensIndex: '1.5', price: 1618989.30, cost: 396548.25 },
    { brand: 'Kodak', name: 'PRECISE AIRWEAR 1.59 TRANSITIONS GEN S (Fotocromáticos 2)', lensIndex: '1.59', price: 1732068.57, cost: 430531.50 },
    { brand: 'Kodak', name: 'PRECISE STYLIS 1.67 TRANSITIONS GEN S (Fotocromáticos 2)', lensIndex: '1.67', price: 1800600.92, cost: 451127.25 },
    { brand: 'Kodak', name: 'PRECISE ORMA XPERIO', lensIndex: '1.5', price: 1618989.30, cost: 396548.25 },
    { brand: 'Kodak', name: 'PRECISE AIRWEAR 1.59 XPERIO', lensIndex: '1.59', price: 1732068.57, cost: 430531.50 },

    // ===== VARILUX COMFORT MAX + CRIZAL =====
    { brand: 'Varilux', name: 'COMFORT MAX - ORMA + CRIZAL', lensIndex: '1.5', price: 1455403.13, cost: 391125 },
    { brand: 'Varilux', name: 'COMFORT MAX - AIRWEAR 1.59 + CRIZAL', lensIndex: '1.59', price: 1574607.79, cost: 430531.50 },
    { brand: 'Varilux', name: 'COMFORT MAX - STYLIS 1.67 + CRIZAL', lensIndex: '1.67', price: 1642452.49, cost: 452959.50 },
    { brand: 'Varilux', name: 'COMFORT MAX - ORMA TRANSITIONS GEN S + CRIZAL (Fotocromáticos 8)', lensIndex: '1.59', price: 2014788.39, cost: 576045.75 },
    { brand: 'Varilux', name: 'COMFORT MAX - ORMA TRANSITIONS XTRACTIVE + CRIZAL (Fotocromático Gris)', lensIndex: '1.59', price: 2014788.39, cost: 576045.75 },
    { brand: 'Varilux', name: 'COMFORT MAX - AIRWEAR 1.59 TRANSITIONS GEN S + CRIZAL (Fotocromáticos 2)', lensIndex: '1.59', price: 2134199.51, cost: 615520.50 },
    { brand: 'Varilux', name: 'COMFORT MAX - STYLIS 1.67 TRANSITIONS GEN S + CRIZAL (Fotocromáticos 2)', lensIndex: '1.67', price: 2203854.68, cost: 638547 },
    { brand: 'Varilux', name: 'COMFORT MAX - ORMA XPERIO + CRIZAL (Sol)', lensIndex: '1.59', price: 2014788.39, cost: 576045.75 },
    { brand: 'Varilux', name: 'COMFORT MAX - AIRWEAR 1.59 XPERIO + CRIZAL', lensIndex: '1.59', price: 2134199.51, cost: 615520.50 },

    // ===== VARILUX PHYSIO 3.0 + CRIZAL =====
    { brand: 'Varilux', name: 'PHYSIO 3.0 - ORMA + CRIZAL', lensIndex: '1.5', price: 1723176.88, cost: 479645.25 },
    { brand: 'Varilux', name: 'PHYSIO 3.0 - AIRWEAR 1.59 + CRIZAL', lensIndex: '1.59', price: 1836838.99, cost: 517219.50 },
    { brand: 'Varilux', name: 'PHYSIO 3.0 - STYLIS 1.67 + CRIZAL', lensIndex: '1.67', price: 1902936.75, cost: 539070 },
    { brand: 'Varilux', name: 'PHYSIO 3.0 - ORMA TRANSITIONS GEN S + CRIZAL (Fotocromáticos 8)', lensIndex: '1.5', price: 2280942.26, cost: 664030.50 },
    { brand: 'Varilux', name: 'PHYSIO 3.0 - ORMA TRANSITIONS XTRACTIVE + CRIZAL (Fotocromático Gris)', lensIndex: '1.5', price: 2280942.26, cost: 664030.50 },
    { brand: 'Varilux', name: 'PHYSIO 3.0 - AIRWEAR 1.59 TRANSITIONS GEN S + CRIZAL (Fotocromáticos 2)', lensIndex: '1.59', price: 2394397.91, cost: 701536.50 },
    { brand: 'Varilux', name: 'PHYSIO 3.0 - STYLIS 1.67 TRANSITIONS GEN S + CRIZAL (Fotocromáticos 2)', lensIndex: '1.67', price: 2471580.79, cost: 727051.50 },
    { brand: 'Varilux', name: 'PHYSIO 3.0 - ORMA XPERIO + CRIZAL', lensIndex: '1.5', price: 2280942.26, cost: 664030.50 },
    { brand: 'Varilux', name: 'PHYSIO 3.0 - AIRWEAR 1.59 XPERIO + CRIZAL', lensIndex: '1.59', price: 2394397.91, cost: 701536.50 },

    // ===== VARILUX XR DESIGN + CRIZAL =====
    { brand: 'Varilux', name: 'XR DESIGN - ORMA + CRIZAL', lensIndex: '1.5', price: 1830899.40, cost: 515256 },
    { brand: 'Varilux', name: 'XR DESIGN - AIRWEAR 1.59 + CRIZAL', lensIndex: '1.59', price: 1948198.31, cost: 554032.50 },
    { brand: 'Varilux', name: 'XR DESIGN - STYLIS 1.67 + CRIZAL', lensIndex: '1.67', price: 2023777.18, cost: 579017.25 },
    { brand: 'Varilux', name: 'XR DESIGN - ORMA TRANSITIONS GEN S + CRIZAL (Fotocromáticos 8)', lensIndex: '1.5', price: 2412677.23, cost: 707579.25 },
    { brand: 'Varilux', name: 'XR DESIGN - AIRWEAR 1.59 TRANSITIONS GEN S + CRIZAL (Fotocromáticos 8)', lensIndex: '1.5', price: 2537853.24, cost: 748959.75 },
    { brand: 'Varilux', name: 'XR DESIGN - STYLIS 1.67 TRANSITIONS GEN S + CRIZAL (Fotocromáticos 8)', lensIndex: '1.67', price: 2598090.83, cost: 768873 },
    { brand: 'Varilux', name: 'XR DESIGN - ORMA XPERIO + CRIZAL', lensIndex: '1.5', price: 2412677.23, cost: 707579.25 },
    { brand: 'Varilux', name: 'XR DESIGN - AIRWEAR 1.59 XPERIO + CRIZAL', lensIndex: '1.59', price: 2537853.24, cost: 748959.75 },
];

async function seed() {
    console.log(`\n🔬 Upsert de ${crystals.length} cristales multifocales...\n`);
    let created = 0, updated = 0, errors = 0;

    for (const c of crystals) {
        const lab = labMap[c.brand] || null;
        try {
            // Try to find existing by brand + name
            const existing = await prisma.product.findFirst({
                where: { brand: c.brand, name: c.name, category: 'Cristal' }
            });

            if (existing) {
                await prisma.product.update({
                    where: { id: existing.id },
                    data: {
                        lensIndex: c.lensIndex,
                        price: c.price,
                        cost: c.cost,
                        laboratory: lab,
                        unitType: 'PAR',
                        type: 'Cristal Multifocal',
                    }
                });
                updated++;
                console.log(`  🔄 ${c.brand} | ${c.name.substring(0, 55)} | $${c.price.toLocaleString()}`);
            } else {
                await prisma.product.create({
                    data: {
                        name: c.name,
                        brand: c.brand,
                        category: 'Cristal',
                        type: 'Cristal Multifocal',
                        lensIndex: c.lensIndex,
                        unitType: 'PAR',
                        laboratory: lab,
                        price: c.price,
                        cost: c.cost,
                        stock: 0,
                    }
                });
                created++;
                console.log(`  ✅ ${c.brand} | ${c.name.substring(0, 55)} | $${c.price.toLocaleString()}`);
            }
        } catch (e) {
            errors++;
            console.log(`  ❌ ${c.brand} | ${c.name.substring(0, 40)}: ${e.message?.slice(0, 80)}`);
        }
    }

    console.log(`\n✨ Creados: ${created} | Actualizados: ${updated} | Errores: ${errors} | Total: ${crystals.length}`);
    await prisma.$disconnect();
}

seed().catch(e => { console.error(e); process.exit(1); });
