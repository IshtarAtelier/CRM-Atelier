const { StateGraph, MessagesAnnotation, Annotation } = require("@langchain/langgraph");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { ToolNode } = require("@langchain/langgraph/prebuilt");
const { DynamicTool } = require("@langchain/core/tools");
const { SystemMessage, HumanMessage, AIMessage } = require("@langchain/core/messages");
const { 
  getPriceList, getOrderStatus, logBotMessage, 
  checkExistingClient, convertIntoLead, updateClientData,
  createTask, addInteraction, savePrescription, createQuote
} = require("./tools");
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

let modelInstance = null;

function getModel() {
  if (!modelInstance) {
    if (!process.env.GOOGLE_GENAI_API_KEY && !process.env.GOOGLE_API_KEY) {
      console.warn('WARNING: GOOGLE_GENAI_API_KEY is not set. Bot will crash if invoked.');
    }
    modelInstance = new ChatGoogleGenerativeAI({
      model: "gemini-3-flash-preview",
      maxOutputTokens: 4096,
      apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY,
    });
  }
  return modelInstance;
}

// ── Herramientas por Especialidad (Mini-Agentes) ───

const baseTools = [
  new DynamicTool({
    name: "check_existing_client",
    description: "Busca los datos actuales del cliente por teléfono. Para entender el contexto antes de actuar.",
    func: async (input) => JSON.stringify(await checkExistingClient(JSON.parse(input))),
  }),
  new DynamicTool({
    name: "add_interaction",
    description: "Registra reclamos, notas importantes o aclaraciones médicas en la ficha del cliente.",
    func: async (input) => JSON.stringify(await addInteraction(JSON.parse(input))),
  })
];

const qualifierTools = [
  ...baseTools,
  new DynamicTool({
    name: "convert_into_lead",
    description: "Registra un nuevo prospecto. Obligatorio llenar: phone, name, contactSource (META/ADS/REFERIDO/WEB) e interest.",
    func: async (input) => JSON.stringify(await convertIntoLead(JSON.parse(input))),
  }),
  new DynamicTool({
    name: "update_client_data",
    description: "Actualiza faltantes en la ficha del cliente (como la obra social o el origen).",
    func: async (input) => JSON.stringify(await updateClientData(JSON.parse(input))),
  })
];

const prescriptionTools = [
  ...baseTools,
  new DynamicTool({
    name: "save_prescription",
    description: "Ejecuta OCR sobre una imagen para extraer campos médicos numéricos o anota texto libre sobre la graduación.",
    func: async (input) => JSON.stringify(await savePrescription(JSON.parse(input))),
  })
];

const quoterTools = [
  ...baseTools,
  new DynamicTool({
    name: "get_price_list",
    description: "Extrae tarifas autorizadas del sistema. Filtrar opcionalmente por category (MONOFOCAL, MULTIFOCAL, CONTACTO, ARMAZON).",
    func: async (input) => JSON.stringify(await getPriceList(JSON.parse(input))),
  }),
  new DynamicTool({
    name: "create_quote",
    description: "Registra en CRM el presupuesto ofrecido (monto final y modelos).",
    func: async (input) => JSON.stringify(await createQuote(JSON.parse(input))),
  })
];

const postSalesTools = [
  ...baseTools,
  new DynamicTool({
    name: "get_order_status",
    description: "Consulta estado de pago y laboratorio de pedidos previos.",
    func: async (input) => JSON.stringify(await getOrderStatus(JSON.parse(input))),
  }),
  new DynamicTool({
    name: "create_task",
    description: "Registra una solicitud para que un administrativo se comunique.",
    func: async (input) => JSON.stringify(await createTask(JSON.parse(input))),
  })
];

const qualifierToolNode = new ToolNode(qualifierTools);
const prescriptionToolNode = new ToolNode(prescriptionTools);
const quoterToolNode = new ToolNode(quoterTools);
const postSalesToolNode = new ToolNode(postSalesTools);


