const { DynamicTool } = require("@langchain/core/tools");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { SystemMessage, HumanMessage } = require("@langchain/core/messages");
const {
    checkExistingClient, convertIntoLead, updateClientData,
    getPriceList, getOrderStatus, createTask,
    addInteraction, savePrescription, createQuote, cancelBot, addTagToClient, disableBotForChat
} = require("./tools");

// Helper para parsear JSON de forma segura en todas las herramientas
function safeParse(input, toolName) {
    try {
        return JSON.parse(input);
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
const processPrescriptionSubagent = new DynamicTool({
    name: "process_prescription_subagent",
    description: "Útil cuando el cliente envía la foto de una receta médica. DEBES pasar un JSON estricto con 5 campos: 'chatId', 'clientId' (si lo tienes, o null), 'context' (los últimos mensajes), 'userName', y 'userPhone'.",
    func: async (inputStr) => {
        try {
            const input = JSON.parse(inputStr);
            const { chatId, clientId, context, userName, userPhone } = input;
            
            if (!chatId) return "Error: chatId faltante.";

            console.log(`🔍 Sub-agente recetas: chatId='${chatId}', keys en mediaCache: [${Object.keys(global.mediaCache || {}).join(', ')}]`);
            const mediaData = global.mediaCache?.[chatId];
            if (!mediaData) return `Error: No se encontró la imagen en caché para chatId '${chatId}'. Keys disponibles: [${Object.keys(global.mediaCache || {}).join(', ')}]. Pídele al usuario que reenvíe la receta.`;

            // ── PASO 1: Validar que la imagen sea realmente una receta óptica ──
            const validationModel = new ChatGoogleGenerativeAI({
                model: 'gemini-2.5-flash',
                temperature: 0,
                apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY
            });

            const validationResponse = await validationModel.invoke([
                new HumanMessage({
                    content: [
                        { type: "text", text: `Clasificá esta imagen en UNA de estas categorías. Respondé SOLO con la palabra clave:
- RECETA: si es una receta/prescripción óptica u oftalmológica (con valores de graduación como esfera, cilindro, eje, adición, etc.)
- NO_RECETA: si es cualquier otra cosa (captura de pantalla, foto de anteojos, foto de una página web, selfie, documento no médico, etc.)

Respondé ÚNICAMENTE "RECETA" o "NO_RECETA", sin explicación.` },
                        { type: "image_url", image_url: { url: `data:${mediaData.mimeType};base64,${mediaData.base64}` } }
                    ]
                })
            ]);

            const classification = validationResponse.content.toString().trim().toUpperCase();
            console.log(`🔍 Clasificación de imagen: ${classification}`);

            if (!classification.includes('RECETA') || classification.includes('NO_RECETA')) {
                // NO es una receta — liberar caché y devolver aviso al agente
                delete global.mediaCache[chatId];
                return `[INSTRUCCIÓN INTERNA - NO COMPARTIR TEXTUALMENTE CON EL CLIENTE] La imagen enviada NO es una receta óptica. Parece ser una foto genérica, captura de pantalla u otro tipo de imagen. ACCIÓN: Respondé al cliente de forma natural. Si estaban hablando de recetas, pedile amablemente que envíe la foto de su receta óptica. Si no, continuá la conversación normalmente según el contexto. NO crees ficha ni registres datos de esta imagen.`;
            }

            // ── PASO 2: Es receta confirmada — proceder con OCR ──
            const prompt = `Analiza esta receta óptica. Extrae los valores para OD y OI (Esférico, Cilíndrico, Eje, DIP, Adición). 
Basado en estos datos, deduce el "tipoDeLente" sugerido (ej. "Multifocal" si hay Adición, "Monofocal", etc.).
REGLAS DE RECOMENDACIÓN DE ÍNDICE (ESPESOR):
Si el valor Esférico o Cilíndrico (en cualquier ojo) supera los +/- 3.00, añade una nota recomendando ofrecer cristales de Policarbonato (índice 1.59).
Si el valor supera los +/- 5.00, añade una nota recomendando fuertemente ofrecer cristales de Alto Índice (Stylis 1.67 o 1.74) por estética y reducción de espesor.
RESTRICCIÓN MI PRIMER VARILUX (MULTIFOCALES):
Si el valor numérico de la "Adición" (Add) es MENOR o IGUAL a 1.50, incluye un campo "aptoMiPrimerVarilux": true en el JSON. Si es mayor a 1.50, incluye "aptoMiPrimerVarilux": false.
RESTRICCIÓN HD MR7 ASFÉRICO (MONOFOCALES):
Si el valor Esférico es positivo (> 0) y el valor Cilíndrico es positivo y MAYOR a +4.00, el cliente NO es apto para el cristal HD MR7 Asférico. En ese caso (o si supera el rango de laboratorio) pon "aptoMr7Asferico": false. De lo contrario, pon "aptoMr7Asferico": true.
También analiza el siguiente contexto de la charla: "${context || ''}" para deducir el "origen" del contacto (ej. "Meta", "Google Ads", "Referido") y la "obraSocial" (insurance, ej. "OSDE", "Sancor", "Swiss Medical"). Si no se puede inferir, usa "Desconocido" o null.
Responde únicamente con un JSON estructurado, sin texto adicional. Incluye el campo "recomendacionIndice", "aptoMiPrimerVarilux", "aptoMr7Asferico", "origen" y "obraSocial".`;

            const model = new ChatGoogleGenerativeAI({
                model: 'gemini-2.5-flash',
                temperature: 0,
                apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY
            });

            const response = await model.invoke([
                new HumanMessage({
                    content: [
                        { type: "text", text: prompt },
                        { type: "image_url", image_url: { url: `data:${mediaData.mimeType};base64,${mediaData.base64}` } }
                    ]
                })
            ]);

            // Guardar temporalmente para adjuntarlo al envío y optimizar RAM
            const base64Data = mediaData.base64;
            const mimeTypeData = mediaData.mimeType;
            delete global.mediaCache[chatId];

            const textResponse = response.content.toString();
            
            // Intentar parsear el JSON y guardarlo en el CRM
            try {
                // Extracción robusta usando Regex por si el modelo devuelve texto adicional
                const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    throw new Error("No se encontró una estructura JSON válida en la respuesta del modelo.");
                }
                const cleanedJson = jsonMatch[0].replace(/```json/g, '').replace(/```/g, '').trim();
                const prescriptionData = JSON.parse(cleanedJson);
                
                // Adjuntar imagen para subir a Google Cloud (Firebase) / Local
                prescriptionData.imageBase64 = base64Data;
                prescriptionData.imageMimeType = mimeTypeData;
                
                if (clientId) {
                    await savePrescription({ clientId, ...prescriptionData });
                    // Formatear datos legibles para el agente (SIN IDs ni JSON crudo)
                    const resumen = `Tipo: ${prescriptionData.tipoDeLente || 'No determinado'}. OD: Esf ${prescriptionData.odEsf || 0} Cil ${prescriptionData.odCil || 0}. OI: Esf ${prescriptionData.oiEsf || 0} Cil ${prescriptionData.oiCil || 0}.${prescriptionData.add ? ` Add: ${prescriptionData.add}` : ''}${prescriptionData.recomendacionIndice ? ` Recomendación espesor: ${prescriptionData.recomendacionIndice}.` : ''}`;
                    return `[INSTRUCCIÓN INTERNA - NO COMPARTIR TEXTUALMENTE CON EL CLIENTE] Receta procesada correctamente. Graduación: ${resumen}. Apto Mi Primer Varilux: ${prescriptionData.aptoMiPrimerVarilux ? 'Sí' : 'No'}. Apto MR7: ${prescriptionData.aptoMr7Asferico ? 'Sí' : 'No'}. ACCIÓN: Procede a cotizar con 'get_price_list' usando estos datos. Respondé al cliente de forma NATURAL confirmando que revisaste su receta y pasale las opciones.`;
                } else {
                    // Delegación Total: El sub-agente crea el prospecto en el CRM directamente
                    // Validar que tengamos un nombre real antes de crear la ficha
                    const resolvedName = (userName && userName.trim().length >= 2 && userName !== 'null' && !/^\d+$/.test(userName.trim())) ? userName.trim() : null;
                    
                    if (!resolvedName) {
                        // NO crear ficha fantasma — devolver datos al agente para que pida el nombre
                        const resumenSinFicha = `Tipo: ${prescriptionData.tipoDeLente || 'No determinado'}. OD: Esf ${prescriptionData.odEsf || 0} Cil ${prescriptionData.odCil || 0}. OI: Esf ${prescriptionData.oiEsf || 0} Cil ${prescriptionData.oiCil || 0}.${prescriptionData.add ? ` Add: ${prescriptionData.add}` : ''}${prescriptionData.recomendacionIndice ? ` Recomendación espesor: ${prescriptionData.recomendacionIndice}.` : ''}`;
                        return `[INSTRUCCIÓN INTERNA - NO COMPARTIR TEXTUALMENTE CON EL CLIENTE] Receta leída correctamente. Graduación: ${resumenSinFicha}. Apto Mi Primer Varilux: ${prescriptionData.aptoMiPrimerVarilux ? 'Sí' : 'No'}. Apto MR7: ${prescriptionData.aptoMr7Asferico ? 'Sí' : 'No'}. ATENCIÓN: No se pudo crear la ficha porque no tenemos el nombre del cliente. ACCIÓN OBLIGATORIA: 1) Preguntale amablemente su nombre y apellido. 2) Una vez que te lo dé, usá 'convert_into_lead' para registrarlo. 3) Mientras tanto, podés cotizarle con 'get_price_list'.`;
                    }
                    
                    const leadResult = await convertIntoLead({ 
                        phone: userPhone, 
                        name: resolvedName, 
                        contactSource: prescriptionData.origen || 'Desconocido', 
                        interest: prescriptionData.tipoDeLente || 'Desconocido',
                        insurance: prescriptionData.obraSocial || null,
                        chatId: chatId
                    });

                    if (leadResult.success && leadResult.contact) {
                        const newClientId = leadResult.contact.id;
                        await savePrescription({ clientId: newClientId, ...prescriptionData });
                        // AUTO-CREAR HITO al registrar ficha con receta
                        try {
                            const { addInteraction } = require('./tools');
                            const hitoContent = `📍 [HITO] Prospecto registrado vía WhatsApp. Receta procesada: ${prescriptionData.tipoDeLente || 'N/A'}. OD: Esf ${prescriptionData.odEsf || 0} Cil ${prescriptionData.odCil || 0}. OI: Esf ${prescriptionData.oiEsf || 0} Cil ${prescriptionData.oiCil || 0}.${prescriptionData.add ? ' Add: ' + prescriptionData.add : ''}${prescriptionData.recomendacionIndice ? ' Recomendación: ' + prescriptionData.recomendacionIndice : ''}`;
                            await addInteraction({ clientId: newClientId, type: 'NOTE', content: hitoContent });
                        } catch (hitoErr) {
                            console.error('Error creando hito automático:', hitoErr.message);
                        }
                        // Emitir notificación al panel con datos de receta
                        if (global.io) {
                            global.io.emit('lead_created', {
                                id: newClientId,
                                name: userName || 'Cliente WhatsApp',
                                phone: userPhone,
                                interest: prescriptionData.tipoDeLente || 'No especificado',
                                source: prescriptionData.origen || 'WhatsApp',
                                hasPrescription: true,
                                prescriptionType: prescriptionData.tipoDeLente,
                                timestamp: new Date().toISOString(),
                            });
                        }
                        // Formatear datos legibles para el agente (SIN IDs ni JSON crudo)
                        const resumen = `Tipo: ${prescriptionData.tipoDeLente || 'No determinado'}. OD: Esf ${prescriptionData.odEsf || 0} Cil ${prescriptionData.odCil || 0}. OI: Esf ${prescriptionData.oiEsf || 0} Cil ${prescriptionData.oiCil || 0}.${prescriptionData.add ? ` Add: ${prescriptionData.add}` : ''}${prescriptionData.recomendacionIndice ? ` Recomendación espesor: ${prescriptionData.recomendacionIndice}.` : ''}`;
                        return `[INSTRUCCIÓN INTERNA - NO COMPARTIR TEXTUALMENTE CON EL CLIENTE] Prospecto registrado y receta guardada. Graduación: ${resumen}. Apto Mi Primer Varilux: ${prescriptionData.aptoMiPrimerVarilux ? 'Sí' : 'No'}. Apto MR7: ${prescriptionData.aptoMr7Asferico ? 'Sí' : 'No'}. ACCIÓN: Procede a cotizarle con 'get_price_list'. Respondé al cliente de forma NATURAL confirmando que revisaste su receta, mencioná el tipo de lente que necesita y empezá a cotizar. NUNCA menciones IDs, JSONs ni datos técnicos del sistema.`;
                    } else {
                        const resumenFallback = `Tipo: ${prescriptionData.tipoDeLente || 'No determinado'}. OD: Esf ${prescriptionData.odEsf || 0} Cil ${prescriptionData.odCil || 0}. OI: Esf ${prescriptionData.oiEsf || 0} Cil ${prescriptionData.oiCil || 0}.${prescriptionData.add ? ` Add: ${prescriptionData.add}` : ''}`;
                        return `[INSTRUCCIÓN INTERNA - NO COMPARTIR TEXTUALMENTE CON EL CLIENTE] Receta leída correctamente. Graduación: ${resumenFallback}. NOTA: No se pudo registrar automáticamente, usá 'convert_into_lead' para crearlo. Mientras tanto, podés avanzar cotizando con 'get_price_list'.`;
                    }
                }
            } catch (jsonErr) {
                return `[INSTRUCCIÓN INTERNA - NO COMPARTIR TEXTUALMENTE CON EL CLIENTE] No se pudo estructurar la receta automáticamente. Pedile al cliente que reenvíe la foto más nítida, bien iluminada y derecha. Decile algo como: "No llegué a leerla bien, me la podrías mandar de nuevo con un poquito más de luz?". NO digas que hubo un error técnico.`;
            }
        } catch (err) {
            console.error("Error en processPrescriptionSubagent:", err);
            return `[INSTRUCCIÓN INTERNA - NO COMPARTIR TEXTUALMENTE CON EL CLIENTE] Hubo un problema técnico al procesar la imagen. Pedile al cliente que reenvíe la foto con mejor calidad. Decile algo natural como: "No me llegó bien la foto, me la mandás de nuevo?". NUNCA menciones errores técnicos, sub-agentes ni sistemas internos.`;
        }
    }
});

// ── HERRAMIENTAS COMUNES ────────────────────────────────────────────────

const checkExistingClientTool = new DynamicTool({
    name: "check_existing_client",
    description: "Busca los datos del cliente por teléfono. Usa un JSON con 'phone'.",
    func: async (input) => JSON.stringify(await checkExistingClient(safeParse(input, "check_existing_client"))),
});

const getPriceListTool = new DynamicTool({
    name: "get_price_list",
    description: "Obtiene precios del catálogo. Filtra por category (MONOFOCAL, MULTIFOCAL, CONTACTO, ARMAZON). Usa JSON.",
    func: async (input) => JSON.stringify(await getPriceList(safeParse(input, "get_price_list"))),
});

// ── HERRAMIENTAS DE VENTAS (Prospectos) ──────────────────────────────────

const convertIntoLeadTool = new DynamicTool({
    name: "convert_into_lead",
    description: "Registra un prospecto nuevo. Usa JSON con 'phone' (MANDATORIO, usa el del cliente), 'name', 'contactSource', 'interest', 'chatId' (MANDATORIO), y 'insurance' (Obra Social si la tiene).",
    func: async (input) => {
        const parsed = safeParse(input, "convert_into_lead");
        const result = await convertIntoLead(parsed);
        // Emitir notificación en tiempo real al panel
        if (result.success && result.contact && global.io) {
            global.io.emit('lead_created', {
                id: result.contact.id,
                name: parsed.name || result.contact.name,
                phone: parsed.phone,
                interest: parsed.interest || 'No especificado',
                source: parsed.contactSource || 'WhatsApp',
                hasPrescription: false,
                timestamp: new Date().toISOString(),
            });
        }
        return JSON.stringify(result);
    },
});

// ── HERRAMIENTAS EJECUTIVO (Clientes) ────────────────────────────────────

const updateClientDataTool = new DynamicTool({
    name: "update_client_data",
    description: "Actualiza datos del cliente (obra social, origen). Usa JSON con 'id' y los datos.",
    func: async (input) => JSON.stringify(await updateClientData(safeParse(input, "update_client_data"))),
});

const getOrderStatusTool = new DynamicTool({
    name: "get_order_status",
    description: "Consulta estado de un pedido y saldo. Usa JSON con 'orderId' y 'clientId'.",
    func: async (input) => JSON.stringify(await getOrderStatus(safeParse(input, "get_order_status"))),
});

const createQuoteTool = new DynamicTool({
    name: "create_quote",
    description: "Registra un presupuesto en el CRM. Usa JSON con 'clientId', 'items', 'total'.",
    func: async (input) => JSON.stringify(await createQuote(safeParse(input, "create_quote"))),
});

const createTaskTool = new DynamicTool({
    name: "create_task",
    description: "Crea tarea para un humano. Usa JSON con 'clientId', 'description', 'dueDate'.",
    func: async (input) => JSON.stringify(await createTask(safeParse(input, "create_task"))),
});

const addInteractionTool = new DynamicTool({
    name: "add_interaction",
    description: "Registra nota/reclamo en la ficha del cliente. Usa JSON con 'clientId', 'type', 'content'.",
    func: async (input) => JSON.stringify(await addInteraction(safeParse(input, "add_interaction"))),
});

const cancelBotTool = new DynamicTool({
    name: "cancel_bot",
    description: "USA ESTA HERRAMIENTA SIEMPRE QUE EL CLIENTE EMPIECE A HABLAR DE TEMAS PERSONALES, SE ENOJE, HAGA PREGUNTAS FUERA DE CONTEXTO O REQUIERA HABLAR CON UN HUMANO. Agregará la etiqueta 'Cancelar Bot' y pausará tus respuestas. Usa JSON con 'clientId' (o 'none') y 'waId' (el teléfono del cliente).",
    func: async (input) => JSON.stringify(await cancelBot(safeParse(input, "cancel_bot"))),
});

const addTagToClientTool = new DynamicTool({
    name: "add_tags",
    description: "Usa esta herramienta para agregar una etiqueta importante al cliente a medida que obtienes datos (ej: 'OSDE', 'Urgente', 'Monofocal'). Usa JSON estricto con 'clientId' y 'tagName'.",
    func: async (input) => JSON.stringify(await addTagToClient(safeParse(input, "add_tags"))),
});

const disableBotForChatTool = new DynamicTool({
    name: "disable_bot_for_personal_chat",
    description: "ÚSALA INMEDIATAMENTE si el cliente habla de temas familiares, personales, spam, o si es un proveedor/laboratorio B2B. Esta herramienta apaga el bot para este chat. Usa JSON: chatId.",
    func: async (input) => {
        const parsed = safeParse(input, "disable_bot_for_personal_chat");
        const result = await disableBotForChat(parsed);
        return JSON.stringify(result);
    }
});

const reportComplaintTool = new DynamicTool({
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
    processPrescriptionSubagent,
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
    processPrescriptionSubagent,
    cancelBotTool,
    addTagToClientTool,
    disableBotForChatTool,
    reportComplaintTool
];

module.exports = {
    salesToolsList,
    executiveToolsList
};
