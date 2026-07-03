const { StateGraph, MessagesAnnotation, Annotation } = require("@langchain/langgraph");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { ToolNode } = require("@langchain/langgraph/prebuilt");
const { SystemMessage, AIMessage } = require("@langchain/core/messages");
const { salesToolsList, executiveToolsList } = require("./agent-tools");
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { prisma } = require('./db');
const DEFAULT_SALES_PROMPT = require('./prompts/salesPrompt');
const DEFAULT_EXECUTIVE_PROMPT = require('./prompts/executivePrompt');
const { buildContextModules } = require('./prompts/context-modules');





let modelInstance = null;

function getModel() {
  if (!modelInstance) {
    if (!process.env.GOOGLE_GENAI_API_KEY && !process.env.GOOGLE_API_KEY) {
      console.warn('WARNING: GOOGLE_GENAI_API_KEY is not set. Bot will crash si se invoca.');
    }
    modelInstance = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      maxOutputTokens: 8192,
      apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY,
    });
  }
  return modelInstance;
}

const salesToolNode = new ToolNode(salesToolsList, { handleToolErrors: true });
const executiveToolNode = new ToolNode(executiveToolsList, { handleToolErrors: true });

// ── Wrappers con detección de ciclos de error en herramientas ──
const toolErrorTracker = new Map(); // key: chatId, value: { toolName, count, lastArgs, ts }
const TRACKER_TTL_MS = 15 * 60 * 1000;

// Purga entradas viejas para que el Map no crezca indefinidamente con chats que dejaron de escribir
function pruneToolErrorTracker() {
    const now = Date.now();
    for (const [key, val] of toolErrorTracker) {
        if (now - (val.ts || 0) > TRACKER_TTL_MS) toolErrorTracker.delete(key);
    }
}

function wrapToolNodeWithCycleDetection(originalToolNode, agentType) {
    return async (state) => {
        pruneToolErrorTracker();
        const chatId = state.chatId || 'unknown';
        const result = await originalToolNode.invoke(state);

        // Analizar los mensajes de resultado para detectar errores repetidos
        const resultMessages = result.messages || [];
        for (const msg of resultMessages) {
            const isToolMsg = msg.tool_call_id !== undefined || (typeof msg.getType === 'function' && msg.getType() === 'tool');
            if (!isToolMsg) continue;

            const content = (msg.content || '').toString();
            const isError = msg.status === 'error' || content.includes('Error') || content.includes('ECONNREFUSED') || content.includes('getaddrinfo') || content.includes('timeout');
            const toolName = msg.name || msg.tool_call_id || 'unknown_tool';

            const tracker = toolErrorTracker.get(chatId);
            // Extraer los argumentos de la tool call para detectar loops exactos
            const toolArgs = JSON.stringify(msg.artifact || msg.tool_call_id || '').substring(0, 200);

            if (isError) {
                if (tracker && tracker.toolName === toolName) {
                    tracker.count++;
                    tracker.ts = Date.now();
                } else {
                    toolErrorTracker.set(chatId, { toolName, count: 1, lastArgs: toolArgs, ts: Date.now() });
                }

                const current = toolErrorTracker.get(chatId);
                // Umbral 2 para cortar loops rápido. El error se marca como transitorio:
                // el turno se aborta en silencio (el cliente no recibe nada) pero el bot
                // queda activo y reintenta cuando el cliente vuelva a escribir.
                if (current && current.count >= 2) {
                    console.error(`  🛑 [${agentType}] Tool "${toolName}" falló ${current.count} veces consecutivas para chat ${chatId}. Rompiendo ciclo y abortando turno en silencio.`);
                    toolErrorTracker.delete(chatId);
                    const cycleError = new Error(`Tool ${toolName} falló repetidamente. Turno abortado en silencio (error transitorio).`);
                    cycleError.isTransient = true;
                    throw cycleError;
                }
            } else {
                // Tool exitoso: resetear tracker
                if (tracker && tracker.toolName === toolName) {
                    toolErrorTracker.delete(chatId);
                }
            }
        }

        return result;
    };
}

const salesToolNodeWrapped = wrapToolNodeWithCycleDetection(salesToolNode, 'SALES');
const executiveToolNodeWrapped = wrapToolNodeWithCycleDetection(executiveToolNode, 'EXECUTIVE');

