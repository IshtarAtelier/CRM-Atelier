const { prisma } = require('./db');

async function main() {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const chats = await prisma.whatsAppChat.findMany({
        where: { createdAt: { gte: twentyFourHoursAgo } },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
        orderBy: { createdAt: 'desc' },
        take: 20
    });

    console.log(`Checking recent ${chats.length} chats in the last 24hs...`);

    let found = 0;
    for (const chat of chats) {
        if (chat.messages.length === 0) continue;
        const isMeta = chat.messages.some(m => m.direction === 'OUTBOUND' && m.senderName === 'Meta (Auto-Reply)') || 
                       chat.messages.some(m => m.content.includes('[meta') || m.content.toLowerCase().includes('vengo de un anuncio'));
        
        if (isMeta) {
            found++;
            console.log(`\nChat: ${chat.waId} - Meta Ad: YES`);
            console.log(`Bot Enabled: ${chat.botEnabled}`);
            
            const botReplies = chat.messages.filter(m => m.senderName === 'Bot');
            console.log(`Bot Replies: ${botReplies.length}`);
            
            console.log('--- Sequence ---');
            for (let i = 0; i < Math.min(6, chat.messages.length); i++) {
                const m = chat.messages[i];
                console.log(`[${m.createdAt.toISOString()}] ${m.direction} (${m.senderName || 'Client'}): ${m.content.substring(0, 50).replace(/\n/g, ' ')}...`);
            }
        }
    }
    if (found === 0) console.log("No Meta ad chats found in the last 24hs.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
