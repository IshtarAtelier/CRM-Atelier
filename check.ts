import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({datasources:{db:{url: 'postgresql://postgres:RrPSyEGtnMDeqWUAqHKGEIEHUmPcBSAL@interchange.proxy.rlwy.net:12759/railway'}}});
async function main() {
    console.log(await prisma.client.findMany({
        where: {name: {in: ['Sergio Monteros', 'Paola Alvarez']}},
        select: {name: true, status: true, orders: {select: {orderType: true, total: true, isDeleted: true}}}
    }));
}
main().finally(()=>prisma.$disconnect());
