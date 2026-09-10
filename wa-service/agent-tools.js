const { DynamicTool, DynamicStructuredTool } = require("@langchain/core/tools");
const { z } = require("zod");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { SystemMessage, HumanMessage } = require("@langchain/core/messages");
const {
    checkExistingClient, convertIntoLead, updateClientData,
    getPriceList, getOrderStatus, createTask,
    addInteraction, savePrescription, createQuote, sendQuotePdf, sendProductPhotos,
    cancelBot, addTagToClient, disableBotForChat,
    isPhrase, reportInvoiceRequest
} = require("./tools");
const { interesSegunReceta } = require("./shared/tipo-de-lente");

// Helper para parsear JSON de forma segura en todas las herramientas
function safeParse(input, toolName) {
    try {
        if (typeof input === 'object' && input !== null) return input;
        if (typeof input === 'string') {
            // A veces el LLM pasa un string que es un objeto literal o manda un string vacío
            if (!input.trim()) return {};
            try {
                return JSON.parse(input);
            } catch (e) {
                // Intento desesperado: si pasaron la info en string sin JSON
                return { rawInput: input };
            }
        }
        return {};
    } catch (e) {
        console.error(`safeParse error en '${toolName}':`, e.message);
        return {};
    }
}

// Wrapper para que las fallas disparen el guardrail de silencio absoluto
// SOLO para errores de red/infraestructura. Errores de lógica de negocio se devuelven al LLM.
function safeToolRun(fn) {
    return async (input) => {
        try {
            const result = await fn(input);
            return typeof result === 'string' ? result : JSON.stringify(result);
        } catch (e) {
            const msg = e.message || '';
            // Errores de red/infraestructura → propagar para activar guardrail de apagado silencioso
            // Los códigos van anclados a su contexto (`status 500`, `HTTP 503`)
            // y NO sueltos: un `includes('500')` daba por caída de red la
            // excepción de negocio cuyo texto mencionara un monto — y los
            // precios de la óptica terminan en 500 todo el tiempo. Ese falso
            // positivo escalaba al guardrail y dejaba al cliente sin respuesta.
            const codigoDeError = /\b(?:status|código|code|HTTP)\s*:?\s*(?:429|500|502|503|504)\b/i.test(msg);
            const isNetworkError = msg.includes('ECONNREFUSED') || msg.includes('getaddrinfo') ||
                                   msg.includes('ETIMEDOUT') || msg.includes('ENOTFOUND') ||
                                   msg.includes('socket hang up') || msg.includes('network') ||
                                   msg.includes('fetch failed') ||
                                   msg.includes('RESOURCE_EXHAUSTED') || codigoDeError;
            if (isNetworkError) {
                console.error(`[agent-tools.js] Network error propagating to guardrail:`, msg);
                throw new Error(`Network Error: ${msg}`);
            }
            // Errores de lógica (validación, datos faltantes) → devolver como texto para que el LLM maneje
            console.warn(`[agent-tools.js] Tool business error (returning to LLM):`, msg);
            return `[INSTRUCCIÓN INTERNA] Error al ejecutar la herramienta: ${msg}. Continuá la conversación con normalidad sin mencionar errores técnicos al cliente.`;
        }
    };
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
// Herramienta: Guardar receta en CRM (invocada por el agente principal tras ver la imagen)
const savePrescriptionDataTool = new DynamicStructuredTool({
    schema: z.object({ chatId: z.string().optional(), clientId: z.string().optional(), tipoDeLente: z.string().optional(), odEsf: z.number().optional(), odCil: z.number().optional(), odEje: z.number().optional(), oiEsf: z.number().optional(), oiCil: z.number().optional(), oiEje: z.number().optional(), add: z.number().optional(), odDip: z.number().optional(), oiDip: z.number().optional(), origen: z.string().optional(), obraSocial: z.string().optional(), notes: z.string().optional(), userName: z.string().optional(), userPhone: z.string().optional() }).catchall(z.any()),
    name: "save_prescription_data",
    description: "Guarda los valores de una receta médica (esferas, cilindros, ejes, adición, DIP, etc.) en la ficha del cliente en el CRM. Úsala de forma MANDATORIA cuando has leído una receta en el chat y querés dejarla guardada. Requisitos: JSON estricto con 'chatId' (MANDATORIO), 'clientId' (MANDATORIO, o null/none/empty si el contacto aún no está registrado), 'tipoDeLente' ('Monofocal' o 'Multifocal' — ⚠️ REGLA QUE NO SE NEGOCIA: es 'Multifocal' SOLO si la receta tiene una ADICIÓN de verdad (columna 'Add'/'Adición', o una sección de 'Cerca' además de la de 'Lejos'). Una adición real está entre +0.75 y +3.50. NO es adición: la columna 'A.V.' (agudeza visual, se escribe '20/20', '20/25', '20/40'), ni el eje (0-180), ni la DIP (50-75), ni la altura. Si la receta SOLO tiene 'Lejos' y ninguna columna Add, es 'Monofocal' — por más alta que sea la graduación: una miopía de -8.00 sin adición es monofocal, y cotizarle multifocales es el peor error posible), 'odEsf' (número), 'odCil' (número), 'odEje' (entero), 'oiEsf' (número), 'oiCil' (número), 'oiEje' (entero), 'add' (adición, número, opcional — SOLO si es una adición real entre 0.75 y 3.50; si la receta no tiene columna Add ni sección de Cerca, mandá null, NUNCA el valor de A.V.), 'odDip' (DIP ojo derecho, opcional), 'oiDip' (DIP ojo izquierdo, opcional), 'origen' (opcional), 'obraSocial' (MANDATORIO: obra social que figura en la receta o que indicó el cliente, o el texto 'Particular' si no tiene o ignoró la pregunta), 'notes' (comentarios, opcional), 'userName' (nombre del cliente si clientId es null: tomalo del nombre del PACIENTE en la receta o del perfil de WhatsApp, NUNCA se lo preguntes al cliente), 'userPhone' (teléfono si clientId es null, opcional: NUNCA se lo preguntes al cliente). La herramienta buscará la foto de la receta en la caché de la charla y la subirá automáticamente.",
    func: safeToolRun(async (input) => {
        const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
        const { HumanMessage } = require("@langchain/core/messages");
        const { savePrescription, convertIntoLead, addInteraction, isPhrase, updateClientData } = require("./tools");

        const parsed = safeParse(input, "save_prescription_data");
        const { chatId, clientId, tipoDeLente, odEsf, odCil, odEje, oiEsf, oiCil, oiEje, add, odDip, oiDip, origen, obraSocial, notes, userName, userPhone } = parsed;

        if (!chatId) return "[INSTRUCCIÓN INTERNA] No pudiste guardar la receta porque falta el chatId. Reintentá pasando el chatId correcto. NO le digas nada al cliente sobre este problema y seguí la venta normalmente (cotizá con los valores que leíste).";

        // 1. Obtener imagen en caché
        const cacheItems = global.mediaCache?.[chatId] || [];
        
        // Buscar cuál de las imágenes en caché es una receta
        const validationModel = new ChatGoogleGenerativeAI({
            model: 'gemini-2.5-flash',
            temperature: 0,
            apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY
        });

        let confirmedPrescriptionItem = null;

        for (let i = 0; i < cacheItems.length; i++) {
            const item = cacheItems[i];
            try {
                const validationResponse = await validationModel.invoke([
                    new HumanMessage({
                        content: [
                            { type: "text", text: `Clasificá esta imagen. Respondé SOLO con "RECETA" o "NO_RECETA"` },
                            { type: "image_url", image_url: { url: `data:${item.mimeType};base64,${item.base64}` } }
                        ]
                    })
                ]);
                // Se pide "RECETA" o "NO_RECETA", pero el modelo contesta lo que
                // quiere. El chequeo era `includes('RECETA') && !includes('NO_RECETA')`
                // y "NO RECETA" (con ESPACIO, sin guión bajo) lo pasaba como
                // receta: incluye 'RECETA' y no incluye 'NO_RECETA'. Lo mismo
                // "no es una receta". Consecuencia: se adjuntaba a la ficha una
                // imagen que no es la receta —un comprobante de pago, la foto de
                // un armazón— como si lo fuera.
                //
                // Ahora se normaliza a letras y se exige que EMPIECE con RECETA:
                // "NORECETA" y cualquier explicación quedan afuera.
                const classification = validationResponse.content.toString().trim().toUpperCase();
                const limpio = classification.replace(/[^A-Z]/g, '');
                if (limpio.startsWith('RECETA')) {
                    confirmedPrescriptionItem = item;
                    break;
                }
            } catch (err) {
                console.error("Error validating image inside save_prescription_data tool:", err.message);
            }
        }

        const finalItem = confirmedPrescriptionItem || cacheItems[cacheItems.length - 1];

        const prescriptionData = {
            tipoDeLente,
            odEsf, odCil, odEje,
            oiEsf, oiCil, oiEje,
            add, odDip, oiDip,
            origen, obraSocial, notes
        };

        if (finalItem) {
            prescriptionData.imageBase64 = finalItem.base64;
            prescriptionData.imageMimeType = finalItem.mimeType;
        }

        let resolvedClientId = clientId;

        if (!resolvedClientId || resolvedClientId === 'null' || resolvedClientId === 'none' || resolvedClientId === '') {
            const nameDigits = userName ? userName.replace(/\D/g, '').length : 0;
            const resolvedName = (userName && userName.trim().length >= 2 && userName !== 'null' && nameDigits < 5 && !/^\d+$/.test(userName.trim()) && !isPhrase(userName.trim())) ? userName.trim() : null;
            
            if (!resolvedName) {
                return "[INSTRUCCIÓN INTERNA] La receta no se guardó todavía porque falta un nombre válido. JAMÁS le preguntes el nombre al cliente (se siente encuesta de IA, no humano). Buscá el nombre del PACIENTE en la receta que leíste, o usá el nombre real del perfil de WhatsApp, y volvé a llamar esta herramienta con ese 'userName'. Si no existe por ninguna vía, seguí cotizando normalmente sin guardar y reintentá solo si el nombre aparece solo en la charla. NO frenes la conversación. NUNCA le menciones errores ni registros.";
            }

            let phoneToUse = userPhone || '';
            if (!phoneToUse && chatId) {
                phoneToUse = chatId.split('@')[0];
            }

            const cleanPhone = phoneToUse ? phoneToUse.replace(/\D/g, '') : '';
            if (!cleanPhone || cleanPhone.length < 8 || cleanPhone.length > 15) {
                return "[INSTRUCCIÓN INTERNA] La receta no se guardó todavía porque no hay un teléfono válido. NO frenes la conversación ni interrogues al cliente por esto: seguí cotizando normalmente con los valores que leíste. Si el teléfono aparece más adelante en el contexto, reintentá guardar. NUNCA le menciones errores ni registros.";
            }

            // El interés sale de los NÚMEROS de la receta, no de la etiqueta que
            // escribió el modelo: este campo vuelve a entrar a su propio
            // contexto en la charla siguiente ("Interés: Multifocal") y un
            // error de lectura se volvía una verdad sobre la que cotizaba.
            const interesReal = interesSegunReceta(tipoDeLente, add);
            const leadResult = await convertIntoLead({
                phone: cleanPhone,
                name: resolvedName,
                contactSource: origen,
                interest: interesReal,
                insurance: obraSocial || null,
                chatId: chatId
            });

            if (leadResult && leadResult.contact) {
                resolvedClientId = leadResult.contact.id;
                
                // Crear Hito automático
                try {
                    const hitoContent = `📍 [HITO] Prospecto registrado vía WhatsApp. Receta procesada: ${interesReal}. OD: Esf ${odEsf || 0} Cil ${odCil || 0} Eje ${odEje || 0}. OI: Esf ${oiEsf || 0} Cil ${oiCil || 0} Eje ${oiEje || 0}.${add ? ' Add: ' + add : ''}`;
                    await addInteraction({ clientId: resolvedClientId, type: 'NOTE', content: hitoContent });
                } catch (hitoErr) {
                    console.error('Error creando hito automático en save_prescription_data:', hitoErr.message);
                }

                // Emitir notificación al panel
                if (global.io) {
                    global.io.emit('lead_created', {
                        id: resolvedClientId,
                        name: resolvedName,
                        phone: userPhone,
                        interest: interesReal,
                        source: leadResult.contact.contactSource || 'Calle'
                    });
                }
            } else {
                console.error('Error al crear prospecto en CRM:', leadResult?.error);
                return "[INSTRUCCIÓN INTERNA] No se pudo registrar al cliente internamente. Continuá la conversación con normalidad, cotizá los precios que te pidió y NO le menciones ningún problema técnico. Reintentá guardar más adelante.";
            }
        }

        // Guardar receta
        const result = await savePrescription({ clientId: resolvedClientId, ...prescriptionData });
        
        // Si el modelo pasó obraSocial, persistirla en el cliente para que no la vuelva a preguntar
        if (obraSocial && resolvedClientId) {
            try {
                await updateClientData({ id: resolvedClientId, insurance: obraSocial });
            } catch (insErr) {
                console.error('Error actualizando insurance en save_prescription_data:', insErr.message);
            }
        }
        
        // Limpiar caché
        delete global.mediaCache[chatId];

        return `[INSTRUCCIÓN INTERNA] Receta guardada exitosamente en el CRM para el cliente ID ${resolvedClientId}. NO le menciones al cliente el registro, la ficha ni el CRM: seguí la conversación con normalidad (cotizá o respondé lo que estaba pidiendo). Detalle: ` + JSON.stringify(result);
    })
});

// ── HERRAMIENTAS COMUNES ────────────────────────────────────────────────

const checkExistingClientTool = new DynamicStructuredTool({
    schema: z.object({ phone: z.string().optional(), name: z.string().optional() }).catchall(z.any()),
    name: "check_existing_client",
    description: "Busca los datos del cliente en el CRM. Usa JSON con 'phone' (teléfono) y/o 'name' (nombre). Podés buscar por cualquiera de los dos o ambos.",
    func: safeToolRun(async (input) => await checkExistingClient(safeParse(input, "check_existing_client"))),
});

const getPriceListTool = new DynamicStructuredTool({
    schema: z.object({ category: z.string().optional(), search: z.string().optional(), botRecommended: z.boolean().optional(), genero: z.enum(['HOMBRE', 'MUJER']).optional(), graduacion: z.number().optional(), odEsf: z.number().optional(), oiEsf: z.number().optional(), odCil: z.number().optional(), oiCil: z.number().optional(), clientId: z.string().optional() }).catchall(z.any()),
    name: "get_price_list",
    description: "Obtiene precios del catálogo. Usa JSON con 'category' (MONOFOCAL, MULTIFOCAL, CONTACTO, ARMAZON, CLIPON), 'search' (ej. 'clipon', 'prune') para buscar por nombre/marca/modelo, y 'botRecommended' (booleano opcional, por defecto es true si no hay search para mostrar productos estrella, y false si hay search para buscar en todo el catálogo). Sumá 'genero' ('HOMBRE' o 'MUJER') SOLO cuando el nombre de pila lo diga sin dudas: los armazones vienen con foto y sin esto le mostrás monturas del género contrario. Si el nombre es ambiguo o no lo tenés, no lo pases. ⚠️ Para CRISTALES (MONOFOCAL/MULTIFOCAL/BIFOCAL) mandá SIEMPRE 'clientId' (el de tu contexto): el sistema busca la receta guardada de esa persona y te devuelve solo los cristales que se le pueden hacer. Si no hay receta NO te va a dar precios de cristales — no es un error, es a propósito: sin receta no se cotiza. Los armazones (ARMAZON/SOL/CLIPON) no necesitan nada de esto. ⚠️ Cuando ya leíste la receta, mandá SIEMPRE los cuatro valores CON SU SIGNO: 'odEsf', 'oiEsf', 'odCil', 'oiCil' (ej. receta OD -7.50 -1.25 / OI -8.00 -1.75 → odEsf:-7.5, odCil:-1.25, oiEsf:-8, oiCil:-1.75). Con eso el sistema hace dos cosas que vos no tenés que calcular: (1) si la graduación es alta te devuelve los cristales TALLADOS (digital y CNC), que son los que la resuelven —un cristal de stock a -8 queda grueso e inusable—, y (2) descarta los cristales cuyo RANGO no cubre esa receta, que el laboratorio no podría fabricar. Es importante el signo: un cristal 'Esf +8/+22' sirve para un +8 pero no para un -8.",
    func: safeToolRun(async (input) => await getPriceList(safeParse(input, "get_price_list"))),
});

// ── HERRAMIENTAS DE VENTAS (Prospectos) ──────────────────────────────────

const convertIntoLeadTool = new DynamicStructuredTool({
    schema: z.object({ phone: z.string().optional(), name: z.string().optional(), contactSource: z.string().optional(), interest: z.string().optional(), chatId: z.string().optional(), insurance: z.string().optional() }).catchall(z.any()),
    name: "convert_into_lead",
    description: "Registra un prospecto nuevo. Usa JSON con 'phone' (MANDATORIO: el teléfono que ya tenés en tu contexto/chatId — JAMÁS se lo pidas al cliente), 'name' (tomalo del nombre del PACIENTE en la receta, del resumen o del perfil real de WhatsApp — JAMÁS se lo preguntes al cliente; si no existe por ninguna vía, no registres todavía y seguí la venta normalmente), 'contactSource', 'interest' (SOLO USAR UNO DE ESTOS VALORES: Monofocal, Multifocal, Bifocal, Ocupacional, Solar, Accesorios, Lentes de Contacto, Otros), 'chatId' (MANDATORIO), y 'insurance' (MANDATORIO: nombre de la Obra Social/prepaga que indicó el cliente, o el texto 'Particular' si dijo que no tiene o ignoró la pregunta).",
    func: safeToolRun(async (input) => {
        const parsed = safeParse(input, "convert_into_lead");
        const nameClean = (parsed.name || '').trim();
        const nameDigits = nameClean.replace(/\D/g, '').length;
        if (!nameClean || nameClean.length < 2 || nameDigits >= 5 || nameClean.toLowerCase().includes('contacto nuevo') || nameClean === '-') {
            return "[INSTRUCCIÓN INTERNA] El registro no se hizo todavía porque falta un nombre de persona válido. JAMÁS le preguntes el nombre al cliente. Usá el nombre de la receta o el nombre real del perfil de WhatsApp si existen y reintentá con ese. Si no hay nombre por ninguna vía, no registres todavía y seguí la venta normalmente (la ficha se completa después internamente). NO frenes ni condiciones la venta. NUNCA le menciones errores ni que lo estás registrando.";
        }
        if (isPhrase(nameClean)) {
            return "[INSTRUCCIÓN INTERNA] El nombre que pasaste parece una frase, no un nombre de persona. JAMÁS le preguntes el nombre al cliente. Usá el nombre de la receta o del perfil de WhatsApp si existen y reintentá; si no hay, no registres todavía y seguí la venta normalmente. NO frenes la venta. NUNCA le menciones que hubo un problema.";
        }
        const result = await convertIntoLead(parsed);
        // Emitir notificación en tiempo real al panel
        if (result.success && result.contact && global.io) {
            global.io.emit('lead_created', {
                id: result.contact.id,
                name: parsed.name || result.contact.name,
                phone: parsed.phone,
                interest: parsed.interest || 'No especificado',
                source: result.contact.contactSource || 'Calle',
                hasPrescription: false,
                timestamp: new Date().toISOString(),
            });
        }
        return JSON.stringify(result);
    }),
});

// ── HERRAMIENTAS EJECUTIVO (Clientes) ────────────────────────────────────

const updateClientDataTool = new DynamicStructuredTool({
    schema: z.object({ id: z.string(), email: z.string().optional(), address: z.string().optional(), insurance: z.string().optional(), name: z.string().optional(), status: z.string().optional(), interest: z.string().optional() }).catchall(z.any()),
    name: "update_client_data",
    description: "Actualiza datos de una ficha ya creada. OBLIGATORIA cada vez que el cliente te da un dato nuevo (sobre todo el EMAIL al confirmar la compra): JAMÁS le digas que lo anotaste sin haber llamado antes a esta herramienta. Usa JSON con 'id' (MANDATORIO, el ID del cliente en el sistema; si todavía no existe la ficha, creala primero con 'convert_into_lead'), y los campos a actualizar: 'email', 'address', 'insurance' (obra social), 'name', 'status', 'interest' (SOLO USAR UNO DE ESTOS VALORES: Monofocal, Multifocal, Bifocal, Ocupacional, Solar, Accesorios, Lentes de Contacto, Otros).",
    func: safeToolRun(async (input) => await updateClientData(safeParse(input, "update_client_data"))),
});

const getOrderStatusTool = new DynamicStructuredTool({
    schema: z.object({ orderId: z.string().optional(), clientId: z.string().optional() }).catchall(z.any()),
    name: "get_order_status",
    description: "Consulta estado de un pedido y su saldo pendiente VERIFICADO por el sistema, desglosado por forma de pago (efectivo, transferencia, tarjeta con cuotas). Pasá 'clientId' para buscar automáticamente el pedido relevante, o 'orderId' si tenés el ID específico. Los montos que devuelve ya incluyen los descuentos: usalos TAL CUAL, nunca los recalcules. Si no devuelve el desglose verificado, seguí su instrucción interna y NO informes montos.",
    func: safeToolRun(async (input) => await getOrderStatus(safeParse(input, "get_order_status"))),
});

const createQuoteTool = new DynamicStructuredTool({
    schema: z.object({ clientId: z.string().optional(), items: z.array(z.any()).optional(), total: z.number().optional(), discountCash: z.number().optional() }).catchall(z.any()),
    name: "create_quote",
    description: "Registra un presupuesto/cotización en el CRM y es lo que después manda el PDF. Usa JSON con: 'clientId' (MANDATORIO — el ID de la ficha; si el contacto todavía no tiene ficha, creala PRIMERO con 'convert_into_lead' o 'save_prescription_data' y usá el id que devuelven: sin clientId esta herramienta falla), 'items' (MANDATORIO — array de objetos, y CADA UNO tiene que llevar 'productId' con el id EXACTO que te devolvió 'get_price_list' para ese producto: {productId:'abc123', quantity:1}. Sin ese id el presupuesto se rechaza entero, porque el sistema no cotiza nada cuyo precio no pueda verificar contra el catálogo. NO inventes ids ni mandes solo el nombre. Si querés cotizar un cristal para un solo ojo agregá 'eye' ('OD' o 'OI'); sin 'eye' la línea vale el PAR, que es lo normal), 'total' (opcional, el total que calculaste: el sistema lo recalcula solo y si el tuyo no coincide te avisa) y 'discountCash' (opcional). El resultado trae 'id': guardalo, lo necesitás para 'send_quote_pdf'.",
    func: safeToolRun(async (input) => {
        const parsed = safeParse(input, "create_quote");
        if (!parsed.clientId || parsed.clientId === 'null' || parsed.clientId === 'none') {
            return "[INSTRUCCIÓN INTERNA] El presupuesto no se registró todavía porque el contacto no tiene ficha. NO frenes el cierre por esto: confirmá la compra con total normalidad y seguí la conversación; el presupuesto se registra después internamente. NUNCA le menciones al cliente registros ni fichas.";
        }
        return await createQuote(parsed);
    }),
});

const sendQuotePdfTool = new DynamicStructuredTool({
    schema: z.object({ orderId: z.string(), chatId: z.string().optional(), text: z.string() }).catchall(z.any()),
    name: "send_quote_pdf",
    description: "Genera el PDF del presupuesto/venta y se lo manda al cliente por WhatsApp (con copia por email si tiene). Usala SOLO DESPUÉS de haber creado el presupuesto con 'create_quote' y cuando el cliente confirmó que lo quiere recibir en PDF (o ya cerró la compra). Usa JSON con 'orderId' (MANDATORIO, el 'id' que devolvió 'create_quote'), 'chatId' (MANDATORIO, ya lo tenés en tu contexto — JAMÁS le pidas el teléfono al cliente), 'text' (MANDATORIO, un mensaje corto en criollo que acompaña el PDF, ej: 'Te paso el presupuesto en PDF 👇'). El PDF y sus montos los arma el sistema — vos NUNCA redactás ni calculás los números del documento, solo el mensaje que lo acompaña.",
    func: safeToolRun(async (input) => {
        const parsed = safeParse(input, "send_quote_pdf");
        if (!parsed.orderId) {
            return "[INSTRUCCIÓN INTERNA] Falta 'orderId': llamá primero a 'create_quote' y usá el 'id' que te devolvió. NO le menciones esto al cliente.";
        }
        if (!parsed.chatId) {
            return "[INSTRUCCIÓN INTERNA] Falta 'chatId' en la llamada — es el que ya tenés en tu contexto de esta charla. Reintentá pasándolo.";
        }
        return await sendQuotePdf(parsed);
    }),
});

// Fotos de armazones. El envío lo hace el sistema (no depende de que el modelo
// copie un `[IMAGE: url]` en su respuesta) y tiene tope duro de 3 por llamada.
const sendProductPhotosTool = new DynamicStructuredTool({
    schema: z.object({
        chatId: z.string().optional(),
        category: z.string().optional(),
        search: z.string().optional(),
        products: z.array(z.string()).optional(),
        genero: z.enum(['HOMBRE', 'MUJER']).optional(),
    }).catchall(z.any()),
    name: "send_product_photos",
    description: "Le manda al cliente por WhatsApp las FOTOS de armazones, lentes de sol o clip-ons, cada una con el nombre del modelo y su precio de contado al pie. Usala cuando el cliente pide ver modelos ('mandame fotos', 'qué modelos tenés', 'querés que te muestre?' y te dice que sí) o cuando responde a la campaña contando qué modelito le gustó. Usa JSON con 'chatId' (MANDATORIO, el que ya tenés en tu contexto — JAMÁS le pidas el teléfono al cliente), 'category' ('ARMAZON' por defecto, o 'SOL' / 'CLIPON'), 'search' (opcional, para buscar por nombre/marca/modelo: usalo cuando el cliente nombra algo concreto) y 'products' (opcional, array con los nombres exactos de los modelos que querés mostrar). Manda como MÁXIMO 3 fotos por llamada y las elige el sistema. NO la llames más de una vez por turno y NO la uses si el cliente no pidió ver modelos. Después de usarla, escribí una sola línea corta preguntando cuál le gustó: las fotos ya llegaron con su precio, no los repitas. GÉNERO: pasá 'genero' ('HOMBRE' o 'MUJER') cuando el nombre de pila de la persona lo diga sin lugar a dudas (Juan, Carlos → HOMBRE; María, Lucía → MUJER), para no mandarle monturas del género contrario. Si el nombre es ambiguo, unisex, extranjero o no lo tenés (Alex, Guadalupe, Cris, o directamente no sabés), NO INVENTES: no pases 'genero' y NO uses esta herramienta — mandale el link de la tienda (https://atelieroptica.com.ar/tienda) para que elija a gusto.",
    func: safeToolRun(async (input) => {
        const parsed = safeParse(input, "send_product_photos");
        if (!parsed.chatId) {
            return "[INSTRUCCIÓN INTERNA] Falta 'chatId' — es el que ya tenés en tu contexto de esta charla. Reintentá pasándolo. NO le menciones esto al cliente.";
        }
        return await sendProductPhotos(parsed);
    }),
});

const createTaskTool = new DynamicStructuredTool({
    schema: z.object({ clientId: z.string().optional(), description: z.string(), dueDate: z.string().optional() }).catchall(z.any()),
    name: "create_task",
    description: "Crea una tarea/seguimiento para que un humano la atienda. Usa JSON con 'clientId' (SOLO si clientData.id existe en tu contexto; si no hay clientData.id, NO pases clientId), 'description' (MANDATORIO, qué hay que hacer), 'dueDate' (fecha opcional, formato ISO). IMPORTANTE: Si no tenés un clientData.id real, NO inventes un ID ni uses el chatId.",
    func: safeToolRun(async (input) => await createTask(safeParse(input, "create_task"))),
});

const agendarTurnoTool = new DynamicStructuredTool({
    schema: z.object({ clientId: z.string(), fechaHora: z.string(), motivo: z.string().optional(), nombre: z.string().optional() }).catchall(z.any()),
    name: "agendar_turno",
    description: "Agenda un turno en el local (control visual, probarse armazones, retirar). Usá JSON con 'clientId' (MANDATORIO, el clientData.id real), 'fechaHora' (MANDATORIO, fecha y hora exactas en formato ISO con zona -03:00, ej '2026-09-12T10:30:00-03:00'), 'motivo' (para qué viene) y 'nombre' (del cliente, si lo sabés). Ofrecé PRIMERO las franjas de 9 a 11 o de 16 a 20 (se espera menos), pero si al cliente no le sirven agendá igual en cualquier hora que el local esté abierto. Los sábados, en lo posible, evitalos. NUNCA le confirmes el turno al cliente antes de que esta herramienta te diga que quedó guardado.",
    func: safeToolRun(async (input) => await agendarTurno(safeParse(input, "agendar_turno"))),
});

const requestInvoiceTool = new DynamicStructuredTool({
    schema: z.object({ clientId: z.string().optional() }).catchall(z.any()),
    name: "request_invoice",
    description: "Úsala EXCLUSIVAMENTE cuando el cliente pida explícitamente que se le envíe la factura, comprobante fiscal o ticket de su compra. Esta herramienta envía una alerta de urgencia a administración para que la emitan. Usa JSON con 'clientId' (SOLO si clientData.id existe).",
    func: safeToolRun(async (input) => await reportInvoiceRequest(safeParse(input, "request_invoice"))),
});

const addInteractionTool = new DynamicStructuredTool({
    schema: z.object({ clientId: z.string(), type: z.string().optional(), content: z.string() }).catchall(z.any()),
    name: "add_interaction",
    description: "Registra una nota o interacción en la ficha del cliente. Usa JSON con 'clientId' (MANDATORIO), 'type' ('NOTE', 'CALL', 'WHATSAPP', etc.), 'content' (MANDATORIO, el texto de la nota).",
    func: safeToolRun(async (input) => await addInteraction(safeParse(input, "add_interaction"))),
});

/**
 * "No sé esto": el bot se aparta y avisa, en vez de improvisar.
 *
 * Es distinta de `cancel_bot` (que es "acá tiene que hablar un humano" por el
 * TIPO de conversación: proveedor, cliente enojado). Esta es por FALTA DE
 * CERTEZA: el bot no sabe algo y lo importante es que no lo invente.
 */
const pedirAyudaTool = new DynamicStructuredTool({
    schema: z.object({ chatId: z.string(), motivo: z.string(), detalle: z.string().optional() }).catchall(z.any()),
    name: "pedir_ayuda",
    description: "Te apartás de la conversación y avisás al equipo, porque NO SABÉS algo y no querés inventarlo. Usala SIEMPRE que estés por decir algo de lo que no tenés certeza: un precio que no te devolvió ninguna herramienta, si un cristal se puede hacer para esa receta, un plazo de entrega raro, si algo entra por la obra social, una promo que no figura en tu contexto, o cualquier dato importante que tendrías que 'suponer'. Preferimos MIL VECES que te apartes a que le des al cliente un dato equivocado: un precio mal dicho por WhatsApp después hay que sostenerlo o desdecirlo, y las dos cosas cuestan. Usa JSON con 'chatId' (MANDATORIO, el de tu contexto), 'motivo' (una frase corta y en criollo que va a LEER una vendedora: 'no sé si el cristal 1.74 entra en ese armazón', 'me pide un plazo para el interior y no lo tengo') y 'detalle' (opcional, contexto extra). Antes de llamarla, escribile al cliente UNA línea natural avisándole que lo va a atender alguien del equipo — sin explicarle que sos un sistema ni por qué te apartás. Después de llamarla NO sigas respondiendo en ese chat.",
    func: safeToolRun(async (input) => {
        const parsed = safeParse(input, "pedir_ayuda");
        if (!parsed.chatId) return "[INSTRUCCIÓN INTERNA] Falta el chatId: no se pudo avisar al equipo. Seguí la conversación SIN inventar el dato que no sabías — decile que se lo confirmás y no des números.";
        const { escalarAHumano } = require('./shared/escalar');
        // Solo el transporte: `escalarAHumano` apaga el bot de ese chat con su
        // propio update. Construir un BotService acá pediría media docena de
        // dependencias (io, broadcastChatUpdate…) que esta tool no tiene, y la
        // primera llamada moriría con un TypeError justo cuando más se la
        // necesita — que es cuando el bot ya no sabe qué hacer.
        const transport = require('./transport/cloud-transport');
        await escalarAHumano(
            { notifyAdminDown: transport.notifyAdminDown },
            { chatId: parsed.chatId, motivo: parsed.motivo, detalle: parsed.detalle },
        );
        return "[INSTRUCCIÓN INTERNA] Listo: el equipo ya fue avisado y quedó una tarea en el panel. NO respondas nada más en este chat.";
    }),
});

const cancelBotTool = new DynamicStructuredTool({
    schema: z.object({ clientId: z.string().optional(), waId: z.string().optional() }).catchall(z.any()),
    name: "cancel_bot",
    description: "Desactiva el bot y pausa tus respuestas para que un humano tome el control. Usala por cualquier motivo en el que consideres importante que interceda un humano: conversación personal, proveedor, laboratorio, cliente enojado, consulta compleja, etc. Agrega la etiqueta 'Cancelar Bot'. Usa JSON con 'clientId' (o 'none') y 'waId' (el teléfono del cliente con @c.us). Si solo tenés chatId y no waId, usá 'disable_bot_for_personal_chat' en su lugar.",
    func: safeToolRun(async (input) => await cancelBot(safeParse(input, "cancel_bot"))),
});

const addTagToClientTool = new DynamicStructuredTool({
    name: "add_tags",
    description: "Usa esta herramienta para agregar una etiqueta importante al cliente a medida que obtienes datos (ej: 'OSDE', 'Urgente', 'Monofocal'). Usa JSON estricto con 'clientId' y 'tagName'.",
    schema: z.object({
        clientId: z.string().describe("ID del cliente en el CRM"),
        tagName: z.string().describe("Nombre de la etiqueta a agregar")
    }),
    func: safeToolRun(async (input) => await addTagToClient(input)),
});

const disableBotForChatTool = new DynamicStructuredTool({
    schema: z.object({ 
        chatId: z.string().optional(),
        reason: z.enum(['Personal', 'Familiar', 'Proveedor', 'Spam', 'Cancelar Bot']).default('Personal')
    }).catchall(z.any()),
    name: "disable_bot_for_personal_chat",
    description: "ÚSALA INMEDIATAMENTE si detectás que la conversación es de carácter familiar, personal, de amistad, spam, o si es un proveedor/laboratorio B2B. Esta herramienta apaga el bot SILENCIOSAMENTE para este chat. Especificá la razón (reason): 'Personal' (para familiares/amigos), 'Familiar' (para familia directa), 'Proveedor' (para B2B/laboratorios/ventas B2B), 'Spam' (publicidades molestas) o 'Cancelar Bot' (otras razones). NO escribas ningún mensaje al cliente antes de usarla. Usa JSON.",
    func: safeToolRun(async (input) => {
        const parsed = safeParse(input, "disable_bot_for_personal_chat");
        const result = await disableBotForChat(parsed);
        return JSON.stringify(result);
    })
});

const reportComplaintTool = new DynamicStructuredTool({
    schema: z.object({ clientId: z.string().optional(), details: z.string().optional() }).catchall(z.any()),
    name: "report_complaint",
    description: "USA ESTA HERRAMIENTA OBLIGATORIAMENTE cuando un cliente tiene una queja, un problema post-venta, lentes rotas o que no ve bien. REQUISITO PREVIO: Haber recopilado los detalles del inconveniente preguntándole. Usa JSON estricto con 'clientId' (MANDATORIO) y 'details' (MANDATORIO: un resumen de todo lo que contó).",
    func: safeToolRun(async (input) => {
        const { reportComplaint } = require("./tools");
        const parsed = safeParse(input, "report_complaint");
        const result = await reportComplaint(parsed);
        return JSON.stringify(result);
    })
});

const updateChatSummaryTool = new DynamicStructuredTool({
    schema: z.object({ chatId: z.string().optional(), summaryText: z.string().optional() }).catchall(z.any()),
    name: "update_chat_summary",
    description: "Actualiza el resumen y los hitos del chat actual. Usá esta herramienta para dejar anotados datos importantes sobre la conversación (ej: obra social, tipo de armazón que busca, valores de la receta) de modo que queden como un resumen visual en el CRM, incluso antes de que el contacto sea guardado como cliente. Sobreescribe el resumen anterior, por lo que debes mantener la información histórica importante y agregarle lo nuevo. Usa JSON con 'chatId' (MANDATORIO) y 'summaryText' (el nuevo texto del resumen completo).",
    func: safeToolRun(async (input) => {
        const { updateChatSummary } = require("./tools");
        const parsed = safeParse(input, "update_chat_summary");
        const result = await updateChatSummary(parsed);
        return JSON.stringify(result);
    })
});

const salesToolsList = [
    pedirAyudaTool,
    checkExistingClientTool,
    getPriceListTool,
    // 30/8/2026: estaba SOLO en executiveToolsList. El prompt de ventas le
    // ordena pedir el email al cerrar la compra, el prospecto lo daba y el bot
    // contestaba "listo, ya lo agendé" sin llamar ninguna herramienta: la ficha
    // quedaba con email: null. O sea, le mentía al cliente y perdíamos el dato.
    updateClientDataTool,
    savePrescriptionDataTool,
    convertIntoLeadTool,
    cancelBotTool,
    addTagToClientTool,
    addInteractionTool,
    createTaskTool,
    agendarTurnoTool,
    createQuoteTool,
    sendQuotePdfTool,
    sendProductPhotosTool,
    disableBotForChatTool,
    reportComplaintTool,
    updateChatSummaryTool,
    requestInvoiceTool
];

const executiveToolsList = [
    pedirAyudaTool,
    checkExistingClientTool,
    getPriceListTool,
    updateClientDataTool,
    getOrderStatusTool,
    createQuoteTool,
    sendQuotePdfTool,
    sendProductPhotosTool,
    createTaskTool,
    agendarTurnoTool,
    addInteractionTool,
    savePrescriptionDataTool,
    cancelBotTool,
    addTagToClientTool,
    disableBotForChatTool,
    reportComplaintTool,
    updateChatSummaryTool,
    requestInvoiceTool
];
module.exports = {
    salesToolsList,
    executiveToolsList
};
