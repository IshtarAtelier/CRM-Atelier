const { PrismaClient } = require('./prisma/generated/client');
const p = new PrismaClient();

async function main() {
    const products = [
        // Monofocal — Smart (Lab: GRUPO OPTICO)
        { brand: 'Smart', name: 'Org\u00e1nico Blanco Hasta Diam 70', lensIndex: '1.49', cost: 18937, price: 139779, laboratory: 'GRUPO OPTICO' },
        { brand: 'Smart', name: 'Org\u00e1nico Blue Antirreflejo (Stock)', lensIndex: '1.56', cost: 6138, price: 68463, laboratory: 'GRUPO OPTICO' },
        { brand: 'Smart', name: 'Org\u00e1nico Blue Antirreflejo (Rango Extendido)', lensIndex: '1.56', cost: 12200, price: 105725, laboratory: 'GRUPO OPTICO' },
        { brand: 'Smart', name: 'Org\u00e1nico Fotocrom\u00e1tico Antirreflejo Gris', lensIndex: '1.56', cost: 16673, price: 126559, laboratory: 'GRUPO OPTICO' },
        { brand: 'Smart', name: 'Policarbonato Antirreflejo', lensIndex: '1.59', cost: 13610, price: 108672, laboratory: 'GRUPO OPTICO' },
        { brand: 'Smart', name: 'Policarbonato Blanco', lensIndex: '1.59', cost: 11666, price: 97320, laboratory: 'GRUPO OPTICO' },
        { brand: 'Smart', name: 'Org\u00e1nico Super Blue Asf\u00e9rico Antirreflejo (Stock)', lensIndex: '1.60', cost: 18660, price: 145433, laboratory: 'GRUPO OPTICO' },
        { brand: 'Smart', name: 'Org\u00e1nico Super Blue Asf\u00e9rico Antirreflejo (Rango Extendido)', lensIndex: '1.60', cost: 20816, price: 158686, laboratory: 'GRUPO OPTICO' },

        // Monofocal — Sygnus (Lab: GRUPO OPTICO)
        { brand: 'Sygnus', name: 'Orma Transitions GEN S ESSILOR (fotocrom\u00e1tico)', lensIndex: '1.50', cost: 203000, price: 670001, laboratory: 'GRUPO OPTICO' },
        { brand: 'Sygnus', name: 'Orma Transitions GEN S / XTRActive ESSILOR (fotocrom\u00e1tico)', lensIndex: '1.50', cost: 203190, price: 670585, laboratory: 'GRUPO OPTICO' },
        { brand: 'Sygnus', name: 'Orma Acclimates / Fotosensible ESSILOR (fotocrom\u00e1tico)', lensIndex: '1.50', cost: 143986, price: 488628, laboratory: 'GRUPO OPTICO' },

        // Alto \u00cdndice — Sygnus (Lab: GRUPO OPTICO)
        { brand: 'Sygnus', name: 'HD MR7 Asf\u00e9rico SHMC UV420 Blue Policarbonato', lensIndex: '1.67', cost: 38850, price: 314455, laboratory: 'GRUPO OPTICO' },
        { brand: 'Sygnus', name: 'Stylis BLUE UV', lensIndex: '1.67', cost: 154019, price: 519463, laboratory: 'GRUPO OPTICO' },
        { brand: 'Sygnus', name: 'Stylis 1.67 Transitions GEN S', lensIndex: '1.67', cost: 342216, price: 1097868, laboratory: 'GRUPO OPTICO' },
        { brand: 'Sygnus', name: 'Transitions Gens 1.67 (fotocrom\u00e1tico) gris y marr\u00f3n', lensIndex: '1.67', cost: 366020, price: 1171027, laboratory: 'GRUPO OPTICO' },
        { brand: 'Sygnus', name: 'Transitions Gens 1.59 (fotocrom\u00e1tico) gris y marr\u00f3n', lensIndex: '1.59', cost: 235075, price: 768581, laboratory: 'GRUPO OPTICO' },

        // Alto \u00cdndice — Smart (Lab: GRUPO OPTICO / CNC)
        { brand: 'Smart', name: 'Org\u00e1nico Fotocrom\u00e1tico Gris', lensIndex: '1.67', cost: 105000, price: 516331, laboratory: 'GRUPO OPTICO' },
        { brand: 'Smart', name: 'Org\u00e1nico Blanco Alto \u00cdndice', lensIndex: '1.60', cost: 30575, price: 164004, laboratory: 'CNC' },
        { brand: 'Smart', name: 'Org\u00e1nico Super Blue Light', lensIndex: '1.60', cost: 78879, price: 386691, laboratory: 'CNC' },
        { brand: 'Smart', name: 'Org\u00e1nico Antirreflejo Blue Light', lensIndex: '1.60', cost: 78739, price: 386045, laboratory: 'CNC' },
        { brand: 'Smart', name: 'Org\u00e1nico Blue Light', lensIndex: '1.67', cost: 100150, price: 484752, laboratory: 'CNC' },

        // Miop\u00eda — Myofix (Lab: MIOPIA)
        { brand: 'Myofix', name: 'Org\u00e1nico Blue Light Smart Essential (grupo)', lensIndex: '1.56', cost: 139000, price: 553212, laboratory: 'MIOPIA' },
        { brand: 'Myofix', name: 'Org\u00e1nico Blue Light 1,67 (grupo)', lensIndex: '1.67', cost: 177000, price: 699199, laboratory: 'MIOPIA' },

        // Miop\u00eda — Mipylux (Lab: MIOPIA)
        { brand: 'Mipylux', name: 'AIRWEAR 1.59 Lite', lensIndex: '1.59', cost: 232000, price: 838231, laboratory: 'MIOPIA' },
        { brand: 'Mipylux', name: 'STYLIS 1.67', lensIndex: '1.67', cost: 278000, price: 838231, laboratory: 'MIOPIA' },

        // Especiales — Smart (sin Te\u00f1ido ni Sol neutro)
        { brand: 'Smart', name: 'Org\u00e1nico Te\u00f1ido muestra/compacto/degrad\u00e9', lensIndex: '1.49', cost: 14000, price: 58395, laboratory: 'GRUPO OPTICO' },
        { brand: 'Smart', name: 'Org\u00e1nico Blanco RE muestra/compacto/degrad\u00e9', lensIndex: '1.49', cost: 20000, price: 76835, laboratory: 'GRUPO OPTICO' },
    ];

    console.log('Loading ' + products.length + ' crystal products...\n');

    let created = 0;
    for (const prod of products) {
        const existing = await p.product.findFirst({
            where: { brand: prod.brand, name: prod.name, category: 'Cristal' }
        });
        if (existing) {
            console.log('SKIP (exists): ' + prod.brand + ' - ' + prod.name);
            continue;
        }

        await p.product.create({
            data: {
                category: 'Cristal',
                type: 'Cristal Monofocal',
                brand: prod.brand,
                name: prod.name,
                lensIndex: prod.lensIndex,
                cost: prod.cost,
                price: prod.price,
                unitType: 'PAR',
                stock: 0,
                laboratory: prod.laboratory,
            }
        });
        created++;
        console.log('OK: ' + prod.brand + ' | ' + prod.name + ' | idx:' + (prod.lensIndex || '-') + ' | $' + prod.price);
    }

    console.log('\nDone! Created ' + created + ' products.');
}

main().finally(() => p.$disconnect());
