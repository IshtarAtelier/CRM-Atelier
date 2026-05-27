const { DynamicTool, DynamicStructuredTool } = require("@langchain/core/tools");
const { z } = require("zod");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { SystemMessage, HumanMessage } = require("@langchain/core/messages");
const {
    checkExistingClient, convertIntoLead, updateClientData,
    getPriceList, getOrderStatus, createTask,
    addInteraction, savePrescription, createQuote, cancelBot, addTagToClient, disableBotForChat,
    isPhrase
} = require("./tools");

// Helper para parsear JSON de forma segura en todas las herramientas
function safeParse(input, toolName) {
    try {
        if (typeof input === 'object' && input !== null) return input;
        if (typeof input === 'string') {
            // A veces el LLM pasa un string que es un objeto literal o manda un string vacío
            if (!input.trim()) return {};
            try {
                return JSON.parse(input);
            } catch (e) {
                // Intento desesperado: si pasaron la info en string sin JSON
                return { rawInput: input };
            }
        }
        return {};
    } catch (e) {
        throw new Error(`Error de formato en '${toolName}': se esperaba un JSON válido. Recibido: ${typeof input === "string" ? input.substring(0, 80) : typeof input}. Revisá que el formato sea correcto.`);
    }
}

function getModel() {
    return new ChatGoogleGenerativeAI({
        model: 'gemini-2.5-flash',
        maxOutputTokens: 2048,
        apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY
    });
}

// ── SUB-AGENTS (Efímeros) ────────────────────────────────────────────────

