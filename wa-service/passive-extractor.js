const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { contenidoATexto } = require('./shared/ai-content');
const { HumanMessage } = require("@langchain/core/messages");
const { prisma } = require('./db');
const { addTagToClient, convertIntoLead, updateClientData, reportInvoiceRequest, isPhrase } = require('./tools');
const { withTimeout } = require('./utils');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// ─────────────────────────────────────────────────────────────────────────────
// Reglas de creación de ficha desde una conversación de WhatsApp.
//
// Historia: un commit de SEO (c8d2b3ba) borró de acá toda la creación de fichas
// y la reemplazó por un `return` temprano. Resultado: entre junio y julio de 2026
// el extractor no creó NINGUNA ficha y —peor— tampoco enriqueció los chats sin
// ficha (sin resumen, sin etiquetas, sin detectar postergaciones), porque el
// `return` cortaba antes de todo lo demás.
//
// Regla actual: se crea la ficha con NOMBRE válido + TELÉFONO válido. No se exige
// intención de compra: un contacto con nombre y teléfono ya vale, y el origen se
// completa solo. Ante la duda NO se crea (mejor ninguna ficha que una basura).
// ─────────────────────────────────────────────────────────────────────────────

/** Nombres que no son nombres: vacíos, genéricos, con muchos dígitos o frases. */
function esNombreValido(nombre) {
    if (!nombre || typeof nombre !== 'string') return false;
    const limpio = nombre.trim();
    if (limpio.length < 2) return false;

    // "3541215971", "cliente 12345": si tiene 5+ dígitos es un teléfono disfrazado
    if ((limpio.match(/\d/g) || []).length >= 5) return false;

    const generico = limpio.toLowerCase();
    if (['contacto nuevo wa', 'contacto nuevo', 'cliente', 'desconocido', '-', 'sin nombre'].includes(generico)) return false;

    // "hola quiero info de multifocales" no es un nombre
    if (isPhrase(limpio)) return false;

    return true;
}

/** El teléfono del chat, ya normalizado. null si es un @lid falso o basura. */
function telefonoValido(chatInfo, waId) {
    const real = chatInfo?.realPhone;
    if (real) {
        const d = String(real).replace(/\D/g, '');
        return d.length >= 8 && d.length <= 15 ? real : null;
    }

    // Sin realPhone, un chat @lid NO tiene teléfono: el id de Meta parece un
    // número (15 dígitos) pero no lo es. Mandarlo crearía una ficha incontactable.
    const id = String(waId || '');
    if (id.includes('@lid')) return null;

    const digitos = id.split('@')[0].replace(/\D/g, '');
    return digitos.length >= 8 && digitos.length <= 15 ? digitos : null;
}

let passiveModelInstance = null;

function getPassiveModel() {
    if (!passiveModelInstance) {
        passiveModelInstance = new ChatGoogleGenerativeAI({
            model: 'gemini-2.5-flash',
            // 500 no alcanzaban: el JSON pide 8 campos y uno es un `summary` de la
            // charla, así que la respuesta se cortaba a la mitad ({"clientName":
            // "Roxana", "interestTag": "Multifoc...) y JSON.parse tiraba. Cuando eso
            // pasaba, la ficha del cliente NO se creaba y no quedaba reintento.
            maxOutputTokens: 4000,
            temperature: 0.1,
            // Fuerza salida JSON válida del lado del modelo, en vez de confiar en
            // que respete el "Respond ONLY with the raw JSON" del prompt.
            json: true,
            apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY,
        });
    }
    return passiveModelInstance;
}

/**
 * Rescata los pares clave/valor de un JSON que quedó cortado a la mitad.
 * Devuelve null si no se pudo recuperar ni un campo.
 */