// ── NODO 1: ROUTER INTELIGENTE (El Recepcionista / Floor Manager) ──
async function routerNode(state) {
  // 1. Verificamos la base de datos
  const clientInfo = await checkExistingClient({ phone: state.userPhone });
  const isExisting = clientInfo.found;
  const clientData = clientInfo.client;
  const isBuyer = clientData?.status === 'CLIENT';

  const lastMsg = state.messages[state.messages.length - 1].content.toLowerCase();

  // 2. Evaluamos la intencion (Clasificador LLM o reglas robustas)
  // Como es un ruteo rápido, usamos un prompt directo al LLM para alta precisión
  const routerPrompt = `Clasifica el mensaje del usuario en UNA de las siguientes categorías EXACTAMENTE:
  1. "PRESCRIPTION" (Si menciona graduación, hipermetropía, astigmatismo, manda una foto de receta, o menciona al oftalmólogo).
  2. "QUOTER" (Si pregunta explícitamente por precios, cuánto cuesta, presupuestos, pide catálogo).
  3. "POST_SALES" (Si reclama por su pedido, pregunta cuándo llega, retiro, problemas).
  4. "QUALIFIER" (Saludos, preguntas generales, indicar de dónde viene, obra social, dudas sobre ubicación).
  
  MENSJE DEL USUARIO: "${lastMsg}"
  
  RESPONDE SÓLO CON LA PALABRA CLASIFICADA MÁS APROPIADA Y NADA MÁS.`;

  let agentType = "QUALIFIER"; // Default
  
  try {
    const classification = await getModel().invoke([new HumanMessage(routerPrompt)]);
    const result = classification.content.toString().trim().toUpperCase();
    if (result.includes("PRESCRIPTION")) agentType = "PRESCRIPTION";
    else if (result.includes("QUOTER")) agentType = "QUOTER";
    else if (result.includes("POST_SALES") || isBuyer) agentType = "POST_SALES";
  } catch (e) {
    console.warn("Clasificador falló, usando default", e);
  }

  return { ...state, agentType, clientData: clientData || null, isExisting };
}

// ── NODO 2: PRECALIFICADOR ────────────────────────
async function qualifierNode(state) {
  let custom = state.customPrompt || "";
  const clientInfoText = state.clientData ? `\n\nDATOS DEL CLIENTE EN SISTEMA:\nID (clientId): ${state.clientData.id}\nNombre: ${state.clientData.name}\nTeléfono: ${state.userPhone}` : `\n\nDATOS DEL CLIENTE EN SISTEMA:\nNo registrado aún.\nTeléfono (userPhone): ${state.userPhone}\nNombre de Perfil WA: ${state.userName}`;
  
  const systemPrompt = `Eres Ishtar, Precalificadora de Atelier Óptica. Tu trabajo es dar la bienvenida calurosamente.
  INSTRUCCIÓN DE LA ÓPTICA: ${custom}
  ${clientInfoText}
  
  OBLIGACIONES ABSOLUTAS:
  - NUNCA uses la herramienta "convert_into_lead" a menos que ya sepas el NOMBRE explícito del usuario. Si no lo sabes, PREGÚNTALO en la conversación.
  - Usa el 'Teléfono (userPhone)' provisto arriba para crear el lead.
  - Solamente cuando tengas su NOMBRE y el origen de dónde viene (Instagram, Facebook), puedes usar la herramienta.
  - Usa update_client_data si ya estaba pero faltan datos. (Necesitarás el ID del cliente provisto arriba).
  
  TONO: Amable, cálido y conciso. Respuestas MUY cortas. Si no lo tienes, pide su nombre cordialmente.
  DATOS: Local Tejeda 4380, Córdoba. L a V 9-18hs.`;

  const messagesWithSystem = [new SystemMessage(systemPrompt), ...state.messages];
  const response = await getModel().bindTools(qualifierTools).invoke(messagesWithSystem);
  return { messages: [response] };
}

