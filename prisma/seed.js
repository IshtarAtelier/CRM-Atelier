// Seed script: creates realistic optical products for all categories
const { PrismaClient } = require('../prisma/generated/client');

const prisma = new PrismaClient();

const products = [
    // ===== CRISTALES MONOFOCAL =====
    { name: 'CR39 1.50 Monofocal', category: 'Cristal', type: 'Cristal Monofocal', brand: 'Essilor', model: 'Orma', stock: 50, price: 8500, cost: 3200 },
    { name: 'Policarbonato Monofocal', category: 'Cristal', type: 'Cristal Monofocal', brand: 'Essilor', model: 'Airwear', stock: 30, price: 14000, cost: 5500 },
    { name: 'Alto Índice 1.67 Monofocal', category: 'Cristal', type: 'Cristal Monofocal', brand: 'Hoya', model: 'Hilux 1.67', stock: 20, price: 22000, cost: 9000 },
    { name: 'Alto Índice 1.74 Monofocal', category: 'Cristal', type: 'Cristal Monofocal', brand: 'Hoya', model: 'Hilux 1.74', stock: 10, price: 38000, cost: 16000 },
    { name: 'CR39 Monofocal AR', category: 'Cristal', type: 'Cristal Monofocal', brand: 'Rodenstock', model: 'Perfalit 1.50', stock: 25, price: 12000, cost: 4800 },

    // ===== CRISTALES MULTIFOCAL =====
    { name: 'Multifocal Comfort', category: 'Cristal', type: 'Cristal Multifocal', brand: 'Essilor', model: 'Varilux Comfort', stock: 15, price: 45000, cost: 18000 },
    { name: 'Multifocal Premium', category: 'Cristal', type: 'Cristal Multifocal', brand: 'Essilor', model: 'Varilux X Series', stock: 8, price: 85000, cost: 35000 },
    { name: 'Multifocal Lifestyle', category: 'Cristal', type: 'Cristal Multifocal', brand: 'Hoya', model: 'Hoyalux iD', stock: 12, price: 55000, cost: 22000 },
    { name: 'Multifocal Energy', category: 'Cristal', type: 'Cristal Multifocal', brand: 'Rodenstock', model: 'Progressiv Pure', stock: 10, price: 62000, cost: 25000 },

    // ===== CRISTALES BIFOCAL =====
    { name: 'Bifocal FT28', category: 'Cristal', type: 'Cristal Bifocal', brand: 'Essilor', model: 'FT28 CR39', stock: 20, price: 12000, cost: 4500 },
    { name: 'Bifocal Invisible', category: 'Cristal', type: 'Cristal Bifocal', brand: 'Hoya', model: 'Tact Bifocal', stock: 10, price: 18000, cost: 7200 },

    // ===== CRISTALES OCUPACIONAL =====
    { name: 'Ocupacional Office', category: 'Cristal', type: 'Cristal Ocupacional', brand: 'Essilor', model: 'Eyezen Start', stock: 15, price: 28000, cost: 11000 },
    { name: 'Ocupacional Digital', category: 'Cristal', type: 'Cristal Ocupacional', brand: 'Hoya', model: 'Sync III', stock: 10, price: 32000, cost: 13000 },

    // ===== CRISTALES COQUIL =====
    { name: 'Coquil CR39', category: 'Cristal', type: 'Cristal Coquil', brand: 'Nacional', model: 'STD 1.50', stock: 40, price: 4500, cost: 1800 },

    // ===== LENTES DE SOL =====
    { name: 'Aviator Classic', category: 'Lentes de Sol', type: 'Lentes de Sol', brand: 'Ray-Ban', model: 'RB3025', stock: 8, price: 95000, cost: 45000 },
    { name: 'Wayfarer Original', category: 'Lentes de Sol', type: 'Lentes de Sol', brand: 'Ray-Ban', model: 'RB2140', stock: 6, price: 89000, cost: 42000 },
    { name: 'Cat Eye Miami', category: 'Lentes de Sol', type: 'Lentes de Sol', brand: 'Vogue', model: 'VO5211', stock: 5, price: 52000, cost: 24000 },
    { name: 'Sport Wrap', category: 'Lentes de Sol', type: 'Lentes de Sol', brand: 'Oakley', model: 'Holbrook', stock: 4, price: 120000, cost: 58000 },
    { name: 'Oversized Glam', category: 'Lentes de Sol', type: 'Lentes de Sol', brand: 'Gucci', model: 'GG0083S', stock: 3, price: 185000, cost: 85000 },
    { name: 'Piloto Classic', category: 'Lentes de Sol', type: 'Lentes de Sol', brand: 'Rusty', model: 'RS-401', stock: 10, price: 28000, cost: 12000 },

    // ===== ARMAZÓN DE RECETA =====
    { name: 'Titanio Flex', category: 'Armazón de Receta', type: 'Armazón de Receta', brand: 'Silhouette', model: 'SPX Illusion', stock: 5, price: 145000, cost: 65000 },
    { name: 'Acetato Retro', category: 'Armazón de Receta', type: 'Armazón de Receta', brand: 'Ray-Ban', model: 'RX5228', stock: 8, price: 68000, cost: 30000 },
    { name: 'Metal Aviator RX', category: 'Armazón de Receta', type: 'Armazón de Receta', brand: 'Ray-Ban', model: 'RX6489', stock: 6, price: 72000, cost: 32000 },
    { name: 'Redondo Vintage', category: 'Armazón de Receta', type: 'Armazón de Receta', brand: 'Persol', model: 'PO3007V', stock: 4, price: 98000, cost: 45000 },
    { name: 'Cuadrado Moderno', category: 'Armazón de Receta', type: 'Armazón de Receta', brand: 'Oakley', model: 'OX8046', stock: 7, price: 55000, cost: 24000 },
    { name: 'Acetato Premium', category: 'Armazón de Receta', type: 'Armazón de Receta', brand: 'Ay Not Dead', model: 'AY226', stock: 10, price: 42000, cost: 18000 },
    { name: 'Cat Eye Elegant', category: 'Armazón de Receta', type: 'Armazón de Receta', brand: 'Vogue', model: 'VO5276', stock: 6, price: 38000, cost: 16000 },
    { name: 'Sport Rectangle', category: 'Armazón de Receta', type: 'Armazón de Receta', brand: 'Nike', model: 'NK7090', stock: 8, price: 35000, cost: 15000 },

    // ===== LENTES DE CONTACTO =====
    { name: 'Diaria Descartable', category: 'Lentes de Contacto', type: 'Lentes de Contacto', brand: 'Acuvue', model: 'Oasys 1-Day', stock: 50, price: 18000, cost: 8500 },
    { name: 'Mensual Hidrogel', category: 'Lentes de Contacto', type: 'Lentes de Contacto', brand: 'Air Optix', model: 'HydraGlyde', stock: 30, price: 22000, cost: 10000 },
    { name: 'Tórica Mensual', category: 'Lentes de Contacto', type: 'Lentes de Contacto', brand: 'Acuvue', model: 'Vita for Astigmatism', stock: 20, price: 28000, cost: 13000 },
    { name: 'Multifocal Mensual', category: 'Lentes de Contacto', type: 'Lentes de Contacto', brand: 'Air Optix', model: 'Plus Multifocal', stock: 15, price: 32000, cost: 15000 },
    { name: 'Solución Multiuso', category: 'Lentes de Contacto', type: 'Lentes de Contacto', brand: 'Renu', model: 'Fresh 355ml', stock: 40, price: 8500, cost: 3500 },

    // ===== LENTES ESPECIALES =====
    { name: 'Fotocromático Transitions', category: 'Lentes Especiales', type: 'Lentes Especiales', brand: 'Essilor', model: 'Transitions Gen8', stock: 15, price: 35000, cost: 14000 },
    { name: 'Blue Protect', category: 'Lentes Especiales', type: 'Lentes Especiales', brand: 'Hoya', model: 'BlueControl', stock: 20, price: 18000, cost: 7500 },
    { name: 'Polarizado RX', category: 'Lentes Especiales', type: 'Lentes Especiales', brand: 'Essilor', model: 'Xperio Polarized', stock: 10, price: 42000, cost: 18000 },
];

async function seed() {
    console.log('🌱 Seeding products...');

    let created = 0;
    for (const p of products) {
        try {
            await prisma.product.create({ data: p });
            created++;
            process.stdout.write(`  ✅ ${p.brand} ${p.model} ($${p.price.toLocaleString()})\n`);
        } catch (e) {
            console.log(`  ⚠️ Skipped ${p.brand} ${p.model}: ${e.message?.slice(0, 60)}`);
        }
    }

    console.log(`\n✨ Created ${created}/${products.length} products`);

    // Summary by category
    const cats = {};
    products.forEach(p => { cats[p.type || p.category] = (cats[p.type || p.category] || 0) + 1; });
    console.log('\nBy type:');
    Object.entries(cats).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
}

seed()
    .then(() => prisma.$disconnect())
    .catch(e => { console.error(e); prisma.$disconnect(); });
