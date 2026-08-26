import { prisma } from '@/lib/db';
import { autoCorrectBrand, autoCorrectLab, autoCorrectIndex } from '@/utils/product-controllers';
import { requireValidCost } from '@/lib/product-cost-guard';
import { computeFinalLensCost, findLabConfig, type LabCostConfig } from '@/lib/lens-cost';
import { invalidateWebCatalog } from '@/lib/catalog/tienda-map';
import { puedeEntrarEn2x1 } from '@/lib/promo-utils';

// El tilde "entra en el 2x1" mueve plata (decide si un armazón se regala o va
// al 50%). Solo puede quedar prendido en lo que la promo puede bonificar:
// armazones y lentes de sol. El gate del formulario es de cortesía — este es
// el que vale, para que una llamada armada a mano no tilde un cristal.
const eligible2x1Permitido = (valor: any, tipo: any, categoria: any): boolean =>
    valor === true && puedeEntrarEn2x1({ type: tipo, category: categoria });

/**
 * COSTO CALCULADO UNA SOLA VEZ, AL GUARDAR (pedido de la administradora,
 * 26/8/2026): si la carga trae el costo PELADO (`baseCost`) y NO trae un
 * `cost` explícito, el costo final sale de acá —
 *     (pelado + calibrado del laboratorio) × (1 + IVA)
 * — y queda escrito en `cost`. Nunca se recalcula al leer ni en ediciones que
 * no traen `baseCost`: la fórmula corre una vez y el resultado persiste.
 * (Recalcular sobre un `cost` que ya la tenía aplicada fue el bug de
 * duplicación del botón "Calcular Final".)
 *
 * Reglas:
 *  - Solo cristales y tratamientos: las demás categorías no tienen pelado.
 *  - Los tratamientos no llevan calibrado.
 *  - SIN doble calibrado para 2x1: el `cost` del producto es UN par. El
 *    segundo par se valúa en la venta (solo calibrado + IVA, cost-matching).
 *    Así están cargados los 127 de Optovisión — verificado el 26/8/2026
 *    despejando la fórmula contra la lista del laboratorio.
 *  - Si la carga trae `cost` explícito, se respeta (es el flujo del formulario,
 *    que muestra el cálculo antes de guardar).
 *  - Sin config del laboratorio no se inventa nada: `cost` queda como venga.
 */
/**
 * Parse ESTRICTO del pelado. "83.400" es ambiguo (¿$83,40 o $83.400 con punto
 * de miles es-AR?) y parseFloat elegiría $83,40 en silencio — un costo
 * catastróficamente bajo que encima esquivaría requireValidCost porque el
 * cálculo cortocircuita al guard. Ante cualquier formato dudoso: null, y que
 * el guard exija el cost explícito con un error visible.
 */
function peladoEntrante(raw: unknown): number | null {
    const base = typeof raw === 'number' ? raw
        : (typeof raw === 'string' && /^\s*\d+(\.\d{1,2})?\s*$/.test(raw) ? parseFloat(raw) : NaN);
    return Number.isFinite(base) && base > 0 ? base : null;
}

function costoDesdeElPelado(
    data: any,
    labs: LabCostConfig[],
    actual?: { laboratory?: string | null; category?: string | null } | null,
): number | null {
    if (data.cost !== undefined && data.cost !== null && data.cost !== '') return null;
    const base = peladoEntrante(data.baseCost);
    if (base == null) return null;
    const categoria = data.category ?? actual?.category ?? '';
    if (categoria !== 'Cristal' && categoria !== 'Tratamiento') return null;
    const labName = data.laboratory !== undefined ? autoCorrectLab(data.laboratory) : actual?.laboratory;
    if (!labName) return null;
    const lab = findLabConfig(labs, labName);
    if (!lab || (!lab.calibrado && !lab.iva)) return null;
    return computeFinalLensCost(base, lab, { skipCalibrado: categoria === 'Tratamiento' });
}

