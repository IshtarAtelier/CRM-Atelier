const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const phones = ['3516080925', '3517181130', '3562886566', '35412565658'];
    
    // Find clients
    const clients = await prisma.client.findMany({
        where: {
            OR: phones.map(p => ({ phone: { contains: p } }))
        }
    });
    
    console.log('Found clients:', JSON.stringify(clients, null, 2));
    
    if (clients.length === 0) {
        console.log('No clients found to delete.');
        return;
    }
    
    const ids = clients.map(c => c.id);
    console.log(`Ready to delete ${ids.length} clients: ${ids.join(', ')}`);
    
    // WhatsAppChat does not have Cascade in the schema, so we delete them manually
    const deletedChats = await prisma.whatsAppChat.deleteMany({
        where: { clientId: { in: ids } }
    });
    console.log(`Deleted ${deletedChats.count} WhatsApp chats.`);
    
    const result = await prisma.client.deleteMany({
        where: {
            id: { in: ids }
        }
    });
    
    console.log(`Deleted ${result.count} clients.`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
