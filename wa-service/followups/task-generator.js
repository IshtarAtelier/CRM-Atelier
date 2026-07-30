const { prisma } = require('../db');
const { checkEligibility } = require('./eligibility');

// Ventana de ENVÍO de seguimientos, en minutos desde la medianoche (hora de Argentina).
// A propósito más angosta que el horario real del local (L–V 8–20, Sáb 9–17): se
// decidió mantenerla así aunque el local abra más temprano/tarde (ver commit b5408434).
// El local ya no tiene siesta (atiende corrido), así que cada ventana es un solo tramo.
const OPEN_WINDOWS_AR = {
    weekday: [[9 * 60, 19 * 60]],  // 9:00–19:00 corrido
    saturday: [[10 * 60, 16 * 60]], // 10:00–16:00 (mismo margen de 1h que el de semana)
};

/**
 * Calcula un vencimiento aleatorio repartido a lo largo del día de HOY,
 * dentro de la ventana de envío de arriba (Argentina, UTC-3, sin horario de verano).
 * Distribuye de forma uniforme sobre los minutos de la ventana, sin picos.
 */
function pickSpreadDueDate(now) {
    // Fecha y día en hora argentina: corremos el instante 3 horas y leemos los
    // campos en UTC. El día que sale de acá es el MISMO que después se usa para
    // anclar la medianoche, así que no puede pasar que se elija la ventana de un
    // día y el vencimiento caiga en otro (corriendo a la noche, el día UTC ya no
    // es el día AR).
    const ar = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const day = ar.getUTCDay(); // 0 = Domingo, 6 = Sábado

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

    // Convertir el minuto AR a un instante absoluto anclando la medianoche del
    // MISMO día argentino que eligió la ventana: AR = UTC-3 ⇒ 00:00 AR = 03:00 UTC.
    const midnightAR = Date.UTC(ar.getUTCFullYear(), ar.getUTCMonth(), ar.getUTCDate(), 3, 0, 0, 0);
    return new Date(midnightAR + targetMinAR * 60 * 1000);
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
                        // Sin orderBy el chat sale en orden arbitrario: los clientes
                        // con dos chats (@c.us y @lid) quedaban evaluados contra el
                        // chat equivocado, con sus etiquetas y su actividad.
                        whatsappChats: { orderBy: { lastMessageAt: 'desc' } },
                        tasks: {
                            // SENDING incluido: una tarea reclamada con el envío
                            // en vuelo (timer corriendo, etiqueta aún no escrita)
                            // seguiría invisible para este dedup y se crearía una
                            // gemela en la misma corrida.
                            where: { status: { in: ['PENDING', 'SENDING'] } }
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
