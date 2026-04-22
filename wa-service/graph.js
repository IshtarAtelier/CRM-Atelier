const { StateGraph, MessagesAnnotation, Annotation } = require("@langchain/langgraph");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { ToolNode } = require("@langchain/langgraph/prebuilt");
const { DynamicTool } = require("@langchain/core/tools");
const { SystemMessage, HumanMessage, AIMessage } = require("@langchain/core/messages");
const { 
  searchProducts, getOrderStatus, logBotMessage, 
  checkExistingClient, convertIntoLead, updateClientData,
  createTask, addInteraction, savePrescription, createQuote
} = require("./tools");
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// ── Model ──────────────────────────────────────────
const model = new ChatGoogleGenerativeAI({
  model: "gemini-1.5-flash",
  maxOutputTokens: 4096,
  apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY,
});

// ── Tools por Agente ───────────────────────────────
const salesTools = [
  new DynamicTool({
    name: "search_products",
    description: "Busca productos en el catálogo de la óptica. Categorías: MONOFOCAL, MULTIFOCAL, BIFOCAL, OCUPACIONAL, SOLAR, ACCESORIOS, LENTES_DE_CONTACTO.",
    func: async (input) => JSON.stringify(await searchProducts(JSON.parse(input))),
  }),
  new DynamicTool({
    name: "check_existing_client",
    description: "Verifica si ya existe una ficha de cliente por teléfono o nombre. USAR SIEMPRE ANTES DE CREAR UN NUEVO LEAD.",
    func: async (input) => JSON.stringify(await checkExistingClient(JSON.parse(input))),
  }),
  new DynamicTool({
    name: "convert_into_lead",
    description: "Registra oficialmente a un contacto como lead en el CRM. SOLO si tiene interés real. Requiere phone, name, contactSource (META/ADS/REFERIDO/WEB), interest.",
    func: async (input) => JSON.stringify(await convertIntoLead(JSON.parse(input))),
  }),
  new DynamicTool({
    name: "update_client_data",
    description: "Actualiza campos del perfil del cliente (interest, contactSource, etc.).",
    func: async (input) => JSON.stringify(await updateClientData(JSON.parse(input))),
  }),
  new DynamicTool({
    name: "save_prescription",
    description: "Guarda datos médicos extraídos de una receta (OCR). Requiere clientId y campos como sphereOD, cylinderOD, axisOD, etc.",
    func: async (input) => JSON.stringify(await savePrescription(JSON.parse(input))),
  }),
  new DynamicTool({
    name: "create_quote",
    description: "Registra un presupuesto formal en el CRM. USAR SIEMPRE que des un precio. Requiere clientId, items [{productId, quantity, price, eye}], total.",
    func: async (input) => JSON.stringify(await createQuote(JSON.parse(input))),
  }),
  new DynamicTool({
    name: "add_interaction",
    description: "Registra una nota o interacción en la ficha del cliente.",
    func: async (input) => JSON.stringify(await addInteraction(JSON.parse(input))),
  }),
];

const postSalesTools = [
  new DynamicTool({
    name: "get_order_status",
    description: "Consulta el estado y saldo de un pedido. Devuelve status, total, pagado y saldo pendiente.",
    func: async (input) => JSON.stringify(await getOrderStatus(JSON.parse(input))),
  }),
  new DynamicTool({
    name: "create_task",
    description: "Crea una tarea de seguimiento o recordatorio. Requiere clientId, description.",
    func: async (input) => JSON.stringify(await createTask(JSON.parse(input))),
  }),
  new DynamicTool({
    name: "add_interaction",
    description: "Registra un reclamo, error reportado, o nota importante en la ficha del cliente.",
    func: async (input) => JSON.stringify(await addInteraction(JSON.parse(input))),
  }),
  new DynamicTool({
    name: "check_existing_client",
    description: "Busca datos del cliente para contexto.",
    func: async (input) => JSON.stringify(await checkExistingClient(JSON.parse(input))),
  }),
];

const salesToolNode = new ToolNode(salesTools);
const postSalesToolNode = new ToolNode(postSalesTools);

// ── NODO 1: ROUTER ─────────────────────────────────
// Decide si derivar a Ventas o Posventa. No responde directamente.
async function routerNode(state) {
  const clientInfo = await checkExistingClient({ phone: state.userPhone });
  const isExisting = clientInfo.found;
  const clientData = clientInfo.client;

  // Si es CLIENT (ya compró) → Posventa. Si no → Ventas.
  const agentType = (clientData?.status === 'CLIENT') ? 'POST_SALES' : 'SALES';

  return { 
    ...state,
    agentType,
    clientData: clientData || null,
    isExisting
  };
}

// ── NODO 2: AGENTE DE VENTAS ────────────────────────
async function salesNode(state) {
  let customInstructions = state.customPrompt || "";

  const systemPrompt = `Eres "Sol", la experta asistente virtual de Atelier Óptica.
  ROL: AGENTE DE VENTAS.
  
  INSTRUCCIONES DEL DUEÑO: ${customInstructions}

  TU MISIÓN:
  1. CALIFICAR al prospecto: ¿De dónde viene? (META, ADS, REFERIDO, WEB). ¿Qué busca? (MONOFOCAL, MULTIFOCAL, etc.)
  2. DEDUPLICAR: Usa 'check_existing_client' ANTES de registrar. Si ya existe, trabaja su ficha.
  3. REGISTRAR: Si tiene interés real, usa 'convert_into_lead'. NO registrar amigos, proveedores, o errores.
  4. PRESUPUESTAR: Cuando des un precio, SIEMPRE creá presupuesto con 'create_quote'.
  5. OCR: Si mandan foto de receta, extraé datos y guardá con 'save_prescription'.
  6. NOTAS: Registrá lo importante con 'add_interaction'.

  TONO: Profesional pero cálido. Tuteo argentino. No uses emojis excesivos.
  HORARIOS: Lunes a Viernes 9:00–18:00, Sábados 9:00–13:00.
  DIRECCIÓN: Tejeda 4380, Córdoba.

  CONTEXTO:
  - Cliente existente: ${state.isExisting ? 'SÍ' : 'NO'}
  - Datos: ${JSON.stringify(state.clientData || {})}
  - WhatsApp: ${state.userPhone}`;

  const messagesWithSystem = [new SystemMessage(systemPrompt), ...state.messages];
  const response = await model.bindTools(salesTools).invoke(messagesWithSystem);
  return { messages: [response] };
}

