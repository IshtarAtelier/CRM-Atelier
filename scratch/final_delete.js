const path = require('path');
const { PrismaClient } = require('@prisma/client');

// Force DATABASE_URL to be absolute to avoid "Unable to open" issues on Windows
const dbPath = path.resolve(__dirname, '../prisma/dev.db');
process.env.DATABASE_URL = `file:${dbPath}`;

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `file:${dbPath}`,
    },
  },
});

async function main() {
    console.log(`--- DB Path: ${dbPath} ---`);
    const targets = ['ishtar', 'test'];
    
    for (const name of targets) {
        // Search
        const clients = await prisma.client.findMany({
            where: {
                name: {
                    contains: name
                }
            }
        });
        
        console.log(`Found ${clients.length} matching "${name}"`);
        
        for (const client of clients) {
            console.log(`Deleting ID: ${client.id} Name: ${client.name}`);
            await prisma.client.delete({
                where: { id: client.id }
            });
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