// ── NODO 1: ROUTER INTELIGENTE ──
async function routerNode(state) {
  const isClient = state.clientData && state.clientData.status === 'CLIENT';
  let agentType = isClient ? 'EXECUTIVE' : 'SALES';

  return { ...state, agentType };
}

async function formatClientData(clientData, userPhone, userName, chatId, chatSummary) {
  const resolvedPhone = (clientData?.phone) || userPhone || '';
  
  let summaryText = '';
  if (chatSummary) {
    summaryText = `\n══════════════════════════════════════\nRESUMEN E HITOS DE ESTE CHAT (LEER OBLIGATORIAMENTE ANTES DE RESPONDER)\n══════════════════════════════════════\n${chatSummary}\n══════════════════════════════════════\n`;
  }
  
  if (!clientData) {
    return `${summaryText}\n\nDATOS:\nNo registrado. Teléfono: ${resolvedPhone}\nNombre WA: ${userName || 'No disponible'}\nChat ID OBLIGATORIO PARA REGISTRO: ${chatId}`;
  }
  
  let text = `${summaryText}\n\nDATOS DEL CLIENTE EN SISTEMA:\nID: ${clientData.id}\nNombre: ${clientData.name}\nTeléfono: ${resolvedPhone}\nEstado: ${clientData.status}\nChat ID: ${chatId}`;
  
  if (clientData.insurance) {
    text += `\nObra Social: ${clientData.insurance} (YA REGISTRADA - NO VOLVER A PREGUNTAR)`;
  }
  
  if (clientData.interest) {
    text += `\nInterés: ${clientData.interest}`;
  }
  
  if (clientData.tags && clientData.tags.length > 0) {
    text += `\nEtiquetas: ${clientData.tags.map(t => t.name).join(', ')}`;
  }
  
  if (clientData.prescriptions && clientData.prescriptions.length > 0) {
    text += `\n\nRECETAS GUARDADAS (USAR ESTOS DATOS PARA COTIZAR SIN PEDIR FOTO DE NUEVO):`;
    clientData.prescriptions.forEach((p, i) => {
      text += `\nReceta ${i + 1} (${new Date(p.date).toLocaleDateString()}): Tipo: ${p.tipoDeLente || 'N/A'}`;
      text += `\n- OD (Ojo Derecho): Esf ${p.odEsf || 0}, Cil ${p.odCil || 0}, Eje ${p.odEje || 0}, DIP ${p.odDip || '-'}`;
      text += `\n- OI (Ojo Izquierdo): Esf ${p.oiEsf || 0}, Cil ${p.oiCil || 0}, Eje ${p.oiEje || 0}, DIP ${p.oiDip || '-'}`;
      if (p.add) text += `\n- Adición: ${p.add}`;
      if (p.recomendacionIndice) text += `\n- Recomendación de Espesor: ${p.recomendacionIndice}`;
      text += `\n- Restricciones: Apto MiPrimerVarilux: ${p.aptoMiPrimerVarilux ? 'Sí' : 'No'}, Apto MR7: ${p.aptoMr7Asferico ? 'Sí' : 'No'}`;
    });
  }

  // Obtener pedidos del cliente desde la base de datos para mostrar saldos y estados reales en la ficha
  try {
    const orders = await prisma.order.findMany({
      where: {
        clientId: clientData.id,
        isDeleted: false
      },
      include: {
        payments: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (orders && orders.length > 0) {
      text += `\n\nPEDIDOS Y PRESUPUESTOS EN FICHA DEL CLIENTE (solo referencia de estados; para SALDOS y MONTOS usá SIEMPRE la herramienta 'get_order_status', que devuelve los valores verificados del sistema):`;
      orders.forEach((o) => {
        text += `\n- Pedido N°: ${o.id}`;
        text += `\n  Tipo: ${o.orderType}`;
        text += `\n  Estado: ${o.labStatus || o.status}`;
        text += `\n  Fecha: ${new Date(o.createdAt).toLocaleDateString()}`;
      });
    }
  } catch (err) {
    console.error("Error al cargar pedidos en formatClientData:", err.message);
  }
  
  if (clientData.interactions && clientData.interactions.length > 0) {
    text += `\n\nÚLTIMAS INTERACCIONES/HITOS:`;
    clientData.interactions.forEach(i => {
      text += `\n- ${new Date(i.createdAt).toLocaleDateString()}: ${i.content}`;
    });
  }
  
  return text;
}

async function getTiemposModule() {
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: 'MANUFACTURING_TIMES' } });
    const times = setting ? JSON.parse(setting.value) : {
        monofocalStock: '~5 días hábiles',
        monofocalLab: '~10 días hábiles',
        bifocal: '~10 días hábiles',
        multifocalGrupoOptico: '~10 días hábiles',
        multifocalOptovision: '~15 a 20 días hábiles',
        contactoEsfericas: '~2 días hábiles',
        contactoToricas: 'A consultar / a pedido',
        aclaracion: 'Siempre aclara que los días son aproximados y que la óptica avisa por WhatsApp cuando están listos para retirar.'
    };

    return `
  ══════════════════════════════════════
  TIEMPOS DE CONFECCIÓN Y ENTREGAS
  ══════════════════════════════════════
  Si el cliente pregunta por tiempos de entrega o demoras, INFORMA ESTOS PLAZOS APROXIMADOS:
  - Monofocales de stock: ${times.monofocalStock}.
  - Monofocales de laboratorio (tallados/cilindros altos): ${times.monofocalLab}.
  - Bifocales: ${times.bifocal}.
  - Multifocales (Grupo Óptico): ${times.multifocalGrupoOptico}.
  - Multifocales (Opto / Optovision): ${times.multifocalOptovision}.
  - Lentes de contacto esféricas: ${times.contactoEsfericas}.
  - Lentes de contacto tóricas o especiales: ${times.contactoToricas}.
  ACLARACIÓN OBLIGATORIA: ${times.aclaracion}`;
  } catch (e) {
    return '';
  }
}

