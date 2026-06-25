import { prisma } from '@/lib/db';
import { autoCorrectBrand, autoCorrectIndex } from '@/utils/product-controllers';
import path from 'path';

// Helper to determine brand from catalog title
function detectBrand(title: string): string {
    const t = title.toUpperCase();
    if (t.includes('KAZWINI')) return 'Kazwini';
    if (t.includes('LINDBERG')) return 'Lindberg';
    if (t.includes('SILHOUETTE')) return 'Silhouette';
    if (t.includes('KHAOS')) return 'Khaos';
    if (t.includes('DAVID JACOBS')) return 'David Jacobs';
    if (t.includes('HANG LOOSE') || t.includes('HANGO LOOSE')) return 'Hang Loose';
    if (t.includes('CLIP ON') || t.includes('CLIP-ON')) return 'Clip On';
    
    const words = title.trim().split(/\s+/);
    return words.slice(0, 2).join(' ');
}

// Helper to determine category
function detectCategory(title: string): string {
    const t = title.toUpperCase();
    if (t.includes('SOL') || t.includes('SUNGLASSES')) {
        return 'Lentes de Sol';
    }
    if (t.includes('CONTACTO') || t.includes('LENS')) {
        return 'Lentes de Contacto';
    }
    return 'Lentes de Receta';
}

// Sync function for e-commerce storefront
async function syncToWebProduct(p: any, tx: any) {
    const cleanStr = (str: string) => 
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

    // Only show on storefront if stock >= 20 AND publishToWeb is true
    const isActive = p.stock >= 20 && p.publishToWeb;

    const existing = await tx.webProduct.findFirst({ where: { productId: p.id } });
    if (existing) {
        await tx.webProduct.update({
            where: { id: existing.id },
            data: {
                name: displayName,
                slug: slug,
                category: category,
                imageUrl: images[0] || null,
                images: images,
                isActive: isActive
            }
        });
    } else {
        await tx.webProduct.create({
            data: {
                productId: p.id,
                name: displayName,
                slug: slug,
                category: category,
                imageUrl: images[0] || null,
                images: images,
                isActive: isActive,
                isFeatured: false
            }
        });
    }
}