/** La config de labs para la fórmula; si la lectura falla, nadie calcula nada. */
async function labsParaCosto(): Promise<LabCostConfig[]> {
    return prisma.laboratoryConfig
        .findMany({ select: { name: true, calibrado: true, iva: true } })
        .catch(() => [] as LabCostConfig[]);
}

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
        // Vino el pelado sin cost: el sistema calcula el final una sola vez, acá.
        // (La config de labs se busca solo si hace falta: el caso dominante es
        // el formulario, que ya manda el cost calculado.)
        const quiereCalculo = (data.cost === undefined || data.cost === null || data.cost === '')
            && peladoEntrante(data.baseCost) != null;
        const costCalculado = quiereCalculo ? costoDesdeElPelado(data, await labsParaCosto()) : null;
        const product = await prisma.product.create({
            data: {
                name: data.name,
                brand: autoCorrectBrand(data.brand),
                model: data.model,
                type: data.type,
                category: data.category,
                price: parseFloat(data.price) || 0,
                wholesalePrice: data.wholesalePrice != null ? parseFloat(data.wholesalePrice) : 0,
                cost: costCalculado ?? requireValidCost(data.cost, data.name || data.model),
                baseCost: data.baseCost != null && data.baseCost !== '' ? (parseFloat(data.baseCost) || null) : null,
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
                eligible2x1: eligible2x1Permitido(data.eligible2x1, data.type, data.category),
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
        await invalidateWebCatalog();

        return product;
    },
    async update(id: string, data: any) {
        // Validar el tilde del 2x1 contra el tipo/categoría FINAL del producto:
        // los del payload si vienen, si no los que ya están guardados.
        if (data.eligible2x1 === true && (data.type === undefined || data.category === undefined)) {
            const actual = await prisma.product.findUnique({ where: { id }, select: { type: true, category: true } });
            if (!eligible2x1Permitido(true, data.type ?? actual?.type, data.category ?? actual?.category)) {
                data = { ...data, eligible2x1: false };
            }
        } else if (data.eligible2x1 === true && !eligible2x1Permitido(true, data.type, data.category)) {
            data = { ...data, eligible2x1: false };
        }
        // Vino un pelado nuevo sin cost explícito: se recalcula el final UNA vez.
        // SOLO si el pelado CAMBIÓ respecto del guardado: reenviar el mismo no
        // es una carga nueva, y recalcular igual pisaría en silencio un cost
        // cargado a mano desde una factura real (que viene con los descuentos
        // del laboratorio, deliberadamente abajo de la lista).
        let costCalculado: number | null = null;
        const peladoNuevo = (data.cost === undefined || data.cost === null || data.cost === '')
            ? peladoEntrante(data.baseCost)
            : null;
        if (peladoNuevo != null) {
            const contexto = await prisma.product.findUnique({
                where: { id }, select: { laboratory: true, category: true, baseCost: true },
            });
            if (contexto && Math.round(peladoNuevo) !== Math.round(contexto.baseCost ?? -1)) {
                costCalculado = costoDesdeElPelado(data, await labsParaCosto(), contexto);
            }
        }
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
                cost: costCalculado != null
                    ? costCalculado
                    : (data.cost !== undefined ? requireValidCost(data.cost, data.name || data.model) : undefined),
                baseCost: data.baseCost !== undefined ? (data.baseCost !== '' && data.baseCost != null ? (parseFloat(data.baseCost) || null) : null) : undefined,
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
                eligible2x1: data.eligible2x1 !== undefined ? Boolean(data.eligible2x1) : undefined,
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
        await invalidateWebCatalog();

        return product;
    },

    async bulkCreate(items: any[]) {
        // La carga masiva es LA subida de listas: acá el pelado-sin-cost es normal.
        const alguienCalcula = items.some(i =>
            (i.cost === undefined || i.cost === null || i.cost === '') && peladoEntrante(i.baseCost) != null);
        const labs = alguienCalcula ? await labsParaCosto() : [];
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
                    cost: costoDesdeElPelado(item, labs) ?? requireValidCost(item.cost, item.name || item.model),
                    baseCost: item.baseCost != null && item.baseCost !== '' ? (parseFloat(item.baseCost) || null) : null,
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
                    eligible2x1: eligible2x1Permitido(item.eligible2x1, item.type, item.category),
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
        await invalidateWebCatalog();
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
        // REGLA: el nombre y el slug de un WebProduct existente son CURADOS
        // (nombre estelar + color, campaña del 27/7). Pisarlos con
        // "marca + código" destruyó fichas en prod (Dionisio, 19/8). El sync
        // solo refresca lo derivado del producto: imágenes y visibilidad.
        await prisma.webProduct.update({
            where: { id: existing.id },
            data: {
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
