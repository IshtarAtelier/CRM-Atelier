import { prisma } from './src/lib/db';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const orders = await prisma.order.findMany({ 
    where: { orderType: 'SALE' }, 
    include: { tags: true, client: { include: { tags: true } } } 
  });
  let totalOrdersWithTags = 0;
  let totalClientsWithTags = 0;
  
  for (const o of orders) {
    if (o.tags && o.tags.length > 0) totalOrdersWithTags++;
    if (o.client && o.client.tags && o.client.tags.length > 0) totalClientsWithTags++;
  }
  
  console.log('Total sales:', orders.length);
  console.log('Sales with order tags:', totalOrdersWithTags);
  console.log('Sales with client tags:', totalClientsWithTags);
  
  const tags = await prisma.tag.findMany();
  console.log('All tags:', tags.map((t: any) => t.name));
}

main().catch(console.error).finally(() => prisma.$disconnect());
