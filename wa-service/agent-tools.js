const { DynamicTool } = require("@langchain/core/tools");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { SystemMessage, HumanMessage } = require("@langchain/core/messages");
const {
    checkExistingClient, convertIntoLead, updateClientData,
    getPriceList, getOrderStatus, createTask,
    addInteraction, savePrescription, createQuote, cancelBot
} = require("./tools");

function getModel() {
    return new ChatGoogleGenerativeAI({
        model: "gemini-3-flash-preview",
        maxOutputTokens: 2048,
        apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY,
    });
}

// ── SUB-AGENTS (Efímeros) ────────────────────────────────────────────────

// Sub-agente: Procesador de Recetas (Multimodal con File API)
const processPrescriptionSubagent = new DynamicTool({
    name: "process_prescription_subagent",
    description: "Útil cuando el cliente envía la foto de una receta médica. DEBES pasar un JSON estricto con 3 campos: 'fileUri' (la URI de Gemini File API), 'mimeType' (el tipo de archivo), y 'clientId' (el ID del cliente si lo tienes, o null). El subagente analizará la imagen, guardará los datos en el CRM y te devolverá un resumen en texto de la graduación.",
    func: async (inputStr) => {
        try {
            const input = JSON.parse(inputStr);
            const { fileUri, mimeType, clientId } = input;
            
            if (!fileUri || !mimeType) return "Error: fileUri o mimeType faltantes.";

            const prompt = `Analiza esta receta óptica. Extrae los valores numéricos para Ojo Derecho (OD) y Ojo Izquierdo (OI) incluyendo Esférico, Cilíndrico y Eje. También extrae la Distancia Interpupilar (DIP) y Adición si las hay. Responde únicamente con un JSON estructurado, sin texto adicional.`;

            // Uso del SDK moderno: @google/genai
            const { GoogleGenAI } = require("@google/genai");
            const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY });

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: [
                    { fileData: { fileUri, mimeType } },
                    { text: prompt }
                ]
            });

            const textResponse = response.text;
            
            // Intentar parsear el JSON y guardarlo en el CRM
            try {
                const cleanedJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
                const prescriptionData = JSON.parse(cleanedJson);
                
                if (clientId) {
                    await savePrescription({ clientId, rawData: prescriptionData });
                    return `Sub-agente completado: La receta fue procesada y guardada en el CRM. Graduación extraída: ${JSON.stringify(prescriptionData)}. Puedes continuar con la atención al cliente.`;
                } else {
                    return `Sub-agente completado: Graduación extraída: ${JSON.stringify(prescriptionData)}. ADVERTENCIA: No se pudo guardar en el CRM porque no proporcionaste un clientId (es probable que sea un prospecto no guardado aún).`;
                }
            } catch (jsonErr) {
                return `Sub-agente completado: El análisis de la receta devolvió esto: ${textResponse}. (No se pudo estructurar automáticamente en el CRM).`;
            }
        } catch (err) {
            console.error("Error en processPrescriptionSubagent:", err);
            return `Falló el sub-agente de recetas: ${err.message}`;
        }
    }
});

// ── HERRAMIENTAS COMUNES ────────────────────────────────────────────────

const checkExistingClientTool = new DynamicTool({
    name: "check_existing_client",
    description: "Busca los datos del cliente por teléfono. Usa un JSON con 'phone'.",
    func: async (input) => JSON.stringify(await checkExistingClient(JSON.parse(input))),
});

const getPriceListTool = new DynamicTool({
    name: "get_price_list",
    description: "Obtiene precios del catálogo. Filtra por category (MONOFOCAL, MULTIFOCAL, CONTACTO, ARMAZON). Usa JSON.",
    func: async (input) => JSON.stringify(await getPriceList(JSON.parse(input))),
});

// ── HERRAMIENTAS DE VENTAS (Prospectos) ──────────────────────────────────

const convertIntoLeadTool = new DynamicTool({
    name: "convert_into_lead",
    description: "Registra un prospecto nuevo. Usa JSON: phone, name, contactSource, interest.",
    func: async (input) => JSON.stringify(await convertIntoLead(JSON.parse(input))),
});

// ── HERRAMIENTAS EJECUTIVO (Clientes) ────────────────────────────────────

const updateClientDataTool = new DynamicTool({
    name: "update_client_data",
    description: "Actualiza datos del cliente (obra social, origen). Usa JSON con 'id' y los datos.",
    func: async (input) => JSON.stringify(await updateClientData(JSON.parse(input))),
});

const getOrderStatusTool = new DynamicTool({
    name: "get_order_status",
    description: "Consulta estado de un pedido y saldo. Usa JSON con 'orderId' y 'clientId'.",
    func: async (input) => JSON.stringify(await getOrderStatus(JSON.parse(input))),
});

const createQuoteTool = new DynamicTool({
    name: "create_quote",
    description: "Registra un presupuesto en el CRM. Usa JSON con 'clientId', 'items', 'total'.",
    func: async (input) => JSON.stringify(await createQuote(JSON.parse(input))),
});

const createTaskTool = new DynamicTool({
    name: "create_task",
    description: "Crea tarea para un humano. Usa JSON con 'clientId', 'description', 'dueDate'.",
    func: async (input) => JSON.stringify(await createTask(JSON.parse(input))),
});

const addInteractionTool = new DynamicTool({
    name: "add_interaction",
    description: "Registra nota/reclamo en la ficha del cliente. Usa JSON con 'clientId', 'type', 'content'.",
    func: async (input) => JSON.stringify(await addInteraction(JSON.parse(input))),
});

const cancelBotTool = new DynamicTool({
    name: "cancel_bot",
    description: "USA ESTA HERRAMIENTA SIEMPRE QUE EL CLIENTE EMPIECE A HABLAR DE TEMAS PERSONALES, SE ENOJE, HAGA PREGUNTAS FUERA DE CONTEXTO O REQUIERA HABLAR CON UN HUMANO. Agregará la etiqueta 'Cancelar Bot' y pausará tus respuestas. Usa JSON con 'clientId' (o 'none') y 'waId' (el teléfono del cliente).",
    func: async (input) => JSON.stringify(await cancelBot(JSON.parse(input))),
});

const salesToolsList = [
    checkExistingClientTool,
    getPriceListTool,
    convertIntoLeadTool,
    processPrescriptionSubagent,
    cancelBotTool
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
    cancelBotTool
];

module.exports = {
    salesToolsList,
    executiveToolsList
};
