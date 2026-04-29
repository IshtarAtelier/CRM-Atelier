const { StateGraph, MessagesAnnotation, Annotation } = require("@langchain/langgraph");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { ToolNode } = require("@langchain/langgraph/prebuilt");
const { SystemMessage, HumanMessage, AIMessage } = require("@langchain/core/messages");
const { salesToolsList, executiveToolsList } = require("./agent-tools");
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

let modelInstance = null;

function getModel() {
  if (!modelInstance) {
    if (!process.env.GOOGLE_GENAI_API_KEY && !process.env.GOOGLE_API_KEY) {
      console.warn('WARNING: GOOGLE_GENAI_API_KEY is not set. Bot will crash si se invoca.');
    }
    modelInstance = new ChatGoogleGenerativeAI({
      model: "gemini-3-flash-preview",
      maxOutputTokens: 2048,
      apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY,
    });
  }
  return modelInstance;
}

const salesToolNode = new ToolNode(salesToolsList);
const executiveToolNode = new ToolNode(executiveToolsList);

// ── NODO 1: ROUTER INTELIGENTE ──
async function routerNode(state) {
  // Verificamos en DB si existe (el middleware o tools pueden haberlo actualizado, pero confiamos en clientData)
  const isClient = state.clientData && state.clientData.status === 'CLIENT';
  let agentType = isClient ? 'EXECUTIVE' : 'SALES';

  return { ...state, agentType };
}

// ── NODO 2: AGENTE DE VENTAS (Prospectos) ──
async function salesNode(state) {
  let custom = state.customPrompt || "";
  const clientInfoText = state.clientData 
    ? `\n\nDATOS DEL PROSPECTO EN SISTEMA:\nID: ${state.clientData.id}\nNombre: ${state.clientData.name}\nTeléfono: ${state.userPhone}` 
    : `\n\nDATOS:\nNo registrado. Teléfono: ${state.userPhone}\nNombre WA: ${state.userName}`;
  
  const systemPrompt = `Eres Sol, Agente de Ventas de Atelier Óptica. Atiendes a prospectos nuevos.
  INSTRUCCIÓN DE LA ÓPTICA: ${custom}
  ${clientInfoText}
  
  OBLIGACIONES:
  - Califica al prospecto. Pídele su nombre si no lo tienes.
  - Usa 'convert_into_lead' cuando tengas su nombre y sepas cómo nos conoció.
  - Si envía una receta (indicado por un texto que dice que adjuntó una imagen con URI), USA LA HERRAMIENTA 'process_prescription_subagent'.
  - Cotiza con 'get_price_list' y cierra ventas.
  - NO ejecutes tareas pesadas tú misma, confía en el resultado del sub-agente.
  
  TONO: Amable, cálido, orientador a la venta. Respuestas cortas.`;

  const messagesWithSystem = [new SystemMessage(systemPrompt), ...state.messages];
  const response = await getModel().bindTools(salesToolsList).invoke(messagesWithSystem);
  return { messages: [response] };
}

// ── NODO 3: EJECUTIVO DE CUENTAS (Clientes) ──
async function executiveNode(state) {
  let custom = state.customPrompt || "";
  const clientInfoText = `\n\nDATOS DEL CLIENTE EN SISTEMA:\nID: ${state.clientData?.id}\nNombre: ${state.clientData?.name}\nTeléfono: ${state.userPhone}`;
  
  const systemPrompt = `Eres Sol, Ejecutivo de Cuentas de Atelier Óptica. Atiendes EXCLUSIVAMENTE a clientes existentes.
  INSTRUCCIÓN DE LA ÓPTICA: ${custom}
  ${clientInfoText}
  
  OBLIGACIONES:
  - Tu prioridad es el soporte: estados de pedido ('get_order_status'), informar saldos pendientes, etc.
  - Si envía una receta nueva, USA LA HERRAMIENTA 'process_prescription_subagent' para extraerla.
  - Genera nuevas cotizaciones ('create_quote') si quiere comprar algo más.
  - Delega problemas a humanos usando 'create_task' o 'add_interaction'.
  - Mantén tu contexto limpio: delega las lecturas complejas a los sub-agentes y guíate por el resumen que te devuelven.
  
  TONO: Profesional, resolutivo, sumamente atento y empático.`;

  const messagesWithSystem = [new SystemMessage(systemPrompt), ...state.messages];
  const response = await getModel().bindTools(executiveToolsList).invoke(messagesWithSystem);
  return { messages: [response] };
}

// ── NODO 4: AUDITORIA ──
async function auditorNode(state) {
  const lastMessage = state.messages[state.messages.length - 1];
  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) return state;

  return { messages: [new AIMessage(lastMessage.content.toString().trim())] };
}

// ── FUNCIONES CONDICIONALES DE RUTEO ──

function routeAfterRouter(state) {
  return state.agentType === 'EXECUTIVE' ? 'executiveAgent' : 'salesAgent';
}

function processAgentReturn(state) {
  const lastMessage = state.messages[state.messages.length - 1];
  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    return state.agentType === 'EXECUTIVE' ? 'executiveTools' : 'salesTools';
  }
  return 'auditor';
}

// ── GRAFO DE AGENTES (LANGGRAPH) ──

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
  .addNode("router", routerNode)
  
  .addNode("salesAgent", salesNode)
  .addNode("executiveAgent", executiveNode)
  
  .addNode("salesTools", salesToolNode)
  .addNode("executiveTools", executiveToolNode)
  
  .addNode("auditor", auditorNode)
  
  // Ruteo Inteligente
  .addEdge("__start__", "router")
  .addConditionalEdges("router", routeAfterRouter)
  
  // Regreso dinamico despues de pensar
  .addConditionalEdges("salesAgent", processAgentReturn)
  .addConditionalEdges("executiveAgent", processAgentReturn)
  
  // Regreso dinamico despues de herramientas
  .addEdge("salesTools", "salesAgent")
  .addEdge("executiveTools", "executiveAgent")
  
  .addEdge("auditor", "__end__");

const graph = workflow.compile();
module.exports = { graph };
