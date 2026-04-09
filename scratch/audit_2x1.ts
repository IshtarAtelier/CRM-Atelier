import { PrismaClient } from '@prisma/client';
import { 
    isMultifocal2x1, 
    isAtelierFrame, 
    isCrystal, 
    isMiPrimerVarilux, 
    getCategoryKey, 
    safePrice,
    calculateQuoteTotals
} from '../src/lib/promo-utils';

const prisma = new PrismaClient();

async function audit() {
    console.log('--- Starting 2x1 Promo Audit ---');
    
    // 1. Fetch all products to calculate Atelier average price
    const products = await prisma.product.findMany();
    
    // 2. Fetch all SALE orders with items
    const orders = await prisma.order.findMany({
        where: {
            orderType: 'SALE',
            isDeleted: false
        },
        include: {
            items: {
                include: {
                    product: true
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    });

    console.log(`Auditing ${orders.length} sale orders...`);
    
    const errors = [];

    for (const order of orders) {
        // Prepare items for calculation
        // The items in the DB have 'price', which corresponds to 'customPrice' in our calculator
        const calculationItems = order.items.map(it => ({
            product: it.product,
            quantity: it.quantity,
            customPrice: it.price,
            uid: it.id // Using id as uid for the aggregator
        }));

        // Calculate expected totals using our corrected logic
        const expected = calculateQuoteTotals(
            calculationItems,
            order.markup || 0,
            order.discountCash || 0,
            products
        );

        // Discrepancy check
        // We compare the stored total with our calculated total
        // Some orders might have manual adjustments, so we look for a delta 
        // that matches a frame price (or a significant portion of it)
        const delta = Math.abs(order.total - expected.totalCash);
        
        // If delta is significant (e.g. > 1000 pesos) and there was a promo discount calculated
        if (delta > 5 && expected.promoFrameDiscount > 0) {
            // It's a potential error if the stored total is exactly the raw total (without promo)
            const rawExpected = calculateQuoteTotals(calculationItems, order.markup || 0, order.discountCash || 0, [] /* no products to skip promo */);
            
            // Check if the stored total matches THE RAW TOTAL (no promo)
            // Note: rawExpected.totalCash here will still apply the 0 price for 2nd crystals if it was set in customPrice,
            // but calculatePromoFrameDiscount specifically checks for the extra frame discount.
            
            // Let's check specifically if promoFrameDiscount was NOT applied
            const totalWithoutFramePromo = Math.round((expected.rawSubtotal + expected.rawSubtotal * ((order.markup || 0)/100)) * (1 - (order.discountCash || 0)/100));
            
            if (Math.abs(order.total - totalWithoutFramePromo) < 10) {
                errors.push({
                    orderId: order.id,
                    createdAt: order.createdAt,
                    storedTotal: order.total,
                    expectedTotal: expected.totalCash,
                    promoDiscountMissed: expected.promoFrameDiscount,
                    items: order.items.map(i => `${i.product?.brand} ${i.product?.model} ($${i.price})`).join(', ')
                });
            }
        }
    }

    if (errors.length > 0) {
        console.log(`\nFound ${errors.length} orders with missing 2x1 frame discount:`);
        errors.forEach(err => {
            console.log(`- Order ${err.orderId} (${err.createdAt.toLocaleDateString()}):`);
            console.log(`  Stored: $${err.storedTotal} | Expected: $${err.expectedTotal} (Missed -$${err.promoDiscountMissed})`);
            console.log(`  Items: ${err.items}`);
        });
    } else {
        console.log('\nNo errors found in existing sales.');
    }

    await prisma.$disconnect();
}

audit().catch(e => {
    console.error(e);
    process.exit(1);
});
