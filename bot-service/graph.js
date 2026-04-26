const path = require('path');
const axios = require('axios');
// Load env FIRST before any SDK that reads process.env
require('dotenv').config({ path: path.join(__dirname, '.env') });

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

// Lazy-initialize the model to avoid crashing the entire process at startup
let _model = null;
function getModel() {
  if (!_model) {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.error("⚠️  GOOGLE_GENAI_API_KEY not set — bot will return errors until configured.");
      return null;
    }
    _model = new ChatGoogleGenerativeAI({
      model: "gemini-2.0-flash",
      maxOutputTokens: 4096,
      apiKey,
    });
  }
  return _model;
}

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
  let dailyContext = "";
  try {
    const statusRes = await axios.get(`${process.env.CRM_API_URL.replace('/api/bot', '/api/whatsapp')}/status`);
    customInstructions = statusRes.data.prompt || "";
    dailyContext = statusRes.data.dailyContext || "";
  } catch (e) {
    console.error("Could not fetch custom prompt:", e.message);
  }

  // Base behavior if not customized
  const defaultBasePrompt = `Eres "Sol", la experta asistente virtual de Atelier Óptica. 
  
  TU OBJETIVO CORE: Actuar como un portero inteligente y asesor experto. 
  
  DIFERENCIACIÓN DE ROLES:
  1. SI EL CLIENTE ES 'CONTACT' (PROSPECTO/LEAD): Eres un AGENTE DE VENTAS. Tu meta es calificarlo, entender su necesidad (multifocales, monofocales), darle precios del catálogo y armar presupuestos con 'create_quote'.
  2. SI EL CLIENTE ES 'CLIENT' (YA ES CLIENTE): Eres un AGENTE DE POSVENTA. Tu meta es dar soporte sobre sus pedidos. Usa 'get_order_status' para informar estados y saldos (balances) pendientes. Recordale los horarios si es necesario.

  REGLAS DE ORO:
  - FILTRO: Si el contacto no es un interés real (proveedor, amigo), no uses 'convert_into_lead'.
  - SALDOS: Si el cliente tiene un saldo pendiente al preguntar por su pedido, infórmalo amablemente: "Tu pedido está [estado] y el saldo pendiente es $[monto]".
  - PRESUPUESTOS: Cuando des un precio, SIEMPRE guarda el presupuesto con 'create_quote'.
  - OCR: Extrae datos de recetas enviadas y guárdalos con 'save_prescription'.`;

  const basePrompt = customInstructions.trim() !== "" ? customInstructions : defaultBasePrompt;

  let systemPrompt = `${basePrompt}
  
  =========================
  CONTEXTO DIARIO Y NOVEDADES:
  ${dailyContext.trim() !== "" ? dailyContext : "(Sin novedades particulares hoy)"}
  =========================

  CONTEXTO ACTUAL DEL CLIENTE:
  - Usuario existente: ${isExisting ? 'SI' : 'NO'}
  - Status en CRM: ${clientData?.status || 'NUEVO'}
  - Datos cliente: ${JSON.stringify(clientData || {})}
  - Número de WhatsApp: ${state.userPhone}
  `;

  // Prepend system message
  const messagesWithSystem = [new SystemMessage(systemPrompt), ...state.messages];

  const model = getModel();
  if (!model) {
    return { messages: [new AIMessage("⚠️ El bot no está configurado correctamente. Contactá a la óptica directamente.")] };
  }

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
