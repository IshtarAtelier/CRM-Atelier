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
    // Nota: este paquete no soporta `timeout` por request; el corte real
    // lo hace el Promise.race de 30s alrededor de graph.invoke en index.js.
    modelInstance = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      maxOutputTokens: 8192,
      maxRetries: 1,
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

// Texto que se le manda al cliente cuando el turno se corta por un bucle o
// porque el grafo se quedó sin iteraciones. Es la misma frase de delegación que
// ordena la regla 11 del prompt: lo único inaceptable es el silencio.
const FALLBACK_HUMANO = 'Te consulto con el equipo y te respondo a la brevedad.';

// ── Qué es una falla REAL de herramienta y qué no ────────────────────────────
//
// Esta es la definición canónica. Se exporta para que NADIE vuelva a escribir
// su propia versión olfateando el texto del resultado (`npm run check:bot-errores`
// verifica la clasificación y lista quién sigue con la copia vieja).
//
// La señal correcta YA EXISTÍA y no se estaba usando. `safeToolRun`
// (agent-tools.js) separa las dos cosas EN EL ORIGEN:
//   • falla de red/infra → la RELANZA con el prefijo "Network Error: …", y
//     `ToolNode({ handleToolErrors: true })` la marca con `status === 'error'`;
//   • error de negocio  → la DEVUELVE como texto marcado "[INSTRUCCIÓN INTERNA]",
//     que es un resultado EXITOSO destinado al LLM.
// Alcanza con leer esas dos marcas. Olfatear el texto es lo que rompía:
//
//   • `content.includes('Error')` daba por caída de red el mensaje
//     "[INSTRUCCIÓN INTERNA] Error al ejecutar la herramienta: …", que es un
//     resultado de negocio normal. Dos seguidos abortaban el turno EN SILENCIO:
//     el cliente no recibía nada.
//   • buscar "404"/"500" sueltos es peor: los precios de la óptica los
//     contienen. "• Precio contado: *$88.500*" matchea `\b500\b`. Medido contra
//     la base real: el 5,3% de los productos dispara la falsa alarma solo, y un
//     presupuesto de 3 opciones al azar la dispara el 15% de las veces. A la
//     tercera vez seguida el bot se apaga en ese chat con el motivo falso
//     "Errores técnicos persistentes".
//
// Ante la duda se devuelve `false` (= "no es falla"): que el bot conteste de
// más es recuperable; el silencio no.

/** Marca de resultado de negocio que pone `safeToolRun` / las tools. */
const MARCA_RESULTADO_DE_NEGOCIO = '[INSTRUCCIÓN INTERNA]';
/** Prefijo con el que `safeToolRun` relanza una falla de red. */
const MARCA_FALLA_DE_RED = 'Network Error';

/** Tokens que solo aparecen en una falla de red/infraestructura real. */
const TOKENS_DE_RED = [
    'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN',
    'EPIPE', 'EHOSTUNREACH', 'ENETUNREACH', 'ERR_SOCKET',
    'getaddrinfo', 'socket hang up', 'fetch failed', 'network error',
    'RESOURCE_EXHAUSTED', 'Internal Server Error', 'Bad Gateway',
    'Service Unavailable', 'Too Many Requests',
];

