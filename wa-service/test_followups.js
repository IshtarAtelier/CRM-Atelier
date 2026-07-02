const { prisma } = require('./db');

async function main() {
    // Buscar los leads en etapa SEGUIMIENTO 1
    const leads = await prisma.client.findMany({
        where: {
            status: { in: ['FOLLOW_UP_1', 'FOLLOWUP1', 'SEGUIMIENTO_1'] }
        },
        select: { id: true, name: true, phone: true, status: true, createdAt: true }
    });

    // Si no encontramos con esos status, buscar por tags o chatLabels
    if (leads.length === 0) {
        console.log('No encontré leads con status FOLLOW_UP_1. Buscando por chatLabels...');
        const chats = await prisma.whatsAppChat.findMany({
            where: {
                chatLabels: { has: 'Seguimiento 1' }
            },
            include: {
                client: { select: { id: true, name: true, phone: true, status: true } },
                messages: { orderBy: { createdAt: 'desc' }, take: 5, select: { direction: true, senderName: true, content: true, createdAt: true } }
            }
        });
        console.log(`Encontré ${chats.length} chats con label "Seguimiento 1":`);
        for (const chat of chats) {
            console.log(`\n--- ${chat.client?.name || chat.waId} ---`);
            console.log(`Client Status: ${chat.client?.status}`);
            console.log(`Bot Enabled: ${chat.botEnabled}`);
            console.log(`Last 5 messages:`);
            for (const m of chat.messages) {
                console.log(`  [${m.createdAt.toISOString()}] ${m.direction} (${m.senderName || 'Client'}): ${m.content?.substring(0, 60).replace(/\n/g, ' ')}...`);
            }
        }
        return;
    }

    console.log(`Encontré ${leads.length} leads en Seguimiento 1:`);
    for (const lead of leads) {
        console.log(`\n--- ${lead.name} ---`);
        const chat = await prisma.whatsAppChat.findFirst({
            where: { clientId: lead.id },
            include: { messages: { orderBy: { createdAt: 'desc' }, take: 5, select: { direction: true, senderName: true, content: true, createdAt: true } } }
        });
        if (chat) {
            console.log(`Bot Enabled: ${chat.botEnabled}`);
            console.log(`Last 5 messages:`);
            for (const m of chat.messages) {
                console.log(`  [${m.createdAt.toISOString()}] ${m.direction} (${m.senderName || 'Client'}): ${m.content?.substring(0, 60).replace(/\n/g, ' ')}...`);
            }
        } else {
            console.log('  (Sin chat de WhatsApp vinculado)');
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