export const KazwiniSyncService = {
    async syncProducts(options: { crawlAll?: boolean; markup?: number } = {}) {
        const crawlAll = options.crawlAll === true;
        const markupMultiplier = options.markup || 1.5;
        
        console.log(`[Kazwini Sync] Starting sync. crawlAll=${crawlAll}, markup=${markupMultiplier}`);
        
        // Dynamically import playwright to avoid bundle issues
        const { chromium } = await import('playwright');
        
        const browsersPath = path.join(process.cwd(), '.playwright-browsers');
        process.env.PLAYWRIGHT_BROWSERS_PATH = browsersPath;
        
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();
        
        try {
            console.log("[Kazwini Sync] Navigating to homepage...");
            await page.goto('https://kazwiniopticalgroup.com', { waitUntil: 'networkidle' });
            
            console.log("[Kazwini Sync] Logging in...");
            await page.evaluate(() => {
                const emailInput = document.getElementById('landing-login-email') as HTMLInputElement | null;
                const passInput = document.getElementById('landing-login-password') as HTMLInputElement | null;
                if (emailInput) emailInput.value = 'pissano@kazwini.com';
                if (passInput) passInput.value = 'pissano2025';
                
                const form = document.getElementById('landing-login-form') as HTMLFormElement | null;
                if (form) {
                    const event = new Event('submit', { cancelable: true, bubbles: true });
                    form.dispatchEvent(event);
                }
            });

            await page.waitForTimeout(5000);
            
            console.log("[Kazwini Sync] Navigating to shop...");
            await page.goto('https://kazwiniopticalgroup.com/shop', { waitUntil: 'networkidle' });
            
            const catalogLinks = await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a.catalog-btn')) as HTMLAnchorElement[];
                return links.map(a => ({
                    href: a.href,
                    title: a.closest('.catalog-card')?.querySelector('.catalog-title')?.textContent?.trim() || 'Desconocido'
                }));
            });

            console.log(`[Kazwini Sync] Found ${catalogLinks.length} catalogs.`);
            
            const catalogsToCrawl = crawlAll ? catalogLinks : catalogLinks.slice(0, 3);
            console.log(`[Kazwini Sync] Will crawl ${catalogsToCrawl.length} catalogs.`);

            let totalImported = 0;
            let totalDeactivated = 0;

            for (let i = 0; i < catalogsToCrawl.length; i++) {
                const catalog = catalogsToCrawl[i];
                console.log(`[Kazwini Sync] [${i + 1}/${catalogsToCrawl.length}] Crawling: "${catalog.title}"...`);
                
                try {
                    await page.goto(catalog.href, { waitUntil: 'networkidle', timeout: 30000 });
                    
                    const parsedProducts = await page.evaluate((baseCatalog) => {
                        const cards = Array.from(document.querySelectorAll('.card'));
                        const products: any[] = [];
                        
                        cards.forEach(card => {
                            const codeEl = card.querySelector('.product-header h5');
                            if (!codeEl) return;
                            const codeText = codeEl.textContent.replace('◆', '').trim();
                            
                            const variantInputs = Array.from(card.querySelectorAll('input.variant-thumbnail-input')) as HTMLInputElement[];
                            
                            if (variantInputs.length === 0) {
                                const singleInput = card.querySelector('input[data-js-product-cover]') as HTMLInputElement | null;
                                if (singleInput) {
                                    variantInputs.push(singleInput);
                                }
                            }
                            
                            variantInputs.forEach(input => {
                                const configStr = input.getAttribute('data-js-config');
                                if (!configStr) return;
                                try {
                                    const config = JSON.parse(configStr);
                                    const colorName = config.color_name || 'C1';
                                    const costUSD = parseFloat(config.precio) || 0;
                                    const stock = parseInt(config.stock) || 0;
                                    
                                    const relativeImages = config.images || [];
                                    const absoluteImages = relativeImages.map((img: any) => {
                                        const urlPath = img.pathUrl || img;
                                        if (urlPath.startsWith('http')) return urlPath;
                                        return `https://kazwiniopticalgroup.com${urlPath.startsWith('/') ? '' : '/'}${urlPath}`;
                                    });
                                    
                                    products.push({
                                        code: codeText,
                                        colorCode: colorName,
                                        cost: costUSD,
                                        stock: stock,
                                        images: absoluteImages,
                                        catalogTitle: baseCatalog.title
                                    });
                                } catch (err) {
                                    // ignore JSON error
                                }
                            });
                        });
                        
                        return products;
                    }, catalog);

                    console.log(`[Kazwini Sync]   Found ${parsedProducts.length} variations.`);

                    // Batch database insert inside transaction
                    await prisma.$transaction(async (tx) => {
                        for (const item of parsedProducts) {
                            const brand = detectBrand(item.catalogTitle || catalog.title);
                            const category = detectCategory(item.catalogTitle || catalog.title);
                            const productName = `${brand} ${item.code} ${item.colorCode}`.trim();
                            const modelName = `${item.code} ${item.colorCode}`.trim();
                            const priceUSD = item.cost * markupMultiplier;
                            
                            // RULE: Minimum of 20 items in stock to show on web
                            const shouldPublish = item.stock >= 20;

                            const existingProduct = await tx.product.findFirst({
                                where: {
                                    brand: autoCorrectBrand(brand),
                                    model: modelName
                                }
                            });

                            let product;
                            if (existingProduct) {
                                product = await tx.product.update({
                                    where: { id: existingProduct.id },
                                    data: {
                                        price: priceUSD,
                                        cost: item.cost,
                                        stock: item.stock,
                                        rawImageUrls: item.images,
                                        imagenesCatalogo: item.images,
                                        publishToWeb: shouldPublish
                                    }
                                });
                            } else {
                                product = await tx.product.create({
                                    data: {
                                        name: productName,
                                        brand: autoCorrectBrand(brand),
                                        model: modelName,
                                        type: 'Armazón',
                                        category: category,
                                        price: priceUSD,
                                        cost: item.cost,
                                        stock: item.stock,
                                        lensIndex: autoCorrectIndex(item.lensIndex),
                                        publishToWeb: shouldPublish,
                                        origin: 'STOCK',
                                        rawImageUrls: item.images,
                                        imagenesCatalogo: item.images
                                    }
                                });
                            }

                            // Sync web product visibility
                            await syncToWebProduct(product, tx);
                            
                            if (shouldPublish) {
                                totalImported++;
                            } else {
                                totalDeactivated++;
                            }
                        }
                    });

                } catch (catError: any) {
                    console.error(`[Kazwini Sync] Error syncing catalog ${catalog.href}:`, catError.message);
                }
                
                await page.waitForTimeout(1000);
            }

            console.log(`[Kazwini Sync] Completed. Published/Updated: ${totalImported}, Deactivated (stock < 20): ${totalDeactivated}`);
            
            return {
                success: true,
                publishedCount: totalImported,
                deactivatedCount: totalDeactivated
            };

        } finally {
            await browser.close();
        }
    }
};
