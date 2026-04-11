/**
 * Generador de catálogo de precios dinámico desde la DB
 * Lee productos de la tabla Product y genera texto formateado
 * para inyectar como contexto en el prompt del agente IA.
 */

const { PrismaClient } = require('./prisma/generated/client');

const prisma = new PrismaClient();

/**
 * Formatea un precio en pesos argentinos
 */
function formatPrice(price) {
    return `$${Math.round(price).toLocaleString('es-AR')}`;
}

/**
 * Calcula el valor de cuota (6 cuotas sin interés con 25% de recargo financiero)
 * Asume que el precio en DB es contado; cuotas = precio * 1.25 / 6
 */
function calcInstallment(price, surchargeRate = 1.25) {
    const total = Math.round(price * surchargeRate);
    const installment = Math.round(total / 6);
    return { installment, total };
}

/**
 * Genera el bloque de texto de un producto
 */
function productLine(p, includeInstallments = true) {
    const name = [p.brand, p.name, p.model].filter(Boolean).join(' ');
    const details = [];
    if (p.lensIndex) details.push(`Índice ${p.lensIndex}`);

    let line = `• ${name}`;
    if (details.length) line += ` (${details.join(', ')})`;
    line += `\n  Contado: ${formatPrice(p.price)}`;

    if (includeInstallments) {
        const { installment, total } = calcInstallment(p.price);
        line += ` | 6 cuotas sin interés de ${formatPrice(installment)} (total ${formatPrice(total)})`;
    }

    return line;
}

/**
 * Genera el catálogo completo de precios desde la DB
 * @returns {Promise<string>} Texto formateado del catálogo
 */
async function generateCatalog() {
    try {
        const products = await prisma.product.findMany({
            orderBy: [{ category: 'asc' }, { type: 'asc' }, { price: 'asc' }],
        });

        // Agrupar productos
        const lensStock = products.filter(p => p.category === 'LENS' && p.type === 'MONOFOCAL' && !p.laboratory);
        const lensLab = products.filter(p => p.category === 'LENS' && p.type === 'MONOFOCAL' && p.laboratory);
        const multifocal = products.filter(p => p.category === 'LENS' && p.type === 'MULTIFOCAL');
        const bifocal = products.filter(p => p.category === 'LENS' && p.type === 'BIFOCAL');
        const frames = products.filter(p => p.category === 'FRAME');
        const sunglasses = products.filter(p => p.category === 'SUNGLASS');
        const contactLens = products.filter(p => p.category === 'LENS' && p.type === 'CONTACT');
        const accessories = products.filter(p => p.category === 'ACCESSORY');
        const controlMyopia = products.filter(p => p.category === 'LENS' && (p.type === 'CONTROL_MIOPIA' || (p.name && p.name.toLowerCase().includes('myop'))));
        const ocupacional = products.filter(p => p.category === 'LENS' && p.type === 'OCUPACIONAL');

        const sections = [];

        if (lensStock.length > 0) {
            sections.push(`CRISTALES MONOFOCALES (STOCK):\n${lensStock.map(p => productLine(p)).join('\n\n')}`);
        }

        if (lensLab.length > 0) {
            sections.push(`CRISTALES MONOFOCALES (LABORATORIO – graduaciones altas):\n${lensLab.map(p => productLine(p)).join('\n\n')}`);
        }

        if (multifocal.length > 0) {
            sections.push(`CRISTALES MULTIFOCALES:\n${multifocal.map(p => productLine(p)).join('\n\n')}`);
        }

        if (bifocal.length > 0) {
            sections.push(`CRISTALES BIFOCALES:\n${bifocal.map(p => productLine(p)).join('\n\n')}`);
        }

        if (controlMyopia.length > 0) {
            sections.push(`CRISTALES CONTROL DE MIOPÍA:\n${controlMyopia.map(p => productLine(p)).join('\n\n')}`);
        }

        if (ocupacional.length > 0) {
            sections.push(`CRISTALES OCUPACIONALES:\n${ocupacional.map(p => productLine(p)).join('\n\n')}`);
        }

        if (frames.length > 0) {
            // Agrupar armazones por marca
            const brandGroups = {};
            frames.forEach(f => {
                const brand = f.brand || 'Sin marca';
                if (!brandGroups[brand]) brandGroups[brand] = [];
                brandGroups[brand].push(f);
            });

            const frameLines = Object.entries(brandGroups).map(([brand, products]) => {
                const cheapest = products.reduce((min, p) => p.price < min.price ? p : min, products[0]);
                const { installment, total } = calcInstallment(cheapest.price);
                return `• ${brand} — Desde contado: ${formatPrice(cheapest.price)} | 6 cuotas sin interés de ${formatPrice(installment)} (total ${formatPrice(total)}) — ${products.length} modelo(s)`;
            });

            sections.push(`ARMAZONES RECETA:\n${frameLines.join('\n')}`);
        }

        if (sunglasses.length > 0) {
            const brandGroups = {};
            sunglasses.forEach(f => {
                const brand = f.brand || 'Sin marca';
                if (!brandGroups[brand]) brandGroups[brand] = [];
                brandGroups[brand].push(f);
            });

            const lines = Object.entries(brandGroups).map(([brand, products]) => {
                const cheapest = products.reduce((min, p) => p.price < min.price ? p : min, products[0]);
                const { installment, total } = calcInstallment(cheapest.price);
                return `• ${brand} — Desde contado: ${formatPrice(cheapest.price)} | 6 cuotas sin interés de ${formatPrice(installment)} (total ${formatPrice(total)}) — ${products.length} modelo(s)`;
            });

            sections.push(`ANTEOJOS DE SOL:\n${lines.join('\n')}`);
        }

        if (contactLens.length > 0) {
            sections.push(`LENTES DE CONTACTO:\n${contactLens.map(p => productLine(p)).join('\n\n')}`);
        }

        if (accessories.length > 0) {
            sections.push(`ACCESORIOS:\n${accessories.map(p => productLine(p)).join('\n\n')}`);
        }

        return sections.join('\n\n═══════════════════════════\n\n');
    } catch (error) {
        console.error('Error generando catálogo:', error);
        return '[Error al generar catálogo de precios]';
    }
}

module.exports = { generateCatalog, formatPrice, calcInstallment };