function rescatarJsonCortado(texto) {
    if (!texto || typeof texto !== 'string') return null;

    // Se cierra el objeto en la última coma de primer nivel: todo lo anterior
    // son pares completos.
    const ultimaComa = texto.lastIndexOf(',');
    if (ultimaComa > 0) {
        try {
            return JSON.parse(texto.slice(0, ultimaComa) + '}');
        } catch { /* sigue con el rescate campo por campo */ }
    }

    // Último recurso: los campos simples que se puedan leer sueltos.
    const rescatado = {};
    const strings = /"([a-zA-Z]+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
    let m;
    while ((m = strings.exec(texto)) !== null) rescatado[m[1]] = m[2];
    const otros = /"([a-zA-Z]+)"\s*:\s*(true|false|null)/g;
    while ((m = otros.exec(texto)) !== null) {
        rescatado[m[1]] = m[2] === 'true' ? true : m[2] === 'false' ? false : null;
    }

    return Object.keys(rescatado).length > 0 ? rescatado : null;
}

async function processPassiveExtraction(chatId, waId, profileName) {
    try {
        console.log(`  🕵️ Extractor Pasivo analizando conversación de ${profileName || waId}...`);
        
        // Obtenemos los últimos 15 mensajes
        const recentMessages = await prisma.whatsAppMessage.findMany({
            where: { chatId: chatId },
            orderBy: { createdAt: 'desc' },
            take: 15,
            select: { content: true, direction: true, createdAt: true, type: true, mediaUrl: true },
        });

        if (recentMessages.length === 0) return;

        const chatInfo = await prisma.whatsAppChat.findUnique({
            where: { id: chatId },
            include: { client: { include: { tags: true } } }
        });

        if (!chatInfo) return; 

        // Reconstruimos el texto
        const conversationText = recentMessages.reverse().map(m => {
            const dateObj = new Date(m.createdAt);
            const formatter = new Intl.DateTimeFormat('es-AR', {
                timeZone: 'America/Argentina/Cordoba',
                weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            const timestamp = `[${formatter.format(dateObj)}]`;
            const role = m.direction === 'OUTBOUND' ? 'Óptica:' : 'Cliente:';
            // Las fotos se marcan explícitas: la de la receta es el dato más
            // valioso que manda un cliente, y como "[Adjunto/Media]" el modelo no
            // podía distinguirla de un sticker. Se aclara si quedó guardada,
            // porque desde el 15/7/2026 la bajada automática está caída y la foto
            // puede estar solo en el teléfono.
            if (m.type === 'IMAGE') {
                const guardada = m.mediaUrl ? 'guardada en el sistema' : 'NO se pudo guardar, está solo en WhatsApp';
                return `${timestamp} ${role} [FOTO — ${guardada}]${m.content && !m.content.startsWith('data:') ? ' ' + m.content : ''}`;
            }
            return `${timestamp} ${role} ${m.content || '[Adjunto/Media]'}`;
        }).join('\n');

        const isKnownClient = !!chatInfo.clientId;
        const existingTags = isKnownClient && chatInfo.client && chatInfo.client.tags ? chatInfo.client.tags.map(t => t.name).join(', ') : 'Ninguna';
        const clientNameHint = profileName ? `Nombre de perfil de WA: ${profileName}` : 'Desconocido';

        const prompt = `
Eres un analista invisible de CRM para una óptica. Tu trabajo es leer la última parte de una conversación entre el vendedor (Óptica) y el Cliente y armar una "Ficha Inteligente".
Esta extracción ocurre silenciosamente.

Información actual:
- ¿El cliente ya está en la base de datos?: ${isKnownClient ? 'SÍ' : 'NO'}
- ${clientNameHint}
- Etiquetas actuales: [${existingTags}]

Conversación reciente:
${conversationText}

Your task is to return a strictly valid JSON object with the following fields:
1. "clientName": string or null. El nombre REAL de la persona (nombre de pila y/o
   apellido), tal como lo dijo en la charla. Si solo se saludó y nunca dijo su
   nombre, devolvé null — NO inventes, NO uses frases como "Hola quiero info",
   NO uses el número de teléfono, NO uses el nombre del negocio.
2. "interestTag": string or null. DEBE ser EXACTAMENTE una de estas (o null si ninguna aplica):
   "Multifocales", "Monofocales", "Bifocales", "Armazones", "Anteojos de Sol",
   "Clip-On", "Lentes de Contacto", "Cristales", "Filtro Azul", "Fotocromáticos",
   "Control Miopía", "Niños", "Alta Graduación", "Obra Social", "Proveedor".
   PROHIBIDO inventar variantes, agregar detalles o combinar ("Lentes teñidos
   (amarillo)", "Armazones (Steffany)", "Multifocal 2x1" → NO). El detalle fino
   va en "summary", no acá: la etiqueta es para filtrar, no para describir.
3. "insurance": string or null.
4. "summary": string or null.
5. "suggestedTask": object or null {"description": string, "dueDate": "YYYY-MM-DD"}.
6. "invoiceRequested": boolean.
6b. "fotoDeReceta": boolean. true SOLO si el cliente mandó una FOTO y del contexto
   surge que es su receta oftalmológica (habla de su receta, de su graduación, del
   oftalmólogo, o el vendedor le pidió la receta y él respondió con la foto). Si la
   foto es de un armazón, un comprobante de pago o cualquier otra cosa, false.
7. "shouldPostponeFollowup": boolean. (Set to true if the client explicitly asks to postpone, wait, says they don't have the prescription yet, will have it in a week/few days, is busy and asks to be contacted later, or states they cannot buy/visit until a certain future date like next week, next month, etc.)
8. "postponeUntilDate": "YYYY-MM-DD" or null. (If shouldPostponeFollowup is true, estimate the best future date to resume contact based on their message, e.g. next week = 7 days from now, next month = 30 days from now, or use the specific date they mentioned. Default to 7 days from now if unclear. Today is: ${new Date().toISOString().split('T')[0]}).

Respond ONLY with the raw JSON. No markdown.
`;

        const model = getPassiveModel();
        const res = await withTimeout(
            model.invoke([new HumanMessage(prompt)]),
            30000,
            'Gemini passive extractor timeout'
        );
        
        let resultText = contenidoATexto(res.content).replace(/```json/g, '').replace(/```/g, '').trim();
        
        let parsed;
        try {
            parsed = JSON.parse(resultText);
        } catch (e) {
            // Red de contención: si igual vuelve algo cortado, se rescata el objeto
            // más largo que sí cierre. Vale la pena aunque falten campos del final:
            // con clientName + teléfono ya se puede crear la ficha, que es lo caro
            // de perder (antes acá se hacía `return` y el cliente quedaba sin ficha).
            parsed = rescatarJsonCortado(resultText);
            if (!parsed) {
                console.error("  ❌ Error parseando JSON pasivo (irrecuperable):", resultText.slice(0, 300));
                return;
            }
            console.warn("  ⚠️ JSON pasivo cortado: se rescataron los campos completos.");
        }

        let currentClientId = chatInfo.clientId;

        // 1. Sin ficha vinculada: intentar crearla con nombre + teléfono válidos.
        //    Si no se puede, seguimos igual con el enriquecimiento del chat (resumen,
        //    postergaciones): antes acá había un `return` que dejaba mudo al extractor.
        if (!currentClientId) {
            const nombreCharla = parsed.clientName;
            const nombre = esNombreValido(nombreCharla)
                ? nombreCharla.trim()
                : (esNombreValido(profileName) ? profileName.trim() : null);
            const telefono = telefonoValido(chatInfo, waId);

            if (!nombre || !telefono) {
                console.log(`  👤 [Ficha Inteligente] Todavía sin ficha: ${!nombre ? 'falta un nombre real' : 'teléfono no utilizable'}. Se sigue con resumen y etiquetas del chat.`);
            } else {
                console.log(`  👤 [Ficha Inteligente] Creando ficha: ${nombre} (${telefono})`);
                // contactSource null a propósito: convertIntoLead llama a
                // detectContactSourceFromChat, que resuelve por el TEXTO del primer mensaje:
                // plantillas [meta...], "vi su anuncio en Google", "me recomendó".
                const alta = await convertIntoLead({
                    phone: telefono,
                    name: nombre,
                    contactSource: null,
                    interest: parsed.interestTag || 'Otros',
                    insurance: parsed.insurance || null,
                    chatId,
                }).catch(e => {
                    console.error('  ❌ [Ficha Inteligente] Error creando ficha:', e.message);
                    return null;
                });

                if (alta && alta.success && alta.contact) {
                    currentClientId = alta.contact.id;
                    console.log(`  ✅ [Ficha Inteligente] Ficha creada: ${currentClientId} · origen ${alta.contact.contactSource || 'WhatsApp'}`);
                    if (global.io) {
                        global.io.emit('lead_created', {
                            id: currentClientId,
                            name: nombre,
                            phone: telefono,
                            interest: parsed.interestTag || 'No especificado',
                            source: alta.contact.contactSource || 'WhatsApp',
                        });
                    }
                } else if (alta && alta.error) {
                    // convertIntoLead ya filtra nombres/teléfonos inválidos por su cuenta
                    console.log(`  ⏭️ [Ficha Inteligente] No se creó la ficha: ${alta.error}`);
                }
            }
        }

        // 2. Si ya hay cliente (o se acaba de crear), actualizar datos
        if (currentClientId) {
            // Actualizar Obra Social si fue detectada
            if (parsed.insurance) {
                console.log(`  🏥 [Ficha Inteligente] Actualizando Obra Social a: ${parsed.insurance}`);
                await updateClientData({ id: currentClientId, insurance: parsed.insurance }).catch(e => console.error("Error updateClientData pasivo:", e.message));
            }

            // Agregar Tag si fue detectado
            if (parsed.interestTag) {
                console.log(`  🏷️ [Ficha Inteligente] Interés detectado: ${parsed.interestTag}`);
                await addTagToClient({ clientId: currentClientId, tagName: parsed.interestTag }).catch(e => console.error("Error addTagToClient pasivo:", e.message));
            }
            
            // ── FOTO DE RECETA: el dato más valioso que manda un cliente ──
            // Queda como tarea en la ficha, NO como email: el vendedor trabaja en la
            // ficha y un mail por cada foto sería ruido. Una sola por chat: si ya
            // existe la tarea pendiente no se repite en cada mensaje nuevo.
            if (parsed.fotoDeReceta) {
                const yaAvisada = await prisma.clientTask.findFirst({
                    where: {
                        clientId: currentClientId,
                        status: 'PENDING',
                        description: { startsWith: '[RECETA POR FOTO]' },
                    },
                    select: { id: true },
                });
                if (!yaAvisada) {
                    // Si la imagen no se pudo bajar, el vendedor tiene que ir a
                    // buscarla al WhatsApp del local: la tarea se lo dice.
                    const guardada = recentMessages.some(m => m.type === 'IMAGE' && m.mediaUrl);
                    const detalle = guardada
                        ? 'La foto está en el chat del sistema.'
                        : 'La foto NO se pudo guardar: buscarla en el WhatsApp del local y subirla a la receta.';
                    console.log(`  📄 [Ficha Inteligente] Foto de receta detectada para ${currentClientId}`);
                    await prisma.clientTask.create({
                        data: {
                            clientId: currentClientId,
                            description: `[RECETA POR FOTO] El cliente mandó la foto de su receta por WhatsApp. ${detalle} Cargarla en el área de Recetas de la ficha.`,
                            type: 'TASK',
                            status: 'PENDING',
                            dueDate: new Date(),
                            createdBy: 'Sistema (Pasivo)',
                        },
                    }).catch(e => console.error('Error creando tarea de receta:', e.message));

                    if (global.io) {
                        global.io.emit('task_created', {
                            clientId: currentClientId,
                            description: '[RECETA POR FOTO] Cargar la receta que mandó el cliente',
                        });
                    }
                }
            }

            // Tarea Inteligente: UNA viva por cliente, que se ACTUALIZA.
            //
            // El anti-duplicado anterior comparaba la descripción EXACTA, y la IA
            // redacta distinto en cada ronda ("Hacer seguimiento sobre el
            // descuento…" vs "Confirmar validez del presupuesto…"): nunca
            // coincidía, así que cada tanda de mensajes de una conversación
            // creaba OTRA tarea. Medido en producción (12/8/2026): 1.273 tareas
            // pendientes de este origen, 1.011 de sobra — una clienta juntó 88.
            //
            // Ahora el extractor corre igual en cada tanda, pero pisa su propia
            // tarea pendiente en vez de apilar: mientras la conversación sigue,
            // la tarea se refina; cuando termina, queda UNA sola con la
            // conclusión final. Se busca por el prefijo (que es fijo), no por el
            // texto (que es de la IA). Solo pisa PENDING: una tarea que el
            // ejecutor de seguimientos ya reclamó (SENDING) no se toca.
            if (parsed.suggestedTask && parsed.suggestedTask.description) {
                const rawDate = parsed.suggestedTask.dueDate ? new Date(parsed.suggestedTask.dueDate) : new Date(Date.now() + 24 * 60 * 60 * 1000);
                // Asegurar que la tarea caiga a las 10:00 AM del día pautado
                rawDate.setHours(10, 0, 0, 0);
                const descripcion = `[Extracción Inteligente] ${parsed.suggestedTask.description}`;

                const tareaViva = await prisma.clientTask.findFirst({
                    where: {
                        clientId: currentClientId,
                        status: 'PENDING',
                        description: { startsWith: '[Extracción Inteligente]' }
                    },
                    select: { id: true }
                });

                if (tareaViva) {
                    console.log(`  📅 [Ficha Inteligente] Actualizando la tarea existente: ${parsed.suggestedTask.description}`);
                    // Efecto deliberado: el update cambia updatedAt, que es el
                    // token de reclamo (claimStamp) del ejecutor de seguimientos
                    // — si esta tarea estaba encolada para autoenvío, el preflight
                    // la suelta. Correcto: el cliente siguió hablando y lo que se
                    // iba a mandar quedó viejo.
                    await prisma.clientTask.update({
                        where: { id: tareaViva.id },
                        data: { description: descripcion, dueDate: rawDate }
                    }).catch(e => console.error("Error actualizando tarea pasiva:", e.message));
                } else {
                    console.log(`  📅 [Ficha Inteligente] Creando Tarea: ${parsed.suggestedTask.description}`);
                    await prisma.clientTask.create({
                        data: {
                            clientId: currentClientId,
                            description: descripcion,
                            type: 'TASK',
                            dueDate: rawDate,
                            createdBy: 'Sistema (Pasivo)'
                        }
                    }).catch(e => console.error("Error creando tarea pasiva:", e.message));
                }

                // Notificar al sistema (la UI refresca igual en ambos casos)
                if (global.io) {
                    global.io.emit('task_created', {
                        clientId: currentClientId,
                        description: descripcion
                    });
                }
            }

            // Handle postponement request
            if (parsed.shouldPostponeFollowup) {
                console.log(`  ⏱️ [Ficha Inteligente] Solicitud de postergación de seguimiento detectada para ${currentClientId}`);
                
                // 1. Delete all current active followup tasks (to stop active automated sequence)
                await prisma.clientTask.deleteMany({
                    where: {
                        clientId: currentClientId,
                        type: 'FOLLOWUP',
                        status: 'PENDING'
                    }
                }).catch(() => {});

                // 2. Add "Sin Seguimiento" tag to client
                const tag = await prisma.tag.upsert({
                    where: { name: 'Sin Seguimiento' },
                    update: {},
                    create: { name: 'Sin Seguimiento', color: '#ef4444' }
                });
                await prisma.client.update({
                    where: { id: currentClientId },
                    data: {
                        tags: {
                            connect: { id: tag.id }
                        }
                    }
                }).catch(() => {});

                // 3. Pausar seguimientos HASTA la fecha pedida, con vencimiento
                // automático (followUpPausedUntil). El esquema anterior apagaba
                // botEnabled para siempre y creaba una tarea de "Reanudación
                // Automática" que ningún proceso consumía: el cliente quedaba
                // muerto hasta que alguien se diera cuenta a mano. Ahora el bot
                // sigue pudiendo CONTESTAR si el cliente escribe (eso nunca es
                // spam) y los seguimientos proactivos se reanudan solos en la
                // fecha — sin etiqueta permanente ni tarea huérfana.
                const resumeDate = parsed.postponeUntilDate ? new Date(parsed.postponeUntilDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                resumeDate.setHours(11, 0, 0, 0);

                const updatedLabels = [...(chatInfo.chatLabels || [])].filter((l) => !l.startsWith('SEGUIMIENTO_DIA_'));
                await prisma.whatsAppChat.update({
                    where: { id: chatId },
                    data: {
                        chatLabels: updatedLabels,
                        followUpPausedUntil: resumeDate
                    }
                }).catch(() => {});

                // 5. Tarea de seguimiento para el VENDEDOR: una viva por cliente.
                // No tenía dedup: cada ronda del extractor que volvía a detectar
                // la misma postergación creaba OTRA tarea (medido en producción:
                // 46 clientes con 156 tareas donde debían ser 46). Mismo criterio
                // que la Tarea Inteligente de arriba: si ya hay una pendiente se
                // actualiza fecha y razón; la conversación termina y queda UNA.
                const humanTaskDescription = `[Seguimiento Manual] Contactar a ${chatInfo.client?.name || 'cliente'} - Razón: "${parsed.summary || 'Postergación detectada'}"`;
                const seguimientoVivo = await prisma.clientTask.findFirst({
                    where: {
                        clientId: currentClientId,
                        status: 'PENDING',
                        description: { startsWith: '[Seguimiento Manual]' }
                    },
                    select: { id: true }
                });
                if (seguimientoVivo) {
                    await prisma.clientTask.update({
                        where: { id: seguimientoVivo.id },
                        data: { description: humanTaskDescription, dueDate: resumeDate }
                    }).catch((e) => console.error("Error actualizando human task:", e.message));
                } else {
                    await prisma.clientTask.create({
                        data: {
                            clientId: currentClientId,
                            description: humanTaskDescription,
                            type: 'TASK',
                            status: 'PENDING',
                            dueDate: resumeDate,
                            createdBy: 'Sistema (Pasivo)'
                        }
                    }).catch((e) => console.error("Error creating human task:", e.message));
                }

                console.log(`  ✅ [Ficha Inteligente] Proactive followups paused. Rescheduled resume task and created human task for ${resumeDate.toLocaleDateString()}`);
            }
        }

        // 3. Evaluar si pidió Factura
        // Sin ficha no hay a quién asociarle el pedido de factura: antes esto era
        // inalcanzable por el `return` de arriba; ahora hay que blindarlo.
        if (parsed.invoiceRequested && currentClientId) {
            console.log(`  🚨 [Ficha Inteligente] Solicitud de Factura detectada para ${currentClientId}`);
            await reportInvoiceRequest({ clientId: currentClientId }).catch(e => console.error('Error reportInvoiceRequest pasivo:', e.message));
        } else if (parsed.invoiceRequested) {
            console.log('  🚨 [Ficha Inteligente] Pidió factura pero el chat todavía no tiene ficha. Queda en el resumen del chat.');
        }

        // 4. Actualizar el chatSummary (PROTEGIDO: no sobreescribir resúmenes ricos del agente)
        if (parsed.summary) {
            const existingSummary = chatInfo.chatSummary || '';
            
            if (!existingSummary || existingSummary.trim().length === 0) {
                // No hay resumen previo → escribir el nuevo
                console.log(`  📝 [Ficha Inteligente] Creando resumen inicial del chat.`);
                await prisma.whatsAppChat.update({
                    where: { id: chatId },
                    data: { chatSummary: parsed.summary }
                }).catch(e => console.error("Error update chatSummary pasivo:", e.message));
            } else if (parsed.summary.length > existingSummary.length * 1.5) {
                // El nuevo resumen es significativamente más completo → reemplazar
                console.log(`  📝 [Ficha Inteligente] Actualizando resumen del chat (más completo que el anterior).`);
                await prisma.whatsAppChat.update({
                    where: { id: chatId },
                    data: { chatSummary: parsed.summary }
                }).catch(e => console.error("Error update chatSummary pasivo:", e.message));
            } else {
                // Ya existe un resumen (probablemente del agente, más rico) → NO sobreescribir
                console.log(`  📝 [Ficha Inteligente] Resumen existente preservado (${existingSummary.length} chars). Extractor pasivo NO sobreescribe.`);
            }
        }

        // Emitir evento para refrescar UI
        if (global.io) {
            global.io.emit('chat_updated', { chatId });
        }

    } catch (err) {
        console.error('  ❌ Error Extractor Pasivo:', err.message);
    }
}

module.exports = { processPassiveExtraction };