async function getTagsModule() {
  try {
    const tags = await prisma.tag.findMany({
      where: {
        NOT: [
          { autoAssignCondition: null },
          { autoAssignCondition: '' }
        ]
      }
    });
    if (!tags || tags.length === 0) return '';
    
    let rules = `
  ══════════════════════════════════════
  REGLAS DE ETIQUETADO AUTOMÁTICO (IA)
  ══════════════════════════════════════
  Además de las etiquetas obligatorias, DEBES usar la herramienta 'add_tags' para aplicar las siguientes etiquetas especiales si se cumplen estrictamente sus condiciones:`;
    for (const tag of tags) {
      if (tag.autoAssignCondition && tag.autoAssignCondition.trim().length > 0) {
        rules += `\n  - Etiqueta "${tag.name}": [CONDICIÓN: ${tag.autoAssignCondition}]`;
      }
    }
    return rules;
  } catch (e) {
    return '';
  }
}

// ── NODOS 2 y 3: AGENTE DE VENTAS (Prospectos) y EJECUTIVO DE CUENTAS (Clientes) ──
// Misma mecánica de invocación/reintentos; solo cambian el prompt por defecto,
// las herramientas y la regla para descartar un prompt custom que no corresponde al rol.
function createAgentNode({ nodeName, agentType, toolsList, defaultPrompt, rejectCustomPrompt }) {
  return async function agentNode(state) {
    const horaActual = new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: '2-digit', minute:'2-digit' });
    const custom = state.customPrompt || "";
    const clientInfoText = await formatClientData(state.clientData, state.userPhone, state.userName, state.chatId, state.chatSummary);
    const tiemposModule = await getTiemposModule();
    const tagsModule = await getTagsModule();

    let basePrompt = custom;
    if (!basePrompt || basePrompt.trim().length <= 300 || (rejectCustomPrompt && rejectCustomPrompt(custom))) {
      basePrompt = defaultPrompt;
    }

    // Módulos contextuales: solo las reglas relevantes a esta conversación.
    // El resumen persistente del chat también dispara módulos (temas ya tratados
    // siguen cargados en charlas largas o retomadas). Si el prompt (custom) no
    // tiene el placeholder, el replace no altera nada.
    const contextModules = buildContextModules({
      agentType,
      messages: state.messages,
      clientData: state.clientData,
      chatSummary: state.chatSummary,
    });

    const systemPrompt = basePrompt
      .replace(/\[MODULOS_CONTEXTUALES\]/g, contextModules)
      .replace(/\[HORA_ACTUAL\]/g, horaActual)
      .replace(/\[DATOS_CLIENTE\]/g, clientInfoText)
      .replace(/\[REGLAS_ETIQUETADO_AUTOMATICO\]/g, tagsModule)
      .replace(/\[TIEMPOS_CONFECCION\]/g, tiemposModule)
      .replace(/\[INSTRUCCIONES_CUSTOM\]/g, state.dailyContext || "")
      .replace(/\[telefono\]/g, state.userPhone || "")
      .replace(/\[nombre\]/g, state.clientData?.name || state.userName || "");

    const messagesWithSystem = [new SystemMessage(systemPrompt), ...state.messages];
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      let response;
      try {
        response = await getModel().bindTools(toolsList).invoke(messagesWithSystem);
      } catch (llmError) {
        console.error(`❌ ${nodeName}: Error en invocación LLM (intento ${attempt}/${MAX_RETRIES}):`, llmError.message);
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        throw llmError;
      }
      const hasContent = response.content && (typeof response.content === 'string' ? response.content.trim().length > 0 : response.content.length > 0);
      const hasToolCalls = response.tool_calls && response.tool_calls.length > 0;
      if (!hasContent && !hasToolCalls) {
        const hasCancelOrDisableInHistory = state.messages.some(msg =>
          msg.tool_calls && msg.tool_calls.some(call =>
            call.name === 'cancel_bot' || call.name === 'disable_bot_for_personal_chat'
          )
        );
        if (hasCancelOrDisableInHistory) {
          console.log(`ℹ️ ${nodeName}: Permitida respuesta vacía debido a solicitud de apagado de bot previa.`);
        } else {
          console.warn(`⚠️ ${nodeName}: LLM devolvió respuesta vacía (intento ${attempt}/${MAX_RETRIES}).`);
          if (attempt < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }
          throw new Error('LLM devolvió respuesta vacía luego de múltiples intentos');
        }
      }
      return { messages: [response] };
    }
  };
}

