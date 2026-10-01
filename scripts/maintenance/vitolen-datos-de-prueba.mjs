/**
 * Datos de PRUEBA para el módulo de Vitolen, SOLO en la base local:
 *   · un usuario ADMIN de pruebas (para entrar al CRM local),
 *   · un cliente con receta,
 *   · una VENTA enviada al laboratorio con dos cristales Hoya (OD/OI) y su
 *     armazón, lista para probar el bloque "Vitolen" de la ficha.
 *
 * Idempotente: si ya existe, no duplica. Se niega a correr contra cualquier
 * base que no sea localhost.
 *
 *   node scripts/maintenance/vitolen-datos-de-prueba.mjs
 *
 * Usuario de pruebas del CRM local: pruebas.vitolen@atelier.local
 * Contraseña: la constante CLAVE de abajo (solo existe en la base local).
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import bcrypt from 'bcryptjs';

config();
const url = process.env.DATABASE_URL || '';
if (!/localhost|127\.0\.0\.1/.test(url)) {
    console.error('❌ DATABASE_URL no apunta a localhost: estos datos son solo de prueba.');
    process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url } } });

const EMAIL = 'pruebas.vitolen@atelier.local';
const CLAVE = 'vitolen-local-2026';
const CLIENTE = 'Prueba Vitolen Carga';

try {
    const hash = await bcrypt.hash(CLAVE, 10);
    const user = await prisma.user.upsert({
        where: { email: EMAIL },
        update: { password: hash, role: 'ADMIN' },
        create: { email: EMAIL, name: 'Pruebas Vitolen', password: hash, role: 'ADMIN' },
    });

    let client = await prisma.client.findFirst({ where: { name: CLIENTE, isDeleted: false } });
    if (!client) {
        client = await prisma.client.create({
            data: { name: CLIENTE, phone: '3510000000', email: 'prueba.vitolen@example.com', dni: '11111111', address: 'Calle Falsa 123', birthDate: new Date('1975-05-05'), status: 'CLIENT', createdBy: 'Pruebas' },
        });
    }

    let rx = await prisma.prescription.findFirst({ where: { clientId: client.id } });
    if (!rx) {
        rx = await prisma.prescription.create({
            data: {
                clientId: client.id, sphereOD: 1.25, cylinderOD: 0.75, axisOD: 5, sphereOI: 1.25, cylinderOI: 0.5, axisOI: 70,
                addition: 2.25, distanceOD: 32, distanceOI: 31, heightOD: 28, heightOI: 28, prescriptionType: 'ADDITION', notes: 'Receta de prueba',
            },
        });
    }

    const cristal = await prisma.product.findFirst({ where: { laboratory: 'VITOLEN', name: 'HOYA ARRAY 2 - 1.60 CLEAR' } });
    if (!cristal) throw new Error('No está "HOYA ARRAY 2 - 1.60 CLEAR" en la base local: correr primero subir-catalogo-vitolen.mjs --aplicar');

    let order = await prisma.order.findFirst({ where: { clientId: client.id, orderType: 'SALE', isDeleted: false } });
    if (!order) {
        const item = (eye) => ({
            productId: cristal.id, quantity: 1, price: cristal.price / 2, eye,
            sphereVal: 1.25, cylinderVal: eye === 'OD' ? 0.75 : 0.5, axisVal: eye === 'OD' ? 5 : 70, additionVal: 2.25,
            pdVal: eye === 'OD' ? 32 : 31, heightVal: 28, framePosition: 1,
            laboratorySnapshot: 'VITOLEN', productNameSnapshot: cristal.name, productCategorySnapshot: 'Cristal',
            productTypeSnapshot: cristal.type, productLensIndexSnapshot: cristal.lensIndex, productCostSnapshot: cristal.cost,
        });
        order = await prisma.order.create({
            data: {
                clientId: client.id, userId: user.id, prescriptionId: rx.id,
                status: 'CONFIRMED', orderType: 'SALE', isLocked: true,
                labStatus: 'SENT', labSentAt: new Date(), labSentBy: user.name, labSentById: user.id,
                total: cristal.price, subtotalWithMarkup: cristal.price,
                frameSource: 'USER', userFrameBrand: 'Vulk', userFrameModel: 'Roma', labFrameType: 'Metálico',
                labCrizal: 'No aplica', labNotes: 'Venta de prueba del módulo Vitolen',
                items: { create: [item('OD'), item('OI')] },
                frames: { create: [{ position: 1, shape: 'Rectangular', a: '52', b: '40', dbl: '18', edc: '56', details: 'color rojo', heightOD: 28, heightOI: 28 }] },
            },
        });
    }

    console.log(`Usuario de pruebas: ${EMAIL} (ADMIN)`);
    console.log(`Venta de prueba:    ${order.id}  →  /admin/ventas?id=${order.id}`);
} finally {
    await prisma.$disconnect();
}
