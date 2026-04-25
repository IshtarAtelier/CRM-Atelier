import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({datasources:{db:{url: 'postgresql://postgres:RrPSyEGtnMDeqWUAqHKGEIEHUmPcBSAL@interchange.proxy.rlwy.net:12759/railway'}}});
async function main() {
    const clients = await prisma.client.findMany({
        where: {name: {in: ['Sergio Monteros', 'Paola Alvarez']}},
        select: {id: true, name: true, status: true, orders: {select: {orderType: true, total: true, isDeleted: true}}}
    });
    console.dir(clients, {depth: null});
}
main().finally(()=>prisma.$disconnect());