// Sub-agente: Procesador de Recetas (Multimodal con File API)
// Herramienta: Guardar receta en CRM (invocada por el agente principal tras ver la imagen)
const savePrescriptionDataTool = new DynamicStructuredTool({
    schema: z.object({ chatId: z.string().optional(), clientId: z.string().optional(), tipoDeLente: z.string().optional(), odEsf: z.number().optional(), odCil: z.number().optional(), odEje: z.number().optional(), oiEsf: z.number().optional(), oiCil: z.number().optional(), oiEje: z.number().optional(), add: z.number().optional(), odDip: z.number().optional(), oiDip: z.number().optional(), origen: z.string().optional(), obraSocial: z.string().optional(), notes: z.string().optional(), userName: z.string().optional(), userPhone: z.string().optional() }).catchall(z.any()),
    name: "save_prescription_data",
    description: "Guarda los valores de una receta médica (esferas, cilindros, ejes, adición, DIP, etc.) en la ficha del cliente en el CRM. Úsala de forma MANDATORIA cuando has leído una receta en el chat y querés dejarla guardada. Requisitos: JSON estricto con 'chatId' (MANDATORIO), 'clientId' (MANDATORIO, o null/none/empty si el contacto aún no está registrado), 'tipoDeLente' ('Monofocal' o 'Multifocal'), 'odEsf' (número), 'odCil' (número), 'odEje' (entero), 'oiEsf' (número), 'oiCil' (número), 'oiEje' (entero), 'add' (adición, número, opcional), 'odDip' (DIP ojo derecho, opcional), 'oiDip' (DIP ojo izquierdo, opcional), 'origen' (opcional), 'obraSocial' (opcional), 'notes' (comentarios, opcional), 'userName' (nombre del cliente si clientId es null, opcional), 'userPhone' (teléfono si clientId es null, opcional). La herramienta buscará la foto de la receta en la caché de la charla y la subirá automáticamente.",
    func: async (input) => {
        const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
        const { HumanMessage } = require("@langchain/core/messages");
        const { savePrescription, convertIntoLead, addInteraction, isPhrase } = require("./tools");

        const parsed = safeParse(input, "save_prescription_data");
        const { chatId, clientId, tipoDeLente, odEsf, odCil, odEje, oiEsf, oiCil, oiEje, add, odDip, oiDip, origen, obraSocial, notes, userName, userPhone } = parsed;

        if (!chatId) return "Error: chatId es requerido.";

        // 1. Obtener imagen en caché
        const cacheItems = global.mediaCache?.[chatId] || [];
        
        // Buscar cuál de las imágenes en caché es una receta
        const validationModel = new ChatGoogleGenerativeAI({
            model: 'gemini-2.5-flash',
            temperature: 0,
            apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY
        });

        let confirmedPrescriptionItem = null;

        for (let i = 0; i < cacheItems.length; i++) {
            const item = cacheItems[i];
            try {
                const validationResponse = await validationModel.invoke([
                    new HumanMessage({
                        content: [
                            { type: "text", text: `Clasificá esta imagen. Respondé SOLO con "RECETA" o "NO_RECETA"` },
                            { type: "image_url", image_url: { url: `data:${item.mimeType};base64,${item.base64}` } }
                        ]
                    })
                ]);
                const classification = validationResponse.content.toString().trim().toUpperCase();
                if (classification.includes('RECETA') && !classification.includes('NO_RECETA')) {
                    confirmedPrescriptionItem = item;
                    break;
                }
            } catch (err) {
                console.error("Error validating image inside save_prescription_data tool:", err.message);
            }
        }

        const finalItem = confirmedPrescriptionItem || cacheItems[cacheItems.length - 1];

        const prescriptionData = {
            tipoDeLente,
            odEsf, odCil, odEje,
            oiEsf, oiCil, oiEje,
            add, odDip, oiDip,
            origen, obraSocial, notes
        };

        if (finalItem) {
            prescriptionData.imageBase64 = finalItem.base64;
            prescriptionData.imageMimeType = finalItem.mimeType;
        }

        let resolvedClientId = clientId;

        if (!resolvedClientId || resolvedClientId === 'null' || resolvedClientId === 'none' || resolvedClientId === '') {
            const resolvedName = (userName && userName.trim().length >= 2 && userName !== 'null' && !/^\d+$/.test(userName.trim()) && !isPhrase(userName.trim())) ? userName.trim() : null;
            
            if (!resolvedName) {
                return "Error: No se pudo crear la ficha del cliente porque no se proporcionó un nombre válido (userName). Por favor, preguntale el nombre al cliente de forma natural primero, y luego vuelve a intentar con un nombre de pila/apellido real.";
            }

            const leadResult = await convertIntoLead({
                phone: userPhone || '',
                name: resolvedName,
                contactSource: origen,
                interest: tipoDeLente || 'Otros',
                insurance: obraSocial || null,
                chatId: chatId
            });

            if (leadResult && leadResult.contact) {
                resolvedClientId = leadResult.contact.id;
                
                // Crear Hito automático
                try {
                    const hitoContent = `📍 [HITO] Prospecto registrado vía WhatsApp. Receta procesada: ${tipoDeLente || 'N/A'}. OD: Esf ${odEsf || 0} Cil ${odCil || 0} Eje ${odEje || 0}. OI: Esf ${oiEsf || 0} Cil ${oiCil || 0} Eje ${oiEje || 0}.${add ? ' Add: ' + add : ''}`;
                    await addInteraction({ clientId: resolvedClientId, type: 'NOTE', content: hitoContent });
                } catch (hitoErr) {
                    console.error('Error creando hito automático en save_prescription_data:', hitoErr.message);
                }

                // Emitir notificación al panel
                if (global.io) {
                    global.io.emit('lead_created', {
                        id: resolvedClientId,
                        name: resolvedName,
                        phone: userPhone,
                        interest: tipoDeLente || 'No especificado',
                        source: leadResult.contact.contactSource || 'Calle'
                    });
                }
            } else {
                throw new Error(`Error al crear el prospecto en el CRM: ${leadResult?.error || 'Desconocido'}`);
            }
        }

        // Guardar receta
        const result = await savePrescription({ clientId: resolvedClientId, ...prescriptionData });
        
        // Limpiar caché
        delete global.mediaCache[chatId];

        return `Receta guardada exitosamente en el CRM para el cliente ID ${resolvedClientId}. Detalle: ` + JSON.stringify(result);
    }
});

// ── HERRAMIENTAS COMUNES ────────────────────────────────────────────────

