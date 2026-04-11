const { PrismaClient } = require('./prisma/generated/client');
const prisma = new PrismaClient();
const jose = require('jose');

const secretKey = process.env.JWT_SECRET || 'atelier-optica-super-secret-key-for-dev';
const key = new TextEncoder().encode(secretKey);

async function generateToken(role) {
    return await new jose.SignJWT({ id: 'test-user', role: role, name: 'Tester' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1d')
        .sign(key);
}

async function testSecurity() {
    try {
        console.log('--- INICIANDO TEST DE SEGURIDAD EN PAGOS ---');
        
        // Setup mock data
        const user = await prisma.user.findFirst();
        if (!user) throw new Error("No user found");

        const client = await prisma.client.create({
            data: { name: 'Cliente Security Test', phone: '123' }
        });

        // Test 1: Order SENT to Lab (labStatus = 'SENT')
        const orderSent = await prisma.order.create({
            data: {
                clientId: client.id,
                userId: user.id,
                orderType: 'SALE',
                total: 20000,
                labStatus: 'SENT'
            }
        });

        const paymentSent = await prisma.payment.create({
            data: { orderId: orderSent.id, amount: 2000, method: 'CASH' }
        });

        // Test 2: Order NOT sent to Lab (labStatus = 'NONE')
        const orderDraft = await prisma.order.create({
            data: {
                clientId: client.id,
                userId: user.id,
                orderType: 'SALE',
                total: 20000,
                labStatus: 'NONE'
            }
        });

        const paymentDraft = await prisma.payment.create({
            data: { orderId: orderDraft.id, amount: 2000, method: 'CASH' }
        });

        const staffToken = await generateToken('STAFF');
        const adminToken = await generateToken('ADMIN');

        async function attemptDelete(token, paymentId, description) {
            console.log(`\nProbando: ${description}`);
            const res = await fetch(`http://localhost:3000/api/payments/${paymentId}`, {
                method: 'DELETE',
                headers: {
                    'Cookie': `session=${token}`
                }
            });
            const data = await res.json();
            console.log(' -> Código HTTP:', res.status, '| Respuesta:', JSON.stringify(data));
        }

        // 1. STAFF intenta eliminar pago de orden "NONE" -> DEBE ESTAR OK
        await attemptDelete(staffToken, paymentDraft.id, 'Vendedor(STAFF) eliminando pago de orden "NONE"');

        // 2. STAFF intenta eliminar pago de orden "SENT" -> DEBE DAR ERROR 403
        await attemptDelete(staffToken, paymentSent.id, 'Vendedor(STAFF) eliminando pago de orden "SENT" (Enviada a Fábrica)');

        // 3. ADMIN intenta eliminar pago de orden "SENT" -> DEBE ESTAR OK
        await attemptDelete(adminToken, paymentSent.id, 'Admin eliminando pago de orden "SENT" (Enviada a Fábrica)');

        // Teardown (Only delete the client, cascading deletes remaining orders/payments)
        console.log('\n--- LIMPIANDO DATOS DE PRUEBA ---');
        await prisma.client.delete({ where: { id: client.id } });
        console.log('Test finalizado correctamente.');

    } catch (error) {
        console.error('Error in testing:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testSecurity();