// ── NODO 3: ADMISIÓN / RECETA ─────────────────────
async function prescriptionNode(state) {
  let custom = state.customPrompt || "";
  const clientInfoText = state.clientData ? `\n\nDATOS DEL CLIENTE EN SISTEMA:\nID (clientId): ${state.clientData.id}\nNombre: ${state.clientData.name}\nTeléfono: ${state.userPhone}` : `\n\nDATOS DEL CLIENTE EN SISTEMA:\nNo registrado aún.\nTeléfono (userPhone): ${state.userPhone}\nNombre de Perfil WA: ${state.userName}`;
  
  const systemPrompt = `Eres Sol, Analista Óptica de Atelier.
  INSTRUCCIÓN DE LA ÓPTICA: ${custom}
  ${clientInfoText}
  
  OBLIGACIÓN:
  - Solo te ocupas de descifrar y registrar los datos de graduación del cliente.
  - Usa la herramienta save_prescription usando el 'ID (clientId)' provisto arriba. Si no tiene ID, dile amablemente que necesitamos sus datos primero (deriva a que te pase nombre).
  - No pases precios, simplemente dile que ya tomaste nota de su receta y si necesita algo más.
  
  TONO: Profesional pero amigable.`;

  const messagesWithSystem = [new SystemMessage(systemPrompt), ...state.messages];
  const response = await getModel().bindTools(prescriptionTools).invoke(messagesWithSystem);
  return { messages: [response] };
}

// ── NODO 4: COTIZADOR / VENTAS ────────────────────
async function quoterNode(state) {
  let custom = state.customPrompt || "";
  const clientInfoText = state.clientData ? `\n\nDATOS DEL CLIENTE EN SISTEMA:\nID (clientId): ${state.clientData.id}\nNombre: ${state.clientData.name}\nTeléfono: ${state.userPhone}` : `\n\nDATOS DEL CLIENTE EN SISTEMA:\nNo registrado aún.\nTeléfono (userPhone): ${state.userPhone}\nNombre de Perfil WA: ${state.userName}`;

  const systemPrompt = `Eres Sol, Especialista en Precios de Atelier Óptica.
  INSTRUCCIÓN DE LA ÓPTICA: ${custom}
  ${clientInfoText}
  
  OBLIGACIÓN:
  - Responde con los precios solicitados usando get_price_list para ver nuestro inventario dinámico.
  - Nombra el precio al CONTADO y la opción de FINANCIADO (cuotas).
  - SIEMPRE registra el presupuesto que le ofreces ejecutando create_quote en el CRM, usando el 'ID (clientId)' provisto arriba.
  - Llama a la acción para que pasen por el local (Tejeda 4380, Córdoba).
  
  TONO: Dinámico, cerrador de ventas pero cálido.`;

  const messagesWithSystem = [new SystemMessage(systemPrompt), ...state.messages];
  const response = await getModel().bindTools(quoterTools).invoke(messagesWithSystem);
  return { messages: [response] };
}

// ── NODO 5: POSVENTA ──────────────────────────────
async function postSalesNode(state) {
  let custom = state.customPrompt || "";
  const clientInfoText = state.clientData ? `\n\nDATOS DEL CLIENTE EN SISTEMA:\nID (clientId): ${state.clientData.id}\nNombre: ${state.clientData.name}\nTeléfono: ${state.userPhone}` : `\n\nDATOS DEL CLIENTE EN SISTEMA:\nNo registrado aún.\nTeléfono (userPhone): ${state.userPhone}\nNombre de Perfil WA: ${state.userName}`;

  const systemPrompt = `Eres Sol, Soporte Posventa de Atelier.
  INSTRUCCIÓN DE LA ÓPTICA: ${custom}
  ${clientInfoText}
  
  OBLIGACIÓN:
  - Usa get_order_status para informarle al cliente sobre su encargo.
  - Recuerda informar el Saldo Pendiente.
  - Si reclama algo, usa add_interaction y create_task para alertar a un humano, usando el 'ID (clientId)' provisto arriba.
  
  TONO: Tolerante, resolutivo y muy empático.`;

  const messagesWithSystem = [new SystemMessage(systemPrompt), ...state.messages];
  const response = await getModel().bindTools(postSalesTools).invoke(messagesWithSystem);
  return { messages: [response] };
}

