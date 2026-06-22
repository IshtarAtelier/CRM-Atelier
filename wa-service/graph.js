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
const toolErrorTracker = new Map(); // key: chatId, value: { toolName, count, lastArgs }

function wrapToolNodeWithCycleDetection(originalToolNode, agentType) {
    return async (state) => {
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
                } else {
                    toolErrorTracker.set(chatId, { toolName, count: 1, lastArgs: toolArgs });
                }

                const current = toolErrorTracker.get(chatId);
                // Reducido de 3→2 para cortar loops más rápido
                if (current && current.count >= 2) {
                    console.error(`  🛑 [${agentType}] Tool "${toolName}" falló ${current.count} veces consecutivas para chat ${chatId}. Rompiendo ciclo y abortando.`);
                    toolErrorTracker.delete(chatId);
                    throw new Error(`Tool ${toolName} falló repetidamente. Forzando apagado silencioso.`);
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

function formatClientData(clientData, userPhone, userName, chatId, chatSummary) {
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

// ── NODO 2: AGENTE DE VENTAS (Prospectos) ──
async function salesNode(state) {
  const horaActual = new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: '2-digit', minute:'2-digit' });
  let custom = state.customPrompt || "";
  const clientInfoText = formatClientData(state.clientData, state.userPhone, state.userName, state.chatId, state.chatSummary);
  const tiemposModule = await getTiemposModule();
  const tagsModule = await getTagsModule();
  
  let basePrompt = custom;
  if (!basePrompt || basePrompt.trim().length <= 300) {
    basePrompt = DEFAULT_SALES_PROMPT;
  }

  const systemPrompt = basePrompt
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
      response = await getModel().bindTools(salesToolsList).invoke(messagesWithSystem);
    } catch (llmError) {
      console.error(`❌ salesNode: Error en invocación LLM (intento ${attempt}/${MAX_RETRIES}):`, llmError.message);
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
        console.log(`ℹ️ salesNode: Permitida respuesta vacía debido a solicitud de apagado de bot previa.`);
      } else {
        console.warn(`⚠️ salesNode: LLM devolvió respuesta vacía (intento ${attempt}/${MAX_RETRIES}).`);
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        throw new Error('LLM devolvió respuesta vacía luego de múltiples intentos');
      }
    }
    return { messages: [response] };
  }
}

// ── NODO 3: EJECUTIVO DE CUENTAS (Clientes) ──
async function executiveNode(state) {
  const horaActual = new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: '2-digit', minute:'2-digit' });
  let custom = state.customPrompt || "";
  const clientInfoText = formatClientData(state.clientData, state.userPhone, state.userName, state.chatId, state.chatSummary);
  const tiemposModule = await getTiemposModule();
  const tagsModule = await getTagsModule();
  
  const isSalesOnly = custom.includes("prospectos nuevos") || custom.includes("AGENTE DE VENTAS") || custom.includes("Óptico Contactólogo");
  let basePrompt = custom;
  if (!basePrompt || basePrompt.trim().length <= 300 || isSalesOnly) {
    basePrompt = DEFAULT_EXECUTIVE_PROMPT;
  }

  const systemPrompt = basePrompt
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
      response = await getModel().bindTools(executiveToolsList).invoke(messagesWithSystem);
    } catch (llmError) {
      console.error(`❌ executiveNode: Error en invocación LLM (intento ${attempt}/${MAX_RETRIES}):`, llmError.message);
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
        console.log(`ℹ️ executiveNode: Permitida respuesta vacía debido a solicitud de apagado de bot previa.`);
      } else {
        console.warn(`⚠️ executiveNode: LLM devolvió respuesta vacía (intento ${attempt}/${MAX_RETRIES}).`);
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        throw new Error('LLM devolvió respuesta vacía luego de múltiples intentos');
      }
    }
    return { messages: [response] };
  }
}

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
