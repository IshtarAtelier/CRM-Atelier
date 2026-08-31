/**
 * AI Services (Guardrails & Payment Receipt Detection)
 */

const { HumanMessage } = require("@langchain/core/messages");
const { contenidoATexto } = require('../shared/ai-content');
const { withTimeout } = require('../utils');

/**
 * Capa de Seguridad (Output Guardrail)
 * Verifica si el texto contiene estructuras JSON o IDs de base de datos tipo CUID
 */
function runOutputGuardrail(text) {
    if (!text) return { safe: true };

    // 1. Detectar IDs de base de datos tipo CUID (ej: cmpiyd5790000dzris5hpt628)
    const cuidRegex = /\bc[a-z0-9]{23,29}\b/gi;
    const hasCuid = cuidRegex.test(text);

    // 2. Detectar estructuras JSON (ej: { "precio": 30000 })
    const jsonRegex = /\{[\s\S]*?\}/;
    const hasJson = jsonRegex.test(text) && (text.includes('"') || text.includes(':'));

    // 3. Detectar si el bot narra su propia desactivación o el motivo interno por
    //    el que deja de responder.
    //
    //    ⚠️ 31/8/2026 — CAMBIO DE CRITERIO, decidido por Ishtar.
    //    Hasta hoy esta lista bloqueaba también cualquier frase en la que el bot
    //    admitiera ser un bot ('soy un bot', 'soy una ia', 'no soy una persona',
    //    'respuesta automática', 'como modelo de lenguaje', 'algoritmo de'...).
    //    Bloquear acá no censuraba la frase: descartaba el mensaje ENTERO, apagaba
    //    el bot en ese chat y le dejaba al cliente silencio absoluto
    //    (`bot-cloud.js` → esSospechaDeBot). O sea que a un "sos un bot?" el
    //    cliente no recibía nada nunca más.
    //
    //    La decisión nueva es la contraria: el bot se identifica como asistente
    //    automático en su primer mensaje y responde con honestidad si le
    //    preguntan (ver `prompts/salesPrompt.js` → <quien_sos>). Por eso las
    //    palabras de identidad salieron de la lista: si siguieran acá, la
    //    respuesta honesta que el prompt ordena sería silenciada por el código.
    //
    //    Lo que SÍ se sigue bloqueando es que el bot le cuente al cliente su
    //    plomería interna: que se está desactivando, que la charla se marcó como
    //    personal, o que se despide "por ahora" sin derivar a nadie.
    const shutdownNarrationKeywords = [
        'carácter personal', 'caracter personal', 'desactivo el bot', 'desactivar el bot',
        'conversación personal', 'conversacion personal', 'desactivo para que',
        'desactivo el agente', 'desactivar el agente', 'desactivo respuestas', 'desactivo la ia',
        'desactivar la ia', 'apago el bot', 'apagar el bot'
    ];
    const lowerText = text.toLowerCase();
    const revealsBot = shutdownNarrationKeywords.some(keyword => lowerText.includes(keyword));

    // 4. Detectar narración de errores/procesos internos: el cliente NUNCA debe recibir
    // información de fallas técnicas. Si el modelo intenta contarlas, se bloquea el envío
    // (el turno se aborta en silencio y el bot reintenta en el próximo mensaje).
    const internalErrorKeywords = [
        'error técnico', 'error tecnico', 'problema técnico', 'problema tecnico',
        'inconveniente técnico', 'inconveniente tecnico', 'falla técnica', 'falla tecnica',
        'error en el sistema', 'error del sistema', 'problema con el sistema',
        'problema en el sistema', 'se cayó el sistema', 'se cayo el sistema',
        'error de red', 'problema de red', 'fallo de conexión', 'fallo de conexion',
        'problema de conexión', 'problema de conexion', 'error de conexión', 'error de conexion',
        'no pude acceder al sistema', 'no puedo acceder al sistema',
        'estamos con problemas técnicos', 'estamos con problemas tecnicos',
        'intermitencia en el sistema', 'error interno',
        // Formas genéricas de narrar errores (Auditoría 2026-07-07)
        'hubo un error', 'ocurrió un error', 'ocurrio un error', 'tuve un error',
        'no pude procesar', 'no pude acceder', 'no puedo acceder',
        // Narración de procesos/trabajo interno (CRM, registros, sistema)
        'cargo tus datos', 'cargando tus datos', 'cargo los datos', 'cargando los datos',
        'registro tus datos', 'registro tu receta', 'cargo tu receta', 'guardo tu receta',
        'te registro a nombre', 'según nuestros registros', 'segun nuestros registros',
        'en el sistema veo', 'en el sistema figura', 'en el sistema me figura',
        'me figura en el sistema', 'acá me figura', 'aca me figura',
        'reviso en el sistema', 'consulto en el sistema', 'verifico en el sistema',
        'busco en el sistema', 'lo cargo en el sistema', 'lo registro en el sistema'
    ];
    const narratesInternalError = internalErrorKeywords.some(keyword => lowerText.includes(keyword));

    // 5. Detectar pedidos de datos prohibidos o presentación indebida: el bot JAMÁS
    // pide el nombre (de pila, completo, apellido, DNI) ni el teléfono/celular, y
    // JAMÁS se presenta con apellido o título profesional. Pedir datos se siente
    // encuesta de IA. Se trata como transitorio (turno en silencio).
    const forbiddenDataPatterns = [
        /me\s+(pas[aá]s|dec[ií]s|dej[aá]s|dar[ií]as?|compart[ií]s)\s+(tu|su|un)\s+(n[uú]mero|tel[eé]fono|celular)/i,
        /cu[aá]l\s+es\s+(tu|su)\s+(n[uú]mero|tel[eé]fono|celular)/i,
        /(tu|su)\s+n[uú]mero\s+de\s+(tel[eé]fono|celular|contacto|wh?atsapp)/i,
        /nombre\s+completo/i,
        /me\s+(dec[ií]s|pas[aá]s)\s+(tu|su)\s+apellido/i,
        /(tu|su)\s+dni\b/i,
        // Preguntas por el nombre (cualquier forma)
        /me\s+(dec[ií]s|pas[aá]s|dir[ií]as?|indic[aá]s|record[aá]s)\s+(tu|su)\s+nombre/i,
        /cu[aá]l\s+es\s+(tu|su)\s+nombre/i,
        /con\s+qui[eé]n\s+tengo\s+el\s+gusto/i,
        /a\s+nombre\s+de\s+qui[eé]n/i,
        /(tu|su)\s+nombre\s+de\s+pila/i,
        /c[oó]mo\s+(te\s+llam[aá]s|es\s+tu\s+nombre)/i,
        // Imperativos voseantes y confirmaciones (el registro natural del bot).
        // Para nombre/apellido/dni se exige "tu/su" para no bloquear frases legítimas
        // como "decime el nombre de tu obra social".
        /(decime|pasame|dejame|indicame|mandame|confirmame|compartime|escribime)\s+(tu|su)\s+(nombre|apellido|dni)\b/i,
        /(decime|pasame|dejame|indicame|mandame|confirmame|compartime|escribime)\s+(tu|su|el|un)\s+(n[uú]mero\s+de\s+)?(tel[eé]fono|celular)\b/i,
        /me\s+(confirm[aá]s|record[aá]s|escrib[ií]s|dej[aá]s)\s+(tu|su)\s+(nombre|apellido|dni|celular|tel[eé]fono|n[uú]mero)\b/i,
        // Presentación indebida (apellido o títulos profesionales, sueltos o combinados)
        /\bturchi\b/i,
        /contact[oó]log[oa]s?/i,
        /[oó]ptic[oa]\s+contact[oó]log[oa]/i,
        /ejecutiv[oa]\s+de\s+cuentas/i,
    ];
    const asksForbiddenData = forbiddenDataPatterns.some(p => p.test(text));

    if (hasCuid || hasJson || revealsBot || narratesInternalError || asksForbiddenData) {
        return {
            safe: false,
            reason: hasCuid
                ? 'ID de Base de Datos Detectado'
                : (hasJson
                    ? 'Estructura JSON Detectada'
                    : (revealsBot
                        // El nombre de la razón se conserva TAL CUAL porque
                        // `bot-cloud.js` e `index.js` lo matchean por substring
                        // ('Revelación de Identidad') para apagar el chat y abrir
                        // la tarea. Cambiarlo acá sin tocar esos dos archivos
                        // rompería el apagado. Hoy solo lo dispara la narración
                        // de la propia desactivación, no admitir que sos un bot.
                        ? 'Revelación de Identidad de Bot o Desactivación Manual'
                        : (narratesInternalError
                            ? 'Narración de Error Interno'
                            : 'Solicitud de Dato Prohibido o Presentación Indebida'))),
            matched: hasCuid ? text.match(cuidRegex) : null
        };
    }

    return { safe: true };
}