const salesNode = createAgentNode({
  nodeName: 'salesNode',
  agentType: 'sales',
  toolsList: salesToolsList,
  defaultPrompt: DEFAULT_SALES_PROMPT,
});

const executiveNode = createAgentNode({
  nodeName: 'executiveNode',
  agentType: 'executive',
  toolsList: executiveToolsList,
  defaultPrompt: DEFAULT_EXECUTIVE_PROMPT,
  // Un prompt custom escrito para el rol de ventas no debe usarse con clientes existentes
  rejectCustomPrompt: (custom) =>
    custom.includes("prospectos nuevos") || custom.includes("AGENTE DE VENTAS") || custom.includes("Óptico Contactólogo"),
});

// ── NODO 4: AUDITORIA ──
async function auditorNode(state) {
  const lastMessage = state.messages[state.messages.length - 1];
  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) return state;

  const rawContent = lastMessage.content;
  let safeContent;
    if (typeof rawContent === 'string') {
        safeContent = rawContent.trim();
    } else if (Array.isArray(rawContent)) {
        safeContent = rawContent.map(p => typeof p === 'string' ? p : (p.text || '')).join('').trim();
    } else {
        safeContent = rawContent ? String(rawContent).trim() : '';
    }
  if (!safeContent) return state;
  return { messages: [new AIMessage(safeContent)] };
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
  chatSummary: Annotation({ reducer: (_, v) => v, default: () => null }),
  customPrompt: Annotation({ reducer: (_, v) => v, default: () => "" }),
  dailyContext: Annotation({ reducer: (_, v) => v, default: () => "" }),
  chatId: Annotation({ reducer: (_, v) => v, default: () => "" }),
  waId: Annotation({ reducer: (_, v) => v, default: () => "" }),
});

const workflow = new StateGraph(GraphAnnotation)
  .addNode("router", routerNode)
  .addNode("salesAgent", salesNode)
  .addNode("executiveAgent", executiveNode)
  .addNode("salesTools", salesToolNodeWrapped)
  .addNode("executiveTools", executiveToolNodeWrapped)
  .addNode("auditor", auditorNode)
  .addEdge("__start__", "router")
  .addConditionalEdges("router", routeAfterRouter)
  .addConditionalEdges("salesAgent", processAgentReturn)
  .addConditionalEdges("executiveAgent", processAgentReturn)
  .addEdge("salesTools", "salesAgent")
  .addEdge("executiveTools", "executiveAgent")
  .addEdge("auditor", "__end__");

const graph = workflow.compile({ recursionLimit: 15 }); // Reducido de 25→15 para cortar loops más rápido
module.exports = { 
  graph,
  DEFAULT_SALES_PROMPT,
  DEFAULT_EXECUTIVE_PROMPT
};
