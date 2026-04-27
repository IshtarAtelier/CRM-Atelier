import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // 1. All tags in the system
  const allTags = await prisma.tag.findMany({ include: { _count: { select: { clients: true, orders: true } } } });
  console.log('\n=== ALL TAGS ===');
  allTags.forEach(t => console.log(`  "${t.name}" → ${t._count.clients} clients, ${t._count.orders} orders`));

  // 2. Current month sales
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sales = await prisma.order.findMany({
    where: { orderType: 'SALE', isDeleted: false, createdAt: { gte: monthStart } },
    select: {
      id: true,
      total: true,
      tags: { select: { name: true } },
      client: { select: { name: true, tags: { select: { name: true } } } }
    }
  });

  console.log(`\n=== SALES THIS MONTH: ${sales.length} ===`);
  let withOrderTags = 0;
  let withClientTags = 0;
  let withAnyTag = 0;

  sales.forEach(s => {
    const oTags = s.tags.map(t => t.name);
    const cTags = s.client?.tags?.map(t => t.name) || [];
    if (oTags.length > 0) withOrderTags++;
    if (cTags.length > 0) withClientTags++;
    if (oTags.length > 0 || cTags.length > 0) withAnyTag++;
  });

  console.log(`  With order tags: ${withOrderTags}/${sales.length}`);
  console.log(`  With client tags: ${withClientTags}/${sales.length}`);
  console.log(`  With ANY tag: ${withAnyTag}/${sales.length}`);
  console.log(`  WITHOUT any tag: ${sales.length - withAnyTag}/${sales.length}`);

  // 3. Show a few sales without tags
  const untagged = sales.filter(s => s.tags.length === 0 && (!s.client?.tags || s.client.tags.length === 0));
  console.log(`\n=== SAMPLE UNTAGGED SALES (first 5) ===`);
  untagged.slice(0, 5).forEach(s => {
    console.log(`  ${s.client?.name || 'N/A'} → $${s.total.toLocaleString()}`);
  });

  // 4. Show tagged sales
  const tagged = sales.filter(s => s.tags.length > 0 || (s.client?.tags && s.client.tags.length > 0));
  console.log(`\n=== TAGGED SALES ===`);
  tagged.forEach(s => {
    const allT = [...s.tags.map(t => t.name), ...(s.client?.tags?.map(t => t.name) || [])];
    console.log(`  ${s.client?.name || 'N/A'} → $${s.total.toLocaleString()} → [${[...new Set(allT)].join(', ')}]`);
  });

  // 5. Check contactSource distribution on clients with sales this month
  const clientIds = [...new Set(sales.map(s => s.client?.name).filter(Boolean))];
  const clientsWithSource = await prisma.client.findMany({
    where: { orders: { some: { orderType: 'SALE', isDeleted: false, createdAt: { gte: monthStart } } } },
    select: { name: true, contactSource: true, interest: true }
  });
  console.log(`\n=== CLIENT contactSource (clients with sales this month) ===`);
  const sourceCounts: Record<string, number> = {};
  clientsWithSource.forEach(c => {
    const src = c.contactSource || '(vacío)';
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  });
  Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  await prisma.$disconnect();
}
main();