// ── NODO 3: AGENTE DE POSVENTA ──────────────────────
async function postSalesNode(state) {
  let customInstructions = state.customPrompt || "";

  const systemPrompt = `Eres "Sol", la experta asistente virtual de Atelier Óptica.
  ROL: AGENTE DE POSVENTA / SOPORTE.

  INSTRUCCIONES DEL DUEÑO: ${customInstructions}

  TU MISIÓN:
  1. INFORMAR ESTADO: Usa 'get_order_status' para consultar pedidos. Informá status Y saldo pendiente.
  2. SALDOS: Si hay saldo, decir: "Tu pedido está [estado] y el saldo pendiente es $[monto]."
  3. RECLAMOS: Si reportan un problema, registralo con 'add_interaction' y creá tarea con 'create_task'.
  4. HORARIOS: Para retiros, informar Lunes a Viernes 9:00–18:00, Sábados 9:00–13:00.

  TONO: Empático, resolutivo. Tuteo argentino. Sin emojis excesivos.
  DIRECCIÓN: Tejeda 4380, Córdoba.

  CONTEXTO:
  - Cliente: ${JSON.stringify(state.clientData || {})}
  - WhatsApp: ${state.userPhone}`;

  const messagesWithSystem = [new SystemMessage(systemPrompt), ...state.messages];
  const response = await model.bindTools(postSalesTools).invoke(messagesWithSystem);
  return { messages: [response] };
}

// ── NODO 4: AUDITOR ─────────────────────────────────
// Revisa la respuesta del agente antes de enviarla al cliente.
async function auditorNode(state) {
  const lastMessage = state.messages[state.messages.length - 1];
  
  // Si el agente pidió tools, no auditar (dejar que ejecute)
  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    return state; // Pass through
  }

  const responseText = lastMessage.content;
  
  const auditPrompt = `Eres un auditor de calidad de Atelier Óptica. 
  Revisa este mensaje que un asistente virtual va a enviar a un cliente por WhatsApp.
  
  REGLAS DE AUDITORÍA:
  1. NO debe prometer descuentos mayores al 15%
  2. NO debe dar información médica o diagnósticos
  3. NO debe dar precios inventados (si no consultó el catálogo, no debe inventar)
  4. DEBE mantener un tono profesional y cálido
  5. NO debe tener más de 300 caracteres por mensaje (WhatsApp)
  6. NO debe revelar que es un robot/IA

  MENSAJE A AUDITAR:
  "${responseText}"

  Si el mensaje está bien, respondé EXACTAMENTE con el mismo texto sin cambios.
  Si tiene problemas, corregilo manteniendo la intención original. 
  Respondé SOLO con el mensaje final corregido, sin explicaciones ni prefijos.`;

  const auditResponse = await model.invoke([new HumanMessage(auditPrompt)]);
  
  // Replace the last message with the audited version
  const auditedContent = auditResponse.content.toString().trim();
  
  return { 
    messages: [new AIMessage(auditedContent)]
  };
}

// ── Routing Functions ───────────────────────────────
function routeAfterRouter(state) {
  return state.agentType === 'POST_SALES' ? 'postSalesAgent' : 'salesAgent';
}

function routeAfterSales(state) {
  const lastMessage = state.messages[state.messages.length - 1];
  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    return 'salesTools';
  }
  return 'auditor';
}

function routeAfterPostSales(state) {
  const lastMessage = state.messages[state.messages.length - 1];
  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    return 'postSalesTools';
  }
  return 'auditor';
}

// ── Build the Multi-Agent Graph ─────────────────────
const GraphAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  userPhone: Annotation({ reducer: (_, v) => v, default: () => "" }),
  userName: Annotation({ reducer: (_, v) => v, default: () => "" }),
  agentType: Annotation({ reducer: (_, v) => v, default: () => "SALES" }),
  clientData: Annotation({ reducer: (_, v) => v, default: () => null }),
  isExisting: Annotation({ reducer: (_, v) => v, default: () => false }),
  customPrompt: Annotation({ reducer: (_, v) => v, default: () => "" }),
});

const workflow = new StateGraph(GraphAnnotation)
  // Nodes
  .addNode("router", routerNode)
  .addNode("salesAgent", salesNode)
  .addNode("postSalesAgent", postSalesNode)
  .addNode("salesTools", salesToolNode)
  .addNode("postSalesTools", postSalesToolNode)
  .addNode("auditor", auditorNode)
  // Edges
  .addEdge("__start__", "router")
  .addConditionalEdges("router", routeAfterRouter)
  .addConditionalEdges("salesAgent", routeAfterSales)
  .addConditionalEdges("postSalesAgent", routeAfterPostSales)
  .addEdge("salesTools", "salesAgent")          // After tool execution, go back to agent
  .addEdge("postSalesTools", "postSalesAgent")  // After tool execution, go back to agent
  .addEdge("auditor", "__end__");               // After audit, done

const graph = workflow.compile();

module.exports = { graph };