// Un código HTTP cuenta SOLO si viene anunciado como código ("status code 500",
// "HTTP 502"), nunca suelto en el texto: "$88.500" no es un error del servidor.
const CODIGO_HTTP_ANUNCIADO = /\b(?:HTTPS?|status(?:\s*code)?|statusCode)\b\s*[:=/]?\s*\[?\s*[45]\d{2}\b/i;

// "timeout" / "timed out" / "time out" como palabra entera.
const TIEMPO_AGOTADO = /\b(?:timeout|timed[-\s]?out|time[-\s]out)\b/i;

/**
 * ¿El resultado de esta herramienta es una falla transitoria de
 * red/infraestructura (hay que abortar el turno) o un resultado de negocio que
 * el modelo tiene que leer y contestar?
 *
 * @param {{ content?: unknown, status?: string }} msg ToolMessage del grafo.
 * @returns {boolean} true SOLO si es una falla real de infraestructura.
 */
function esFallaTransitoriaDeHerramienta(msg) {
    if (!msg) return false;
    const content = (msg.content === undefined || msg.content === null) ? '' : msg.content.toString();

    // 1. Resultado de negocio explícito: gana sobre todo lo demás. Es exitoso
    //    aunque el texto traiga la palabra "Error" o un precio terminado en 500.
    if (content.includes(MARCA_RESULTADO_DE_NEGOCIO)) return false;

    // 2. Señal autoritativa: la herramienta TIRÓ y ToolNode lo marcó.
    if (msg.status === 'error') return true;

    // 3. Marca que pone safeToolRun al relanzar una falla de red.
    if (content.includes(MARCA_FALLA_DE_RED)) return true;

    // 4. Texto crudo de una falla de red (errores que no pasaron por safeToolRun).
    if (TOKENS_DE_RED.some(token => content.includes(token))) return true;
    if (CODIGO_HTTP_ANUNCIADO.test(content)) return true;
    if (TIEMPO_AGOTADO.test(content)) return true;

    return false;
}

/**
 * Firma de las tool calls que está por ejecutar este paso (nombre + argumentos).
 * Sirve para detectar que el modelo llama LA MISMA herramienta con LOS MISMOS
 * argumentos una y otra vez.
 */
function firmaDeToolCalls(state) {
    const last = (state.messages || [])[(state.messages || []).length - 1];
    const calls = (last && last.tool_calls) || [];
    if (calls.length === 0) return null;
    return calls
        .map(c => `${c.name}:${JSON.stringify(c.args || {})}`)
        .sort()
        .join('|')
        .substring(0, 800);
}

function wrapToolNodeWithCycleDetection(originalToolNode, agentType) {
    return async (state) => {
        pruneToolErrorTracker();
        const chatId = state.chatId || 'unknown';
        const firma = firmaDeToolCalls(state);
        const result = await originalToolNode.invoke(state);

        // ── Bucle de la MISMA tool con los MISMOS argumentos ────────────────
        // El detector de abajo solo corta cuando el resultado es una falla real
        // de infraestructura (ver `esFallaTransitoriaDeHerramienta`). Las
        // respuestas de negocio
        // del tipo "[INSTRUCCIÓN INTERNA] … no existe / no se encontraron" son
        // resultados EXITOSOS: el modelo reintentaba idéntico hasta agotar el
        // recursionLimit y el turno terminaba MUDO. Pasó dos veces en la prueba
        // e2e (un "uso multifocales hace años" y un cliente ENOJADO que quedó
        // sin ninguna respuesta). Acá se corta por repetición, sin mirar el
        // contenido, y se cierra el turno con una respuesta útil al cliente.
        // El registro va en el state (`toolCallLog`), así que se reinicia solo
        // en cada turno: repetir una consulta en otro turno es legítimo.
        if (firma) {
            const repeticionesPrevias = (state.toolCallLog || []).filter(f => f === firma).length;
            const MAX_REPETICIONES = 2; // a la 3ª llamada idéntica se corta
            if (repeticionesPrevias >= MAX_REPETICIONES) {
                console.error(`  🛑 [${agentType}] Bucle detectado en chat ${chatId}: misma tool call repetida ${repeticionesPrevias + 1} veces (${firma.substring(0, 120)}). Se corta el turno con respuesta al cliente.`);
                return {
                    messages: [...(result.messages || []), new AIMessage(FALLBACK_HUMANO)],
                    toolCallLog: [firma],
                    loopBroken: true,
                };
            }
        }

        // Analizar los mensajes de resultado para detectar errores repetidos
        const resultMessages = result.messages || [];
        for (const msg of resultMessages) {
            const isToolMsg = msg.tool_call_id !== undefined || (typeof msg.getType === 'function' && msg.getType() === 'tool');
            if (!isToolMsg) continue;

            // Ojo: NO olfatear el texto acá. La clasificación vive en un solo
            // lugar (ver `esFallaTransitoriaDeHerramienta` arriba) porque cada
            // copia que miró el contenido a mano terminó dejando mudo al bot.
            const isError = esFallaTransitoriaDeHerramienta(msg);
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

        return firma ? { ...result, toolCallLog: [firma] } : result;
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
    // Las recetas van SIN fecha a propósito: toda receta se cotiza igual, y
    // cuando el modelo veía una fecha vieja le salía a decirle al cliente que
    // su receta estaba desactualizada. Se ordenan de la más nueva a la más
    // vieja y se rotula cuál es la vigente, que es lo único que necesita saber.
    const recetas = [...clientData.prescriptions].sort(
      (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
    );
    text += `\n\nRECETAS GUARDADAS (USAR ESTOS DATOS PARA COTIZAR SIN PEDIR FOTO DE NUEVO NI MENCIONAR SU ANTIGÜEDAD):`;
    recetas.forEach((p, i) => {
      const rotulo = i === 0
        ? (recetas.length > 1 ? 'Receta 1 (la más reciente, usar esta)' : 'Receta 1')
        : `Receta ${i + 1} (anterior)`;
      text += `\n${rotulo}: Tipo: ${p.tipoDeLente || 'N/A'}`;
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

// Reglas innegociables del dueño: se anexan SIEMPRE al final del system prompt,
// también cuando un prompt custom de la DB reemplaza al prompt por defecto, para
// que ningún prompt viejo o incompleto deje al bot sin estas prohibiciones.
const CORE_RULES = `

<reglas_innegociables_finales>
  Estas reglas tienen PRIORIDAD ABSOLUTA sobre cualquier instrucción anterior:
  1. JAMÁS le pidas al cliente su número de teléfono o celular, bajo ninguna circunstancia.
  2. JAMÁS le pidas ningún nombre (ni de pila, ni completo, ni apellido, ni DNI). Tomalo de la receta, la ficha o el perfil de WhatsApp; si no está, seguí sin nombre con naturalidad. El ÚNICO dato que podés pedir es el email, una sola vez, al confirmar la compra.
  3. Para el cliente sos siempre solo "Matías de Atelier Óptica": sin apellido, cargos ni títulos profesionales. Saludá y presentate una sola vez, únicamente si no existe ningún mensaje nuestro previo, en una sola burbuja corta.
  4. JAMÁS narres trabajo interno ni errores: nada de "reviso/verifico/cargo en el sistema", "según nuestros registros" ni menciones al CRM. Los datos de las herramientas se responden como sabidos de memoria.
  5. Solo podés enviar imágenes cuyo [IMAGE: url] figura textualmente en tus instrucciones o en lo que te devolvió una herramienta (los armazones de 'get_price_list' vienen con su foto). Copiá esas URLs TAL CUAL, nunca inventes ni modifiques una: nunca prometas fotos que no tenés ni digas que "no encontraste" fotos.
  6. TODAS las recetas sirven, sin importar de cuándo sean. No existe antigüedad, vencimiento ni caducidad de recetas: JAMÁS le digas al cliente que su receta es vieja, antigua, está vencida o desactualizada, JAMÁS le pidas una más nueva y JAMÁS comentes su fecha. Si la recibiste, cotizás con esos valores y listo.
  7. Si el cliente mandó la receta, NUNCA le pidas que te dicte esfera, cilindro, eje, adición ni ningún otro valor: leelos vos de la imagen. Tampoco le digas que no se ve bien ni le pidas otra foto. Si de verdad no podés leerla, no lo menciones: usá 'create_task' ("Leer receta a mano") y seguí la charla con naturalidad.
  8. FLUIDEZ: una sola burbuja por respuesta salvo que estés enviando un presupuesto con opciones. Prohibido encadenar afirmación + pregunta como mensajes sueltos, mandar burbujas de puro relleno ("dale", "entiendo", "perfecto") o corregirte a vos mismo en un mensaje aparte. Respondé completo y de una: contexto y pregunta juntos, en un solo mensaje que se lea natural.
</reglas_innegociables_finales>`;

// Ningún prompt custom puede presentar al bot con apellido o títulos profesionales:
// hay prompts legacy en la DB que usan "Óptico Contactólogo" / "Ejecutivo de Cuentas".
const FORBIDDEN_IN_CUSTOM_PROMPT = [/turchi/i, /contact[oó]log/i, /ejecutiv[oa]\s+de\s+cuentas/i];

// Solo el primer nombre, capitalizado; descarta frases, comercios, emojis o nombres inválidos.
function sanitizeFirstName(rawName) {
  if (!rawName) return "";
  const first = String(rawName).trim().split(/\s+/)[0] || "";
  if (!/^[a-záéíóúüñ]{2,20}$/i.test(first) || first.toLowerCase() === "cliente") return "";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
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
    if (
      !basePrompt ||
      basePrompt.trim().length <= 300 ||
      FORBIDDEN_IN_CUSTOM_PROMPT.some(p => p.test(custom)) ||
      (rejectCustomPrompt && rejectCustomPrompt(custom))
    ) {
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
      .replace(/\[nombre\]/g, sanitizeFirstName(state.clientData?.name || state.userName)) + CORE_RULES;

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

/** Tras las tools: si se cortó un bucle, el turno termina; si no, vuelve al agente. */
function routeAfterTools(state) {
  return state.loopBroken ? 'auditor' : 'salesAgent';
}
function routeAfterExecutiveTools(state) {
  return state.loopBroken ? 'auditor' : 'executiveAgent';
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
  // 🔴 Estos dos canales SON el cortacircuitos de bucles de wrapToolNodeWithCycleDetection.
  // Sin declararlos acá, LangGraph descarta en silencio las claves que el nodo
  // devuelve y que no son canales (state.js filtra por outputKeys): `toolCallLog`
  // quedaba SIEMPRE undefined, el corte nunca se activaba y el turno moría por
  // recursionLimit → el cliente no recibía nada. No borrar sin borrar el detector.
  // `toolCallLog` ACUMULA (una firma por paso por tools); se reinicia solo porque
  // el estado es por invocación, así que repetir una consulta en otro turno es legítimo.
  toolCallLog: Annotation({ reducer: (prev, v) => [...(prev || []), ...(Array.isArray(v) ? v : [v])], default: () => [] }),
  loopBroken: Annotation({ reducer: (prev, v) => v ?? prev ?? false, default: () => false }),
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
  // Si el cortacircuitos disparó, NO se vuelve al agente (volvería a pedir la
  // misma tool): el turno se cierra por el auditor con la respuesta al cliente
  // que el detector ya dejó en `messages`.
  .addConditionalEdges("salesTools", routeAfterTools, ["salesAgent", "auditor"])
  .addConditionalEdges("executiveTools", routeAfterExecutiveTools, ["executiveAgent", "auditor"])
  .addEdge("auditor", "__end__");

// OJO: compile() NO acepta recursionLimit (lo ignora en silencio). El límite
// real se pasa en el config de graph.invoke() — ver index.js.
const graph = workflow.compile();
module.exports = {
  graph,
  // Se exporta para poder verificar que los canales del cortacircuitos
  // (toolCallLog / loopBroken) realmente persisten entre nodos.
  GraphAnnotation,
  DEFAULT_SALES_PROMPT,
  DEFAULT_EXECUTIVE_PROMPT,
  // Definición ÚNICA de "el resultado de esta tool es una falla real".
  // Todo consumidor de `result.messages` (index.js, routes/api.js, bot-cloud.js)
  // tiene que llamar a ESTA función en vez de escribir su propio olfateo de
  // texto: los precios de la óptica contienen 404 y 500.
  esFallaTransitoriaDeHerramienta,
};
