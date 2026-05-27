require("dotenv").config();
const { PrismaClient } = require('@prisma/client');
const PROD_URL = process.env.PROD_DATABASE_URL;

async function main() {
    console.log("Connecting to Production Database...");
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    await prod.$connect();

    // 1. Pisar Orma Tallado
    const oldOrma = await prod.product.findFirst({
        where: { name: "Orma Transitions GEN S ESSILOR (fotocromatico) " }
    });
    if (oldOrma) {
        await prod.product.update({
            where: { id: oldOrma.id },
            data: {
                name: "TRANSITIONS GEN S - ORMA (Tallado) SIN AR",
                cost: 295857,
                price: 710057,
                sphereMax: 7.0,
                sphereMin: -13.0,
                cylinderMin: -6.0,
                cylinderMax: 6.0,
                laboratory: "ESSILOR",
                type: "Cristal Monofocal",
                is2x1: false,
                lensIndex: "1.50"
            }
        });
        console.log("Updated Orma Tallado.");
    }

    // 2. Pisar Airwear 1.59
    const oldAirwear = await prod.product.findFirst({
        where: { name: "Transitions Gens 1.59(fotocromatico) gris y marron" }
    });
    if (oldAirwear) {
        await prod.product.update({
            where: { id: oldAirwear.id },
            data: {
                name: "TRANSITIONS GEN S - AIRWEAR 1.59 SIN AR",
                cost: 335030,
                price: 804074,
                sphereMax: 8.0,
                sphereMin: -12.0,
                cylinderMin: -4.0,
                cylinderMax: 4.0,
                laboratory: "ESSILOR",
                type: "Cristal Monofocal",
                is2x1: false,
                lensIndex: "1.59"
            }
        });
        console.log("Updated Airwear.");
    }

    // 3. Pisar Stylis 1.67
    const oldStylis = await prod.product.findFirst({
        where: { name: "Transitions Gens 1.67 (fotocromatico) gris y marron" }
    });
    if (oldStylis) {
        await prod.product.update({
            where: { id: oldStylis.id },
            data: {
                name: "TRANSITIONS GEN S - STYLIS 1.67 SIN AR",
                cost: 506149,
                price: 1214757,
                sphereMax: 8.0,
                sphereMin: -14.0,
                cylinderMin: -4.0,
                cylinderMax: 4.0,
                laboratory: "ESSILOR",
                type: "Cristal Monofocal",
                is2x1: false,
                lensIndex: "1.67"
            }
        });
        console.log("Updated Stylis.");
    }

    // 4. Crear Orma Stock
    const ormaStock = await prod.product.findFirst({ where: { name: "TRANSITIONS GEN S - ORMA (Stock) SIN AR" } });
    if (!ormaStock) {
        await prod.product.create({
            data: {
                name: "TRANSITIONS GEN S - ORMA (Stock) SIN AR",
                cost: 137147,
                price: 329153,
                sphereMax: 4.0,
                sphereMin: -4.0,
                cylinderMin: -2.0,
                cylinderMax: 2.0,
                laboratory: "ESSILOR",
                type: "Cristal Monofocal",
                category: "Cristal",
                is2x1: false,
                lensIndex: "1.50"
            }
        });
        console.log("Created Orma Stock.");
    }

    // 5. Crear Orma Colores
    const ormaColores = await prod.product.findFirst({ where: { name: "TRANSITIONS GEN S - ORMA (Colores) SIN AR" } });
    if (!ormaColores) {
        await prod.product.create({
            data: {
                name: "TRANSITIONS GEN S - ORMA (Colores) SIN AR",
                cost: 364966,
                price: 875918,
                sphereMax: 7.0,
                sphereMin: -13.0,
                cylinderMin: -6.0,
                cylinderMax: 6.0,
                laboratory: "ESSILOR",
                type: "Cristal Monofocal",
                category: "Cristal",
                is2x1: false,
                lensIndex: "1.50"
            }
        });
        console.log("Created Orma Colores.");
    }

    console.log("Process complete for Monofocales Gen S.");
    await prod.$disconnect();
}

main().catch(console.error);
