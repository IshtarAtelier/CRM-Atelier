const { prisma } = require('../db');
const { checkEligibility } = require('./eligibility');
const { isBusinessHours } = require('../shared/business-hours');

/**
 * Escanea presupuestos pendientes y CREA tareas en el calendario del CRM
 * para que el Humano las vea o el Bot las ejecute a la tarde.
 */
async function generateFollowUpTasks() {
    console.log('\n[Task Generator] Iniciando generación de tareas de seguimiento...');

    try {
        const now = new Date();
        const pastDays = 20;
        const cutoffDate = new Date(now.getTime() - pastDays * 24 * 60 * 60 * 1000);

        // Buscar presupuestos recientes
        const recentQuotes = await prisma.order.findMany({
            where: {
                orderType: 'QUOTE',
                isDeleted: false,
                createdAt: { gte: cutoffDate },
            },
            include: {
                client: {
                    include: {
                        tags: true,
                        whatsappChats: true,
                        tasks: {
                            where: { status: 'PENDING' }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        let tasksCreated = 0;

        for (const quote of recentQuotes) {
            const client = quote.client;
            if (!client || !client.whatsappChats || client.whatsappChats.length === 0) continue;

            const chat = client.whatsappChats[0];

            // Revisar elegibilidad original
            const { eligible, followUpType, label } = await checkEligibility({ client, chat, quote, now });

            if (eligible) {
                const taskDesc = `[SISTEMA] ${followUpType} - Seguimiento de Venta`;

                // Verificar si ya existe una tarea pendiente para este seguimiento
                const existingTask = client.tasks.find(t => t.description === taskDesc);
                
                if (!existingTask) {
                    // Calcular dueDate: Hoy a las 18:00 hs
                    const dueDate = new Date();
                    dueDate.setHours(18, 0, 0, 0);

                    // Si ya son más de las 18:00, poner la tarea vencida ahora mismo
                    if (now > dueDate) {
                        dueDate.setTime(now.getTime());
                    }

                    await prisma.clientTask.create({
                        data: {
                            clientId: client.id,
                            description: taskDesc,
                            type: 'FOLLOWUP',
                            status: 'PENDING',
                            dueDate: dueDate,
                            createdBy: 'Bot'
                        }
                    });

                    console.log(`  ✅ [Task Gen] Tarea creada: ${client.name} -> ${followUpType} (Vence: ${dueDate.getHours()}:00)`);
                    tasksCreated++;
                }
            }
        }

        console.log(`[Task Generator] Finalizado. Tareas creadas: ${tasksCreated}\n`);

    } catch (err) {
        console.error('❌ Error en Task Generator:', err.message);
    }
}

module.exports = { generateFollowUpTasks };
