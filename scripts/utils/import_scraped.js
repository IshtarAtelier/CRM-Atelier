const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Helper functions for normalization (equivalent to product-controllers.ts)
function autoCorrectBrand(brand) {
    if (!brand) return null;
    const b = brand.trim();
    if (!b) return null;
    const lower = b.toLowerCase();
    if (lower === 'hango loose' || lower === 'hangoloose') return 'Hang Loose';
    if (lower === 'hanoveer kids' || lower === 'hannover kid') return 'Hannover Kids';
    if (lower === 'kazwini') return 'Kazwini';
    if (lower === 'varilux') return 'Varilux';
    if (lower === 'grupo optico' || lower === 'grupo óptico') return 'Grupo Optico';
    if (lower === 'smart lens' || lower === 'smart') return 'Smart';
    if (lower === 'clip on kids') return 'Clip On Kids';
    if (lower === 'atelier kids') return 'Atelier Kids';
    return b.charAt(0).toUpperCase() + b.slice(1).toLowerCase();
}

function autoCorrectIndex(index) {
    if (!index) return null;
    const i = index.trim();
    if (!i) return null;
    if (i === '1.5') return '1.50';
    if (i === '1.6') return '1.60';
    if (i === '1.49') return '1.49';
    if (i === '1.56') return '1.56';
    if (i === '1.59') return '1.59';
    if (i === '1.67') return '1.67';
    if (i === '1.74') return '1.74';
    if (i.toLowerCase().includes('foto')) return 'Foto';
    return i;
}

// Sync function for e-commerce storefront
async function syncToWebProduct(p, tx) {
    const db = tx || prisma;
    const cleanStr = (str) => 
        str.normalize("NFD")
           .replace(/[\u0300-\u036f]/g, "")
           .replace(/[^a-zA-Z0-9\s-]/g, "")
           .trim()
           .replace(/\s+/g, '-')
           .toLowerCase();
    
    const brandStr = cleanStr(p.brand || 'atelier');
    const modelStr = cleanStr(p.model || p.name || 'armazon');
    const hash = p.id.slice(-4).toLowerCase();
    
    const baseSlug = p.customSlug ? cleanStr(p.customSlug) : `${brandStr}-${modelStr}`;
    const slug = p.customSlug ? baseSlug : `${baseSlug}-${hash}`;
    
    let category = "Receta";
    if (p.category === 'Lentes de Sol' || p.category?.toLowerCase().includes('sol')) category = "Sol";
    if (p.category === 'Lentes de Contacto') category = "Contacto";
    
    const images = p.imagenesCatalogo?.length > 0 ? p.imagenesCatalogo : (p.rawImageUrls?.length > 0 ? p.rawImageUrls : []);
    
    const isAtelierBrand = p.brand?.toLowerCase() === 'atelier';
    const displayName = isAtelierBrand 
        ? (p.name || p.model || '').trim() 
        : `${p.brand || ''} ${p.model || p.name}`.trim();

    const existing = await db.webProduct.findFirst({ where: { productId: p.id } });
    if (existing) {
        await db.webProduct.update({
            where: { id: existing.id },
            data: {
                name: displayName,
                slug: slug,
                category: category,
                imageUrl: images[0] || null,
                images: images,
                isActive: p.stock > 0
            }
        });
    } else {
        await db.webProduct.create({
            data: {
                productId: p.id,
                name: displayName,
                slug: slug,
                category: category,
                imageUrl: images[0] || null,
                images: images,
                isActive: p.stock > 0,
                isFeatured: false
            }
        });
    }
}

async function main() {
    const args = process.argv.slice(2);
    const filePath = args[0] || '/Users/ishtarpissano/.gemini/antigravity/brain/a963da96-d28d-412d-a3f0-129fc07fd7f5/scratch/scraped_products.json';
    
    if (!fs.existsSync(filePath)) {
        console.error(`Error: File not found at ${filePath}`);
        process.exit(1);
    }
    
    console.log(`Reading products from: ${filePath}`);
    const rawData = fs.readFileSync(filePath, 'utf8');
    const items = JSON.parse(rawData);
    
    console.log(`Loaded ${items.length} products. Starting DB import...`);
    
    let successCount = 0;
    
    // Process items in chunks of 50 to avoid connection timeouts or heavy loads
    const chunkSize = 50;
    for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        console.log(`Importing chunk ${Math.floor(i / chunkSize) + 1} of ${Math.ceil(items.length / chunkSize)}...`);
        
        await prisma.$transaction(async (tx) => {
            for (const item of chunk) {
                // Check if product with this model and brand already exists to prevent duplicates
                const existingProduct = await tx.product.findFirst({
                    where: {
                        brand: autoCorrectBrand(item.brand),
                        model: item.model
                    }
                });
                
                let product;
                if (existingProduct) {
                    // Update existing product stock and price/cost
                    product = await tx.product.update({
                        where: { id: existingProduct.id },
                        data: {
                            price: item.price,
                            cost: item.cost,
                            stock: item.stock,
                            rawImageUrls: item.rawImageUrls,
                            imagenesCatalogo: item.imagenesCatalogo,
                            publishToWeb: true
                        }
                    });
                } else {
                    // Create new product
                    product = await tx.product.create({
                        data: {
                            name: item.name,
                            brand: autoCorrectBrand(item.brand),
                            model: item.model,
                            type: item.type || 'Armazón',
                            category: item.category,
                            price: item.price,
                            cost: item.cost,
                            stock: item.stock,
                            lensIndex: autoCorrectIndex(item.lensIndex),
                            unitType: item.unitType || 'UNIDAD',
                            publishToWeb: true,
                            origin: item.origin || 'STOCK',
                            rawImageUrls: item.rawImageUrls || [],
                            imagenesCatalogo: item.imagenesCatalogo || []
                        }
                    });
                }
                
                // Sync to WebProduct storefront
                await syncToWebProduct(product, tx);
                successCount++;
            }
        });
    }
    
    console.log(`\nImport complete! Successfully imported/updated ${successCount} products in the database.`);
    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error('Error during import:', e);
    await prisma.$disconnect();
    process.exit(1);
});
