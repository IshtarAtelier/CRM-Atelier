import { PrismaClient } from './generated/client';

const prisma = new PrismaClient();

const cristales = [
    // ── Varilux ──
    { brand: 'Varilux', name: 'COMFORT MAX - ORMA MI PRIMER VARILUX', type: 'Multifocal', lensIndex: '1.50', price: 567732, cost: 391000 },
    { brand: 'Varilux', name: 'COMFORT MAX - AIRWEAR 1.59 MI PRIMER VARILUX', type: 'Multifocal', lensIndex: '1.59', price: 624360, cost: 430000 },
    { brand: 'Varilux', name: 'COMFORT MAX - STYLIS 1.67 MI PRIMER VARILUX', type: 'Multifocal', lensIndex: '1.67', price: 656304, cost: 452000 },
    { brand: 'Varilux', name: 'COMFORT MAX - ORMA TRANSITIONS GEN S (Fotocrom) MI PRIMER VARILUX', type: 'Multifocal', lensIndex: 'Foto', price: 836352, cost: 576000 },

    // ── Smart ──
    { brand: 'Smart', name: 'SMART FREE - Orgánico Blue Light con Ar Essential', type: 'Multifocal', lensIndex: '1.56', price: 646250, cost: 175000 },
    { brand: 'Smart', name: 'SMART FREE - Orgánico Blue Light con Ar Essential Fotocromático Gris', type: 'Multifocal', lensIndex: '1.56', price: 1058145, cost: 228000 },
    { brand: 'Smart', name: 'SMART FREE - Policarbonato Blue Light con Ar Essential', type: 'Multifocal', lensIndex: '1.56', price: 981612, cost: 205000 },
    { brand: 'Smart', name: 'SMART FREE - Stylis BLUE LIGHT', type: 'Multifocal', lensIndex: '1.67', price: 998250, cost: 210000 },
    { brand: 'Smart', name: 'SMART FREE - Stylis Fotocromático', type: 'Multifocal', lensIndex: '1.67', price: 1157970, cost: 258000 },
    { brand: 'Smart', name: 'SMART FREE - Stylis Blanco', type: 'Multifocal', lensIndex: '1.74', price: 1287742, cost: 297000 },

    // ── Sygnus (Essilor New Editions) ──
    { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Orma 1.50 BLUE UV + AR Numax', type: 'Multifocal', lensIndex: '1.50', price: 1079289, cost: 164850 },
    { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Orma Transitions GEN S 1.50 + AR Numax (Fotocromático 8 colores)', type: 'Multifocal', lensIndex: '1.50', price: 1697388, cost: 310800 },
    { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Orma Acclimates 1.50 + AR Numax (Fotocromático Gris)', type: 'Multifocal', lensIndex: '1.50', price: 1332754, cost: 224700 },
    { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Orma Xperio 1.50 + AR Numax (Sol Gris / Café / Gris-Verde)', type: 'Multifocal', lensIndex: '1.50', price: 1697388, cost: 310800 },
    { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Airwear 1.59 + AR Numax', type: 'Multifocal', lensIndex: '1.59', price: 1168224, cost: 185850 },
    { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Airwear 1.59 BLUE UV + AR Numax', type: 'Multifocal', lensIndex: '1.59', price: 1215049, cost: 196906 },
    { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Airwear 1.59 Transitions GEN S + AR Numax (Fotocromáticos 8)', type: 'Multifocal', lensIndex: '1.59', price: 1897202, cost: 357981 },
    { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Airwear 1.59 Xperio Café / Gris + AR Numax', type: 'Multifocal', lensIndex: '1.59', price: 1897202, cost: 357981 },
    { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Stylis 1.67 + AR Numax', type: 'Multifocal', lensIndex: '1.67', price: 1473249, cost: 257874 },
    { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Stylis 1.67 BLUE UV + AR Numax', type: 'Multifocal', lensIndex: '1.67', price: 1540951, cost: 273861 },
    { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Stylis 1.67 Transitions GEN S + AR Numax (Fotocromáticos 8)', type: 'Multifocal', lensIndex: '1.67', price: 2159138, cost: 419832 },
    { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Orgánico Espejado (Azul / Plata) + AR Numax', type: 'Multifocal', lensIndex: '1.50', price: 1185166, cost: 189850 },
    { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Policarbonato Polarizado Espejado (Azul / Plata) + AR Numax', type: 'Multifocal', lensIndex: '1.59', price: 1363992, cost: 232076 },
    { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Orgánico Fotosensible BLC + AR Numax', type: 'Multifocal', lensIndex: '1.56', price: 1274346, cost: 210908 },
    { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Alto Índice 1.74 + AR Numax', type: 'Multifocal', lensIndex: '1.74', price: 1630597, cost: 295029 },

    // ── Kodak ──
    { brand: 'Kodak', name: 'UNIQUE DRO ORMA BLUE UV', type: 'Multifocal', lensIndex: '1.50', price: 1148853, cost: 255260 },
    { brand: 'Kodak', name: 'UNIQUE DRO AIRWEAR 1.59', type: 'Multifocal', lensIndex: '1.59', price: 1114648, cost: 244980 },
    { brand: 'Kodak', name: 'UNIQUE DRO AIRWEAR 1.59 BLUE UV', type: 'Multifocal', lensIndex: '1.59', price: 1148853, cost: 255260 },
    { brand: 'Kodak', name: 'UNIQUE DRO STYLIS 1.67', type: 'Multifocal', lensIndex: '1.67', price: 1306322, cost: 302583 },
    { brand: 'Kodak', name: 'UNIQUE DRO STYLIS 1.67 BLUE UV', type: 'Multifocal', lensIndex: '1.67', price: 1336387, cost: 311619 },
    { brand: 'Kodak', name: 'UNIQUE DRO ORMA ACCLIMATES (Fotocromático Gris)', type: 'Multifocal', lensIndex: '1.50', price: 1393040, cost: 328644 },
];

async function main() {
    console.log(`\n🔬 Cargando ${cristales.length} cristales multifocales...\n`);

    let created = 0;
    for (const c of cristales) {
        try {
            await prisma.product.create({
                data: {
                    brand: c.brand,
                    name: c.name,
                    model: c.name,
                    category: 'Cristal',
                    type: `Cristal ${c.type}`,
                    lensIndex: c.lensIndex,
                    price: c.price,
                    cost: c.cost,
                    stock: 999999,
                    unitType: 'PAR',
                },
            });
            created++;
            console.log(`  ✅ ${c.brand} — ${c.name} ($${c.price.toLocaleString()})`);
        } catch (err: any) {
            console.error(`  ❌ ${c.brand} — ${c.name}: ${err.message}`);
        }
    }

    console.log(`\n✅ Cargados ${created}/${cristales.length} cristales.\n`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
