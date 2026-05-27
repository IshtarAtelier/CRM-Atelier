require("dotenv").config();
const { PrismaClient } = require('@prisma/client');
const PROD_URL = process.env.PROD_DATABASE_URL;

async function main() {
    console.log("Connecting to Production Database...");
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    await prod.$connect();

    const startOfMonth = new Date(2026, 4, 1); // May 1st, 2026
    const endOfMonth = new Date(2026, 5, 1);   // June 1st, 2026

    // Fetch all sale orders in May 2026
    const sales = await prod.order.findMany({
        where: {
            orderType: 'SALE',
            isDeleted: false,
            createdAt: {
                gte: startOfMonth,
                lt: endOfMonth
            }
        },
        include: {
            user: true,
            items: {
                include: {
                    product: true
                }
            }
        }
    });

    console.log(`Found ${sales.length} sales in May 2026.`);

    // 1. Group by vendor
    const byVendor = {};
    for (const s of sales) {
        const name = s.user?.name || "Sin asignar";
        byVendor[name] = (byVendor[name] || 0) + s.total;
    }

    console.log("\nSales by Vendor:");
    console.log(byVendor);

    // 2. Group by product category
    const byCategory = {};
    for (const s of sales) {
        for (const it of s.items) {
            const cat = it.product?.category || "Otros";
            byCategory[cat] = (byCategory[cat] || 0) + (it.price * it.quantity);
        }
    }

    console.log("\nSales by Product Category:");
    console.log(byCategory);

    // 3. Group by payment method
    const byPaymentMethod = {};
    const payments = await prod.payment.findMany({
        where: {
            order: {
                orderType: 'SALE',
                isDeleted: false,
                createdAt: {
                    gte: startOfMonth,
                    lt: endOfMonth
                }
            }
        }
    });

    for (const p of payments) {
        const method = p.method || "Otro";
        byPaymentMethod[method] = (byPaymentMethod[method] || 0) + p.amount;
    }

    console.log("\nPayments by Method:");
    console.log(byPaymentMethod);

    await prod.$disconnect();
}

main().catch(console.error);
