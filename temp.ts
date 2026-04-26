import { prisma } from './src/lib/db';
import * as fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const dbUrlMatch = envContent.match(/DATABASE_URL=["']?(.*?)["']?(\n|$)/);
if (dbUrlMatch) {
  process.env.DATABASE_URL = dbUrlMatch[1].trim();
}

async function main() {
  const clients = await prisma.client.findMany({ include: { tags: true } });
  const clientsWithTags = clients.filter(c => c.tags && c.tags.length > 0);
  console.log(`Total clients: ${clients.length}`);
  console.log(`Clients with tags: ${clientsWithTags.length}`);
  console.log(`Tags present:`, clientsWithTags.map(c => c.tags.map(t => t.name)));
}

main().catch(console.error).finally(() => prisma.$disconnect());
