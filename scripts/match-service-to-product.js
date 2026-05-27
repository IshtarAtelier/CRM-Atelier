require("dotenv").config();
const { PrismaClient } = require('@prisma/client');

const PROD_URL = process.env.PROD_DATABASE_URL;
const LOCAL_URL = "postgresql://postgres:localpassword@localhost:5432/atelier?schema=public";

// Helper to normalize string for comparison
function normalize(str) {
    if (!str) return '';
    return str.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/[^a-z0-9]/g, ' ')      // replace non-alphanumeric with spaces
        .replace(/\s+/g, ' ')            // single spaces
        .trim();
}

async function main() {
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    const local = new PrismaClient({ datasources: { db: { url: LOCAL_URL } } });

    await prod.$connect();
    await local.$connect();

    const localServices = await local.servicePricing.findMany({ where: { active: true } });
    const prodProducts = await prod.product.findMany({});

    console.log(`Local services count: ${localServices.length}`);
    console.log(`Prod products count: ${prodProducts.length}`);

    const matched = [];

    for (const service of localServices) {
        const sNorm = normalize(service.name);
        
        // Find best match in prodProducts
        let bestMatch = null;
        let bestScore = 0;

        for (const prodP of prodProducts) {
            const pNameNorm = normalize(prodP.name);
            const pBrandNorm = normalize(prodP.brand);
            const pModelNorm = normalize(prodP.model);
            
            // Check if service name contains product name or vice versa, or if they share keywords
            const sWords = sNorm.split(' ');
            const pWords = `${pNameNorm} ${pBrandNorm} ${pModelNorm}`.split(' ');
            
            // Calculate intersection
            const intersection = sWords.filter(w => w.length > 2 && pWords.includes(w));
            const score = intersection.length;

            if (score > bestScore) {
                bestScore = score;
                bestMatch = prodP;
            }
        }

        matched.push({
            serviceName: service.name,
            serviceCategory: service.category,
            localCash: service.priceCash,
            localCredit: service.priceCredit,
            bestProdProductName: bestMatch ? (bestMatch.name || `${bestMatch.brand || ''} ${bestMatch.model || ''}`.trim()) : 'No Encontrado',
            bestProdProductPrice: bestMatch ? bestMatch.price : null,
            matchScore: bestScore
        });
    }

    console.log(JSON.stringify(matched, null, 2));

    await local.$disconnect();
    await prod.$disconnect();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