const checkExistingClientTool = new DynamicStructuredTool({
    schema: z.object({ phone: z.string().optional(), name: z.string().optional() }).catchall(z.any()),
    name: "check_existing_client",
    description: "Busca los datos del cliente por teléfono. Usa un JSON con 'phone'.",
    func: async (input) => JSON.stringify(await checkExistingClient(safeParse(input, "check_existing_client"))),
});

const getPriceListTool = new DynamicStructuredTool({
    schema: z.object({ query: z.string().optional() }).catchall(z.any()),
    name: "get_price_list",
    description: "Obtiene precios del catálogo. Usa JSON con 'category' (MONOFOCAL, MULTIFOCAL, CONTACTO, ARMAZON, CLIPON), 'search' (ej. 'clipon', 'prune') para buscar por nombre/marca/modelo, y 'botRecommended' (booleano opcional, por defecto es true si no hay search para mostrar productos estrella, y false si hay search para buscar en todo el catálogo).",
    func: async (input) => JSON.stringify(await getPriceList(safeParse(input, "get_price_list"))),
});

// ── HERRAMIENTAS DE VENTAS (Prospectos) ──────────────────────────────────

const convertIntoLeadTool = new DynamicStructuredTool({
    schema: z.object({ phone: z.string().optional(), name: z.string().optional(), contactSource: z.string().optional(), interest: z.string().optional(), chatId: z.string().optional(), insurance: z.string().optional() }).catchall(z.any()),
    name: "convert_into_lead",
    description: "Registra un prospecto nuevo. Usa JSON con 'phone' (MANDATORIO, usa el del cliente), 'name', 'contactSource', 'interest', 'chatId' (MANDATORIO), y 'insurance' (Obra Social si la tiene).",
    func: async (input) => {
        const parsed = safeParse(input, "convert_into_lead");
        if (parsed.name && isPhrase(parsed.name)) {
            return "Error: El nombre proporcionado no es un nombre de persona válido (parece ser una frase o saludo). Por favor, preguntale su nombre real al cliente de forma natural y luego vuelve a intentar.";
        }
        const result = await convertIntoLead(parsed);
        // Emitir notificación en tiempo real al panel
        if (result.success && result.contact && global.io) {
            global.io.emit('lead_created', {
                id: result.contact.id,
                name: parsed.name || result.contact.name,
                phone: parsed.phone,
                interest: parsed.interest || 'No especificado',
                source: result.contact.contactSource || 'Calle',
                hasPrescription: false,
                timestamp: new Date().toISOString(),
            });
        }
        return JSON.stringify(result);
    },
});

// ── HERRAMIENTAS EJECUTIVO (Clientes) ────────────────────────────────────

const updateClientDataTool = new DynamicStructuredTool({
    schema: z.object({ clientId: z.string().optional(), email: z.string().optional(), address: z.string().optional(), insurance: z.string().optional(), name: z.string().optional(), status: z.string().optional(), interest: z.string().optional() }).catchall(z.any()),
    name: "update_client_data",
    description: "Actualiza datos del cliente (obra social, origen). Usa JSON con 'id' y los datos.",
    func: async (input) => JSON.stringify(await updateClientData(safeParse(input, "update_client_data"))),
});

const getOrderStatusTool = new DynamicStructuredTool({
    schema: z.object({ clientId: z.string().optional() }).catchall(z.any()),
    name: "get_order_status",
    description: "Consulta estado de un pedido y saldo. Usa JSON con 'orderId' y 'clientId'.",
    func: async (input) => JSON.stringify(await getOrderStatus(safeParse(input, "get_order_status"))),
});

const createQuoteTool = new DynamicStructuredTool({
    schema: z.object({ clientId: z.string().optional(), frameModel: z.string().optional(), labColor: z.string().optional(), labTreatment: z.string().optional(), total: z.number().optional(), paid: z.number().optional(), discount: z.number().optional() }).catchall(z.any()),
    name: "create_quote",
    description: "Registra un presupuesto en el CRM. Usa JSON con 'clientId', 'items', 'total'.",
    func: async (input) => JSON.stringify(await createQuote(safeParse(input, "create_quote"))),
});