// ── NODO 6: AUDITORIA ─────────────────────────────
async function auditorNode(state) {
  const lastMessage = state.messages[state.messages.length - 1];
  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) return state;

  const responseText = lastMessage.content;
  const auditPrompt = `Eres Auditor de Atelier Óptica. Corrige este mensaje antes de mandarlo a WhatsApp.
  REGLAS:
  1. NO prometer descuentos falsos.
  2. NO dar diagnósticos médicos.
  3. Tamaño máximo de mensaje corto y legible.
  4. Mantener la personalidad.
  
  TEXTO: "${responseText}"
  Si está bien, devuelve el texto exactamente igual.`;

  const auditResponse = await getModel().invoke([new HumanMessage(auditPrompt)]);
  return { messages: [new AIMessage(auditResponse.content.toString().trim())] };
}

// ── FUNCIONES CONDICIONALES DE RUTEO ────────────────

function routeAfterRouter(state) {
  if (state.agentType === 'QUALIFIER') return 'qualifierAgent';
  if (state.agentType === 'PRESCRIPTION') return 'prescriptionAgent';
  if (state.agentType === 'QUOTER') return 'quoterAgent';
  return 'postSalesAgent';
}

function processAgentReturn(state) {
  const lastMessage = state.messages[state.messages.length - 1];
  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    if (state.agentType === 'QUALIFIER') return 'qualifierTools';
    if (state.agentType === 'PRESCRIPTION') return 'prescriptionTools';
    if (state.agentType === 'QUOTER') return 'quoterTools';
    return 'postSalesTools';
  }
  return 'auditor';
}

// ── GRAFO DE AGENTES (LANGGRAPH) ─────────────────────

const GraphAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  userPhone: Annotation({ reducer: (_, v) => v, default: () => "" }),
  userName: Annotation({ reducer: (_, v) => v, default: () => "" }),
  agentType: Annotation({ reducer: (_, v) => v, default: () => "QUALIFIER" }),
  clientData: Annotation({ reducer: (_, v) => v, default: () => null }),
  isExisting: Annotation({ reducer: (_, v) => v, default: () => false }),
  customPrompt: Annotation({ reducer: (_, v) => v, default: () => "" }),
});

const workflow = new StateGraph(GraphAnnotation)
  .addNode("router", routerNode)
  
  .addNode("qualifierAgent", qualifierNode)
  .addNode("prescriptionAgent", prescriptionNode)
  .addNode("quoterAgent", quoterNode)
  .addNode("postSalesAgent", postSalesNode)
  
  .addNode("qualifierTools", qualifierToolNode)
  .addNode("prescriptionTools", prescriptionToolNode)
  .addNode("quoterTools", quoterToolNode)
  .addNode("postSalesTools", postSalesToolNode)
  
  .addNode("auditor", auditorNode)
  
  // Ruteo Inteligente
  .addEdge("__start__", "router")
  .addConditionalEdges("router", routeAfterRouter)
  
  // Regreso dinamico despues de pensar
  .addConditionalEdges("qualifierAgent", processAgentReturn)
  .addConditionalEdges("prescriptionAgent", processAgentReturn)
  .addConditionalEdges("quoterAgent", processAgentReturn)
  .addConditionalEdges("postSalesAgent", processAgentReturn)
  
  // Regreso dinamico despues de herramientas
  .addEdge("qualifierTools", "qualifierAgent")
  .addEdge("prescriptionTools", "prescriptionAgent")
  .addEdge("quoterTools", "quoterAgent")
  .addEdge("postSalesTools", "postSalesAgent")
  
  .addEdge("auditor", "__end__");

const graph = workflow.compile();
module.exports = { graph };
