const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    try {
        const client = await prisma.client.findFirst({
            include: {
                tags: true,
                tasks: true,
                interactions: { orderBy: { createdAt: 'desc' } },
                prescriptions: { orderBy: { date: 'desc' } },
                orders: {
                    select: {
                        id: true, total: true, paid: true, status: true, orderType: true,
                        createdAt: true, labStatus: true, items: { include: { product: true } },
                        payments: true, prescription: true, frameSource: true, userFrameBrand: true,
                        userFrameModel: true, userFrameNotes: true, labColor: true, labTreatment: true,
                        labDiameter: true, labPdOd: true, labPdOi: true, labPrismOD: true, labPrismOI: true,
                        labBaseCurve: true, labFrameType: true, labBevelPosition: true, smartLabScreenshot: true,
                        labOrderNumber: true, labNotes: true, discount: true, markup: true, discountCash: true,
                        discountTransfer: true, discountCard: true, subtotalWithMarkup: true
                    },
                    where: { isDeleted: false },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
        console.log(client ? 'SUCCESS' : 'NULL');
    } catch(e) {
        console.error('ERROR OCCURRED:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}
main();
