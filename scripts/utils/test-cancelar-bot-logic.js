const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { disableBotForChat } = require('../../wa-service/tools.js');

async function runTests() {
    console.log("🚀 Iniciando prueba de la etiqueta 'Cancelar Bot'...");
    
    // 1. Crear un cliente y chat falsos
    const testClient = await prisma.client.create({
        data: {
            name: "TEST_CANCELAR_BOT_USER",
            phone: "5499999999999"
        }
    });
    
    const testChat = await prisma.whatsAppChat.create({
        data: {
            waId: "5499999999999@c.us",
            clientId: testClient.id,
            botEnabled: true,
            status: "OPEN"
        }
    });

    try {
        console.log(`✅ Cliente creado: ${testClient.id} | Chat: ${testChat.id}`);

        // 2. Simular que la IA decide apagar el bot (por "Spam")
        console.log("🤖 Simulando que la IA invoca 'disableBotForChat'...");
        await disableBotForChat({ chatId: testChat.id, reason: 'Spam' });

        // 3. Verificar resultados en BD
        const updatedClient = await prisma.client.findUnique({
            where: { id: testClient.id },
            include: { tags: true }
        });
        const updatedChat = await prisma.whatsAppChat.findUnique({
            where: { id: testChat.id }
        });

        const hasTag = updatedClient.tags.some(t => t.name === 'Cancelar Bot');
        const hasLabel = updatedChat.chatLabels.includes('Spam');

        console.log(`\n--- RESULTADOS DE APAGADO ---`);
        console.log(`Etiqueta 'Cancelar Bot' en cliente: ${hasTag ? '✅ SÍ' : '❌ NO'}`);
        console.log(`Motivo 'Spam' en labels del chat: ${hasLabel ? '✅ SÍ' : '❌ NO'}`);
        console.log(`Bot apagado en el chat: ${!updatedChat.botEnabled ? '✅ SÍ' : '❌ NO'}`);

        // 4. Simular intento de encendido desde el panel
        console.log(`\n--- PRUEBA DE BLOQUEO DE ENCENDIDO ---`);
        const chatCheck = await prisma.whatsAppChat.findUnique({ 
            where: { id: testChat.id },
            include: { client: { include: { tags: true } } }
        });
        const hasCancelBot = chatCheck.client?.tags?.some(t => t.name.toLowerCase() === 'cancelar bot');
        if (hasCancelBot) {
            console.log("✅ BLOQUEO EXITOSO: El sistema impidió encender el bot porque tiene la etiqueta.");
        } else {
            console.log("❌ ERROR: El sistema permitió encender el bot.");
        }

    } catch (e) {
        console.error("Error durante las pruebas:", e);
    } finally {
        // Limpieza
        console.log("\n🧹 Limpiando datos de prueba...");
        await prisma.whatsAppChat.delete({ where: { id: testChat.id } });
        await prisma.client.delete({ where: { id: testClient.id } });
        await prisma.$disconnect();
        console.log("🏁 Prueba finalizada.");
    }
}

runTests();
