import { prisma } from '@/lib/db';
import { autoCorrectBrand, autoCorrectLab, autoCorrectIndex } from '@/utils/product-controllers';
import { requireValidCost } from '@/lib/product-cost-guard';

export const ProductService = {
    async getAll() {
        return await prisma.product.findMany({
            orderBy: { brand: 'asc' }
        });
    },

    async getByType(type: string) {
        return await prisma.product.findMany({
            where: { type },
            orderBy: { brand: 'asc' }
        });
    },

    async getByCategory(category: string) {
        return await prisma.product.findMany({
            where: { category },
            orderBy: { brand: 'asc' }
        });
    },

    async create(data: any) {
        const product = await prisma.product.create({
            data: {
                name: data.name,
                brand: autoCorrectBrand(data.brand),
                model: data.model,
                type: data.type,
                category: data.category,
                price: parseFloat(data.price) || 0,
                wholesalePrice: data.wholesalePrice != null ? parseFloat(data.wholesalePrice) : 0,
                cost: requireValidCost(data.cost, data.name || data.model),
                stock: parseInt(data.stock) || 0,
                lensIndex: autoCorrectIndex(data.lensIndex),
                unitType: data.unitType || 'UNIDAD',
                laboratory: autoCorrectLab(data.laboratory),
                sphereMin: data.sphereMin != null ? parseFloat(data.sphereMin) : null,
                sphereMax: data.sphereMax != null ? parseFloat(data.sphereMax) : null,
                cylinderMin: data.cylinderMin != null ? parseFloat(data.cylinderMin) : null,
                cylinderMax: data.cylinderMax != null ? parseFloat(data.cylinderMax) : null,
                additionMin: data.additionMin != null ? parseFloat(data.additionMin) : null,
                additionMax: data.additionMax != null ? parseFloat(data.additionMax) : null,
                is2x1: data.is2x1 === true,
                publishToWeb: data.publishToWeb === true,
                publishToWholesale: data.publishToWholesale === true,
                seoTitle: data.seoTitle,
                seoDescription: data.seoDescription,
                seoTags: data.seoTags,
                customSlug: data.customSlug,
                mpn: data.mpn,
                gender: data.gender,
                ageGroup: data.ageGroup,
                origin: data.origin,
            }
        });
        
        if (product.publishToWeb) {
            await syncToWebProduct(product);
        }
        
        return product;
    },
    async update(id: string, data: any) {
        const product = await prisma.product.update({
            where: { id },
            data: {
                name: data.name,
                brand: data.brand !== undefined ? autoCorrectBrand(data.brand) : undefined,
                model: data.model,
                type: data.type,
                category: data.category,
                price: data.price !== undefined ? (parseFloat(data.price) || 0) : undefined,
                wholesalePrice: data.wholesalePrice !== undefined ? (parseFloat(data.wholesalePrice) || 0) : undefined,
                cost: data.cost !== undefined ? requireValidCost(data.cost, data.name || data.model) : undefined,
                stock: data.stock !== undefined ? (parseInt(data.stock) || 0) : undefined,
                lensIndex: data.lensIndex !== undefined ? autoCorrectIndex(data.lensIndex) : undefined,
                unitType: data.unitType !== undefined ? data.unitType : undefined,
                laboratory: data.laboratory !== undefined ? autoCorrectLab(data.laboratory) : undefined,
                sphereMin: data.sphereMin !== undefined ? (data.sphereMin != null ? parseFloat(data.sphereMin) : null) : undefined,
                sphereMax: data.sphereMax !== undefined ? (data.sphereMax != null ? parseFloat(data.sphereMax) : null) : undefined,
                cylinderMin: data.cylinderMin !== undefined ? (data.cylinderMin != null ? parseFloat(data.cylinderMin) : null) : undefined,
                cylinderMax: data.cylinderMax !== undefined ? (data.cylinderMax != null ? parseFloat(data.cylinderMax) : null) : undefined,
                additionMin: data.additionMin !== undefined ? (data.additionMin != null ? parseFloat(data.additionMin) : null) : undefined,
                additionMax: data.additionMax !== undefined ? (data.additionMax != null ? parseFloat(data.additionMax) : null) : undefined,
                is2x1: data.is2x1 !== undefined ? Boolean(data.is2x1) : undefined,
                publishToWeb: data.publishToWeb !== undefined ? Boolean(data.publishToWeb) : undefined,
                publishToWholesale: data.publishToWholesale !== undefined ? Boolean(data.publishToWholesale) : undefined,
                lensWidth: data.lensWidth !== undefined ? (data.lensWidth !== '' ? parseInt(data.lensWidth) : null) : undefined,
                bridgeWidth: data.bridgeWidth !== undefined ? (data.bridgeWidth !== '' ? parseInt(data.bridgeWidth) : null) : undefined,
                templeLength: data.templeLength !== undefined ? (data.templeLength !== '' ? parseInt(data.templeLength) : null) : undefined,
                frameHeight: data.frameHeight !== undefined ? (data.frameHeight !== '' ? parseInt(data.frameHeight) : null) : undefined,
                seoTitle: data.seoTitle !== undefined ? data.seoTitle : undefined,
                seoDescription: data.seoDescription !== undefined ? data.seoDescription : undefined,
                seoTags: data.seoTags !== undefined ? data.seoTags : undefined,
                customSlug: data.customSlug !== undefined ? data.customSlug : undefined,
                mpn: data.mpn !== undefined ? data.mpn : undefined,
                gender: data.gender !== undefined ? data.gender : undefined,
                ageGroup: data.ageGroup !== undefined ? data.ageGroup : undefined,
                origin: data.origin !== undefined ? data.origin : undefined,
            }
        });
        
        if (product.publishToWeb) {
            await syncToWebProduct(product);
        } else {
            // Remove from WebProducts if un-published
            await prisma.webProduct.deleteMany({ where: { productId: product.id } });
        }
        
        return product;
    },

    async bulkCreate(items: any[]) {
        const created = await prisma.$transaction(
            items.map(item => prisma.product.create({
                data: {
                    name: item.name,
                    brand: autoCorrectBrand(item.brand),
                    model: item.model,
                    type: item.type,
                    category: item.category,
                    price: parseFloat(item.price) || 0,
                    wholesalePrice: item.wholesalePrice != null ? parseFloat(item.wholesalePrice) : 0,
                    cost: requireValidCost(item.cost, item.name || item.model),
                    stock: parseInt(item.stock) || 0,
                    lensIndex: autoCorrectIndex(item.lensIndex),
                    unitType: item.unitType || 'UNIDAD',
                    laboratory: autoCorrectLab(item.laboratory),
                    sphereMin: item.sphereMin != null ? parseFloat(item.sphereMin) : null,
                    sphereMax: item.sphereMax != null ? parseFloat(item.sphereMax) : null,
                    cylinderMin: item.cylinderMin != null ? parseFloat(item.cylinderMin) : null,
                    cylinderMax: item.cylinderMax != null ? parseFloat(item.cylinderMax) : null,
                    additionMin: item.additionMin != null ? parseFloat(item.additionMin) : null,
                    additionMax: item.additionMax != null ? parseFloat(item.additionMax) : null,
                    is2x1: item.is2x1 === true,
                    publishToWeb: item.publishToWeb === true,
                    publishToWholesale: item.publishToWholesale === true,
                    origin: item.origin,
                }
            }))
        );
        
        // Sync any that are published
        for (const product of created) {
            if (product.publishToWeb) {
                await syncToWebProduct(product);
            }
        }
        return { count: created.length };
    }
};

// Helper for SEO Slugs
async function syncToWebProduct(p: any) {
    const cleanStr = (str: string) => 
        str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9\s-]/g, "").trim().replace(/\s+/g, '-').toLowerCase();
    
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

    const existing = await prisma.webProduct.findFirst({ where: { productId: p.id } });
    if (existing) {
        await prisma.webProduct.update({
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
        await prisma.webProduct.create({
            data: {
                productId: p.id,
                name: displayName,
                slug: slug,
                category: category,
                imageUrl: images[0] || null,
                images: images,
                isActive: true,
                isFeatured: false
            }
        });
    }
}
