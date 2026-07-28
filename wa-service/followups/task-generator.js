const { prisma } = require('../db');
const { checkEligibility } = require('./eligibility');
const { isBusinessHours } = require('../shared/business-hours');

// Ventanas abiertas por día, en minutos desde la medianoche (hora de Argentina).
// Repartimos los envíos a lo largo de TODA la jornada (9 a 19), no amontonados a la tarde.
const OPEN_WINDOWS_AR = {
    weekday: [[9 * 60, 13 * 60 + 30], [16 * 60, 19 * 60]], // 9:00–13:30 y 16:00–19:00
    saturday: [[10 * 60, 14 * 60]],                        // 10:00–14:00
};

/**
 * Calcula un vencimiento aleatorio repartido a lo largo del día de HOY,
 * dentro del horario comercial de Argentina (UTC-3, sin horario de verano).
 * Distribuye de forma uniforme sobre los minutos realmente abiertos, así que
 * la siesta (13:30–16:00) no genera un pico de envíos al reabrir.
 */
function pickSpreadDueDate(now) {
    // Día de la semana en horario argentino
    const argNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
    const day = argNow.getDay(); // 0 = Domingo, 6 = Sábado

    if (day === 0) return null; // Domingo cerrado: sin ventana hoy

    const windows = day === 6 ? OPEN_WINDOWS_AR.saturday : OPEN_WINDOWS_AR.weekday;

    // Elegir un minuto al azar proporcional al tamaño de cada ventana abierta
    const totalOpen = windows.reduce((sum, [start, end]) => sum + (end - start), 0);
    let pick = Math.floor(Math.random() * totalOpen);
    let targetMinAR = windows[windows.length - 1][1];
    for (const [start, end] of windows) {
        const size = end - start;
        if (pick < size) { targetMinAR = start + pick; break; }
        pick -= size;
    }

    // Convertir el minuto AR a un instante absoluto: AR = UTC-3 ⇒ UTC = AR + 180 min.
    // Durante la jornada (12–22 UTC) el día UTC coincide con el día AR, sin corrimiento.
    const due = new Date(now);
    due.setUTCHours(0, 0, 0, 0);
    due.setUTCMinutes(targetMinAR + 180);
    return due;
}

/**
 * Escanea presupuestos pendientes y CREA tareas en el calendario del CRM
 * para que el Humano las vea o el Bot las ejecute repartidas durante el día.
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
                    // Vencimiento aleatorio repartido a lo largo del día (9 a 19, hora AR)
                    let dueDate = pickSpreadDueDate(now);

                    // Domingo (sin ventana) o si el horario sorteado ya pasó: vence ahora
                    if (!dueDate || now > dueDate) {
                        dueDate = new Date(now.getTime());
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

                    const dueAR = dueDate.toLocaleString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });
                    console.log(`  ✅ [Task Gen] Tarea creada: ${client.name} -> ${followUpType} (Vence: ${dueAR} AR)`);
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
