const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test(id) {
    try {
        console.log(`Testing getById for ID: ${id}`);
        const contact = await prisma.client.findUnique({
            where: { id },
            include: {
                tags: true,
                tasks: true,
                interactions: {
                    orderBy: { createdAt: 'desc' }
                },
                prescriptions: {
                    orderBy: { date: 'desc' }
                },
                orders: {
                    select: {
                        id: true,
                        total: true,
                        paid: true,
                        status: true,
                        orderType: true,
                        createdAt: true,
                        labStatus: true,
                        items: { include: { product: true } },
                        payments: true,
                        prescription: true,
                        frameSource: true,
                        userFrameBrand: true,
                        userFrameModel: true,
                        userFrameNotes: true,
                        labColor: true,
                        labTreatment: true,
                        labDiameter: true,
                        labPdOd: true,
                        labPdOi: true,
                        labPrismOD: true,
                        labPrismOI: true,
                        labBaseCurve: true,
                        labFrameType: true,
                        labBevelPosition: true,
                        smartLabScreenshot: true,
                        labOrderNumber: true,
                        labNotes: true,
                        discount: true,
                        markup: true,
                        discountCash: true,
                        discountTransfer: true,
                        discountCard: true,
                        subtotalWithMarkup: true
                    },
                    where: { isDeleted: false },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
        console.log('Success:', !!contact);
        if (contact) {
            console.log('Contact Name:', contact.name);
            console.log('Orders Count:', contact.orders.length);
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Get the first contact ID
async function run() {
    const first = await prisma.client.findFirst();
    if (first) {
        await test(first.id);
    } else {
        console.log('No contacts found');
    }
    await prisma.$disconnect();
}

run();