const createTaskTool = new DynamicStructuredTool({
    schema: z.object({ clientId: z.string().optional(), content: z.string().optional(), assignedTo: z.string().optional(), dueDate: z.string().optional() }).catchall(z.any()),
    name: "create_task",
    description: "Crea tarea para un humano. Usa JSON con 'clientId', 'description', 'dueDate'.",
    func: async (input) => JSON.stringify(await createTask(safeParse(input, "create_task"))),
});

const addInteractionTool = new DynamicStructuredTool({
    schema: z.object({ clientId: z.string().optional(), content: z.string().optional() }).catchall(z.any()),
    name: "add_interaction",
    description: "Registra nota/reclamo en la ficha del cliente. Usa JSON con 'clientId', 'type', 'content'.",
    func: async (input) => JSON.stringify(await addInteraction(safeParse(input, "add_interaction"))),
});

const cancelBotTool = new DynamicStructuredTool({
    schema: z.object({ clientId: z.string().optional() }).catchall(z.any()),
    name: "cancel_bot",
    description: "Desactiva el bot y pausa tus respuestas para que un humano tome el control. Usala por cualquier motivo en el que consideres importante que interceda un humano: conversación personal, proveedor, laboratorio, cliente enojado, consulta compleja, etc. Agrega la etiqueta 'Cancelar Bot'. Usa JSON con 'clientId' (o 'none') y 'waId' (el teléfono del cliente). Si solo tenés chatId y no waId, usá 'disable_bot_for_personal_chat' en su lugar.",
    func: async (input) => JSON.stringify(await cancelBot(safeParse(input, "cancel_bot"))),
});

const addTagToClientTool = new DynamicTool({
    name: "add_tags",
    description: "Usa esta herramienta para agregar una etiqueta importante al cliente a medida que obtienes datos (ej: 'OSDE', 'Urgente', 'Monofocal'). Usa JSON estricto con 'clientId' y 'tagName'.",
    func: async (input) => JSON.stringify(await addTagToClient(safeParse(input, "add_tags"))),
});

const disableBotForChatTool = new DynamicStructuredTool({
    schema: z.object({ chatId: z.string().optional() }).catchall(z.any()),
    name: "disable_bot_for_personal_chat",
    description: "ÚSALA INMEDIATAMENTE si detectás que la conversación es de carácter familiar, personal, de amistad, spam, o si es un proveedor/laboratorio B2B. Esta herramienta apaga el bot SILENCIOSAMENTE para este chat. NO escribas ningún mensaje al cliente antes de usarla. Usa JSON: chatId.",
    func: async (input) => {
        const parsed = safeParse(input, "disable_bot_for_personal_chat");
        const result = await disableBotForChat(parsed);
        return JSON.stringify(result);
    }
});

const reportComplaintTool = new DynamicStructuredTool({
    schema: z.object({ clientId: z.string().optional(), details: z.string().optional() }).catchall(z.any()),
    name: "report_complaint",
    description: "USA ESTA HERRAMIENTA OBLIGATORIAMENTE cuando un cliente tiene una queja, un problema post-venta, lentes rotas o que no ve bien. REQUISITO PREVIO: Haber recopilado los detalles del inconveniente preguntándole. Usa JSON estricto con 'clientId' (MANDATORIO) y 'details' (MANDATORIO: un resumen de todo lo que contó).",
    func: async (input) => {
        const { reportComplaint } = require("./tools");
        const parsed = safeParse(input, "report_complaint");
        const result = await reportComplaint(parsed);
        return JSON.stringify(result);
    }
});

const salesToolsList = [
    checkExistingClientTool,
    getPriceListTool,
    convertIntoLeadTool,
    savePrescriptionDataTool,
    cancelBotTool,
    addTagToClientTool,
    addInteractionTool,
    createTaskTool,
    createQuoteTool,
    disableBotForChatTool,
    reportComplaintTool
];

const executiveToolsList = [
    checkExistingClientTool,
    getPriceListTool,
    updateClientDataTool,
    getOrderStatusTool,
    createQuoteTool,
    createTaskTool,
    addInteractionTool,
    savePrescriptionDataTool,
    cancelBotTool,
    addTagToClientTool,
    disableBotForChatTool,
    reportComplaintTool
];

module.exports = {
    salesToolsList,
    executiveToolsList
};
