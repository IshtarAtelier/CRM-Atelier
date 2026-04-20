const { StateGraph, MessagesAnnotation } = require("@langchain/langgraph");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { ToolNode } = require("@langchain/langgraph/prebuilt");
const { 
  searchProducts, 
  getOrderStatus, 
  logBotMessage, 
  checkExistingClient, 
  convertIntoLead, 
  updateClientData, 
  createTask, 
  addInteraction, 
  savePrescription,
  createQuote
} = require("./tools");
const { DynamicTool } = require("@langchain/core/tools");
const { SystemMessage, HumanMessage, AIMessage } = require("@langchain/core/messages");
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Initialize the model
const model = new ChatGoogleGenerativeAI({
  model: "gemini-1.5-flash",
  maxOutputTokens: 4096,
  apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY,
});

// Define tools for LangChain
const tools = [
  new DynamicTool({
    name: "search_products",
    description: "Busca productos en el catálogo. Categorías: MONOFOCAL, MULTIFOCAL, BIFOCAL, OCUPACIONAL, SOLAR, ACCESORIOS, LENTES_DE_CONTACTO, OTROS.",
    func: async (input) => JSON.stringify(await searchProducts(JSON.parse(input))),
  }),
  new DynamicTool({
    name: "check_existing_client",
    description: "Verifica si ya existe una ficha de cliente por teléfono o nombre. USAR SIEMPRE ANTES DE CREAR UN NUEVO LEAD.",
    func: async (input) => JSON.stringify(await checkExistingClient(JSON.parse(input))),
  }),
  new DynamicTool({
    name: "convert_into_lead",
    description: "Registra oficialmente a un cliente en el CRM. SOLO USAR SI EL CLIENTE TIENE INTERÉS REAL (No amigos, proveedores o errores). Requiere phone, name, contactSource (META, ADS, REFERIDO, WEB), interest.",
    func: async (input) => JSON.stringify(await convertIntoLead(JSON.parse(input))),
  }),
  new DynamicTool({
    name: "update_client_data",
    description: "Actualiza campos del perfil del cliente (interest, contactSource, etc.).",
    func: async (input) => JSON.stringify(await updateClientData(JSON.parse(input))),
  }),
  new DynamicTool({
    name: "get_order_status",
    description: "Consulta el estado de un pedido.",
    func: async (input) => JSON.stringify(await getOrderStatus(JSON.parse(input))),
  }),
  new DynamicTool({
    name: "create_task",
    description: "Crea una tarea de seguimiento post-venta o recordatorio. Requiere clientId, description.",
    func: async (input) => JSON.stringify(await createTask(JSON.parse(input))),
  }),
  new DynamicTool({
    name: "add_interaction",
    description: "Registra un error reportado o una nota importante en la ficha del cliente.",
    func: async (input) => JSON.stringify(await addInteraction(JSON.parse(input))),
  }),
  new DynamicTool({
    name: "save_prescription",
    description: "Guarda los datos médicos extraídos de una receta (OCR). Requiere clientId y campos médicos (sphereOD, cylinderOD, axisOD, etc.).",
    func: async (input) => JSON.stringify(await savePrescription(JSON.parse(input))),
  }),
  new DynamicTool({
    name: "create_quote",
    description: "Registra UN PRESUPUESTO formal en el CRM. USAR SIEMPRE que des un precio específico de un producto. Requiere clientId, items (array de {productId, quantity, price, eye}), total y opcional discountCash.",
    func: async (input) => JSON.stringify(await createQuote(JSON.parse(input))),
  })
];

const toolNode = new ToolNode(tools);

/**
 * Node: Router & Agent Logic
 */
async function routerNode(state) {
  // 1. Initial State: Determine if we know the client
  const clientInfo = await checkExistingClient({ phone: state.userPhone });
  const isExisting = clientInfo.found;
  const clientData = clientInfo.client;

  // 2. Fetch Dynamic Prompt from WhatsApp Server
  let customInstructions = "";
  try {
    const statusRes = await axios.get(`${process.env.CRM_API_URL.replace('/api/bot', '/api/whatsapp')}/status`);
    customInstructions = statusRes.data.prompt || "";
  } catch (e) {
    console.error("Could not fetch custom prompt:", e.message);
  }

  let systemPrompt = `Eres "Sol", la experta asistente virtual de Atelier Óptica. 
  
  INSTRUCCIONES PERSONALIZADAS DEL USUARIO:
  ${customInstructions}
  
  TU OBJETIVO CORE: Actuar como un portero inteligente y asesor experto. 
  
  REGLAS DE ORO:
  1. FILTRO: Si el contacto es un amigo, proveedor o alguien equivocado, NO crees ficha en el CRM. Responde amablemente pero no uses 'convert_into_lead'.
  2. CALIFICACIÓN: Identifica de dónde viene (META, ADS, REFERIDO) y qué busca (MONOFOCAL, MULTIFOCAL, BIFOCAL, OCUPACIONAL, SOLAR, ACCESORIOS, LENTES_DE_CONTACTO).
  3. DEDUPLICACIÓN: Usa 'check_existing_client' antes de registrar a nadie. Si ya existe, trabaja sobre su ficha.
  4. PRESUPUESTOS: Cuando des el precio de un producto, usa 'create_quote' para dejarlo guardado. Avisa al cliente: "Ya te dejé el presupuesto guardado en nuestro sistema por si querés pasar por el local".
  5. OCR: Si recibes una imagen de receta, léela con tus capacidades de visión y usa 'save_prescription' para cargar los datos.
  6. SERVICIO: Para reclamos o errores, usa 'add_interaction' para reportarlos y 'create_task' para seguimiento humano.
  
  CONTEXTO ACTUAL:
  - Usuario existente: ${isExisting ? 'SI' : 'NO'}
  - Datos cliente: ${JSON.stringify(clientData || {})}
  - Número de WhatsApp: ${state.userPhone}
  `;

  // Prepend system message
  const messagesWithSystem = [new SystemMessage(systemPrompt), ...state.messages];

  const response = await model.bindTools(tools).invoke(messagesWithSystem);
  return { messages: [response] };
}

// Build the graph
const workflow = new StateGraph(MessagesAnnotation)
  .addNode("agent", routerNode)
  .addNode("tools", toolNode)
  .addEdge("__start__", "agent")
  .addConditionalEdges("agent", (state) => {
    const lastMessage = state.messages[state.messages.length - 1];
    if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
      return "tools";
    }
    return "__end__";
  })
  .addEdge("tools", "agent");

const graph = workflow.compile();

module.exports = { graph };