/**
 * Clasifica si una imagen es un comprobante de transferencia o pago utilizando Gemini multimodal.
 */
async function detectPaymentReceipt(mediaBase64, mimeType) {
    try {
        const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
        const model = new ChatGoogleGenerativeAI({
            model: 'gemini-2.5-flash',
            temperature: 0,
            apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY
        });

        const response = await withTimeout(
            model.invoke([
                new HumanMessage({
                    content: [
                        { 
                            type: "text", 
                            text: `Clasificá esta imagen. Respondé ÚNICAMENTE con la palabra "COMPROBANTE" si parece ser un ticket de transferencia, recibo de pago, comprobante de Mercado Pago o captura de pantalla de transferencia de pago confirmada. Si es cualquier otra cosa (receta médica, foto de un anteojo, foto de una persona, saludo, etc.), respondé con "OTRO".` 
                        },
                        { type: "image_url", image_url: { url: `data:${mimeType};base64,${mediaBase64}` } }
                    ]
                })
            ]),
            30000,
            'Gemini payment receipt detection timeout'
        );

        const text = contenidoATexto(response.content).trim().toUpperCase();
        return text.includes('COMPROBANTE') && !text.includes('OTRO');
    } catch (e) {
        console.error('Error en detectPaymentReceipt:', e.message);
        return false;
    }
}

module.exports = {
    runOutputGuardrail,
    detectPaymentReceipt
};
