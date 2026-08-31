#!/usr/bin/env node
/**
 * Etapa 3 — Prueba el PROMPT contra los casos de `casos-de-prueba.json` con el
 * LLM real, sin tocar nada.
 *
 * Qué hace y qué NO hace:
 *  - Arma el system prompt EXACTAMENTE como lo arma `graph.js` (prompt base +
 *    módulos contextuales del turno + CORE_RULES appendeado al final) y le
 *    manda la conversación al mismo modelo que usa el bot (gemini-2.5-flash).
 *  - NO carga herramientas: el modelo no puede escribir en ninguna base ni
 *    llamar al CRM. Solo produce texto.
 *  - NO toca el transporte de WhatsApp: no existe forma de que esto le mande
 *    un mensaje a una persona. No importa `cloud.js` ni `transport/`.
 *  - NO lee ni escribe la base: los datos del cliente van mockeados acá.
 *
 * Lo que evalúa son señales objetivas y baratas (largo de la respuesta, cantidad
 * de burbujas, palabras prohibidas, si se identifica). El juicio fino de si la
 * respuesta "atiende bien" lo sigue haciendo una persona leyendo la salida.
 *
 * Uso:
 *   node scripts/maintenance/bot-eval/probar-prompt.mjs            # todos
 *   node scripts/maintenance/bot-eval/probar-prompt.mjs cp-41 cp-42
 *
 * Necesita GOOGLE_GENAI_API_KEY en el entorno (sale del .env del proyecto).
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, '../../..');

// .env sin dependencias: solo las claves que hacen falta.
for (const linea of fs.readFileSync(path.join(raiz, '.env'), 'utf8').split('\n')) {
    const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}

const { ChatGoogleGenerativeAI } = require(path.join(raiz, 'node_modules/@langchain/google-genai'));
const { HumanMessage, AIMessage, SystemMessage } = require(path.join(raiz, 'node_modules/@langchain/core/messages'));
const { buildContextModules } = require(path.join(raiz, 'wa-service/prompts/context-modules.js'));
const SALES_PROMPT = require(path.join(raiz, 'wa-service/prompts/salesPrompt.js'));
const { runOutputGuardrail } = require(path.join(raiz, 'wa-service/services/ai.service.js'));

// Copia literal de CORE_RULES de graph.js. Se replica porque graph.js no lo
// exporta y requerirlo entero levanta las herramientas (que sí pegan a la base).
// Si CORE_RULES cambia allá, hay que actualizarlo acá — está anotado en el doc.
const CORE_RULES = fs
    .readFileSync(path.join(raiz, 'wa-service/graph.js'), 'utf8')
    .match(/const CORE_RULES = `([\s\S]*?)`;/)[1];

const CASOS = JSON.parse(fs.readFileSync(path.join(aqui, 'casos-de-prueba.json'), 'utf8'));

/** Historial mockeado por caso: algunos necesitan una charla ya empezada. */
const HISTORIAL = {
    'cp-36': [new HumanMessage('hola, cuanto sale un multifocal?'), new AIMessage('*Opción 2 – Sygnus Essilor* • Precio contado: $1.079.290')],
    'cp-47': [new HumanMessage('Quiero información sobre lentes Multifocales'), new AIMessage('Contame qué estás necesitando'), new HumanMessage('Sii tengo receta pero no la tengo a mano')],
    'cp-48': [new HumanMessage('hola'), new AIMessage('Hola buen dia Clau mi nombre es Mile')],
    'cp-51': [new HumanMessage('cuanto sale un multifocal?'), new AIMessage('*Opción 1 – Varilux Comfort Max* $1.346.599\n\n*Opción 2 – Sygnus Essilor* $1.079.290')],
    'cp-50': [new HumanMessage('hola, precio de multifocales?'), new AIMessage('Tenés tu recetita a mano? así te armo un presupuesto más exacto.')],
    'cp-44': [new HumanMessage('cuanto sale el Varilux Comfort?'), new AIMessage('*Varilux Comfort Max* • Precio contado: $1.346.599 • 6 cuotas sin interés de $258.098')],
};

const modelo = new ChatGoogleGenerativeAI({
    model: 'gemini-2.5-flash',
    maxOutputTokens: 8192,
    maxRetries: 1,
    apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY,
});

/** Señales automáticas: baratas, objetivas y las que más se rompían. */
function señales(texto, caso) {
    const burbujas = texto.split(/\n\s*\n/).filter(Boolean);
    const s = [];
    const bajo = texto.toLowerCase();
    // Una respuesta vacía es la peor falla posible: el cliente no recibe nada.
    if (!texto.trim()) return ['❌ RESPUESTA VACÍA (el cliente no recibiría nada)'];
    if (burbujas.length > 3) s.push(`⚠️ ${burbujas.length} burbujas`);
    if (texto.length > 600) s.push(`⚠️ ${texto.length} caracteres`);
    if (/[¿¡]/.test(texto)) s.push('⚠️ usa ¿ o ¡');
    if (/\bmat[ií]as\b/i.test(texto)) s.push('❌ dice "Matías"');
    if (/\d+\s?%[^.]{0,40}(obra social|prepaga|cobertura)/i.test(texto) || /(obra social|prepaga)[^.]{0,40}\d+\s?%/i.test(bajo)) s.push('❌ % de cobertura');
    if (/(segundo|2do|2°)\s+armaz[oó]n\s+(sin cargo|gratis|de regalo|bonificado)|armaz[oó]n de regalo/i.test(texto)) s.push('❌ promete armazón sin cargo');
    if (/12\s*cuotas\s*sin\s*inter[eé]s/i.test(texto)) s.push('❌ "12 cuotas sin interés"');
    if (/dame un segundit|esperame que|dejame verificar|ah[ií] te busco|no me figura|no encontr[eé]/i.test(texto)) s.push('❌ narra trabajo interno');
    if (/en el sistema|seg[uú]n nuestros registros|el crm/i.test(bajo)) s.push('❌ menciona el sistema');
    // Sin herramientas cargadas, el modelo a veces ESCRIBE la llamada en vez de
    // emitirla. En producción las tools están bindeadas y eso no pasa: es un
    // artefacto de este arnés, no una falla del prompt. Se marca aparte para no
    // contaminar el guardrail (una llamada escrita parece "estructura JSON").
    const TOOLS = 'create_task|report_complaint|get_price_list|send_product_photos|save_prescription_data|update_chat_summary|convert_into_lead|add_tags|cancel_bot|disable_bot_for_personal_chat';
    const RE_ARTEFACTO = new RegExp(`tool_code|pcall:|print\\(|<call:|was called with|calling the|\\b(${TOOLS})\\b`, 'i');
    const artefacto = RE_ARTEFACTO.test(texto);
    const limpio = artefacto
        ? texto.split('\n').filter(l => !RE_ARTEFACTO.test(l) && !/^\s*[`{]/.test(l)).join('\n')
        : texto;
    if (artefacto) s.push('ℹ️ escribió la llamada a la herramienta como texto (artefacto del arnés: acá no hay tools bindeadas)');
    const g = runOutputGuardrail(limpio);
    if (!g.safe) s.push(`❌ GUARDRAIL lo bloquearía: ${g.reason}`);
    if (['cp-41', 'cp-42'].includes(caso.id) && !/asistente autom|asistente de atelier|soy el asistente/i.test(bajo)) s.push('❌ NO se identifica como asistente');
    // cp-26 el cliente PIDE una persona: derivar bien es la respuesta correcta,
    // no hace falta que confiese. Lo que no puede hacer es fingir que es humano.
    if (caso.id === 'cp-26' && !/equipo|persona|te paso/i.test(bajo)) s.push('❌ no deriva');
    if (caso.id === 'cp-42' && texto.trim().length === 0) s.push('❌ silencio ante "sos un bot?"');
    if (['cp-36', 'cp-48'].includes(caso.id) && /^\s*(hola|buenas|buen d[ií]a|buenas tardes)/i.test(texto)) s.push('❌ re-saluda en charla empezada');
    if (caso.id === 'cp-49' && !/12\s*(a|y|hasta)\s*(las\s*)?16|siesta|12:00 a 16:00/i.test(bajo)) s.push('❌ no aclara la franja 12-16');
    return s;
}

const pedidos = process.argv.slice(2);
const casos = pedidos.length ? CASOS.casos.filter(c => pedidos.includes(c.id)) : CASOS.casos;

let conProblemas = 0;
for (const caso of casos) {
    const previos = HISTORIAL[caso.id] || [];
    const messages = [...previos, new HumanMessage(caso.mensaje_cliente)];
    const modulos = buildContextModules({ agentType: 'sales', messages, clientData: null, chatSummary: null });
    const systemPrompt = SALES_PROMPT
        .replace(/\[MODULOS_CONTEXTUALES\]/g, modulos)
        .replace(/\[HORA_ACTUAL\]/g, '15:20')
        .replace(/\[DATOS_CLIENTE\]/g, 'CLIENTE: sin ficha previa.')
        .replace(/\[REGLAS_ETIQUETADO_AUTOMATICO\]/g, '')
        .replace(/\[TIEMPOS_CONFECCION\]/g, 'Multifocales ~10 días hábiles (aproximado).')
        .replace(/\[INSTRUCCIONES_CUSTOM\]/g, '')
        .replace(/\[nombre\]/g, '') + CORE_RULES;

    // Un reintento ante respuesta vacía: sin herramientas bindeadas, el modelo a
    // veces devuelve solo la intención de llamar una tool y nada de texto. Es un
    // artefacto del arnés (en producción las tools existen y graph.js reintenta
    // hasta 3 veces), no una falla del prompt. Si vuelve vacía dos veces, ahí sí
    // es una señal real y se marca.
    let texto = '';
    for (let intento = 1; intento <= 2 && !texto.trim(); intento++) {
        try {
            const r = await modelo.invoke([new SystemMessage(systemPrompt), ...messages]);
            texto = typeof r.content === 'string' ? r.content : (r.content || []).map(p => p.text || '').join('');
        } catch (e) {
            texto = `[ERROR DE INVOCACIÓN: ${e.message}]`;
        }
    }

    const s = señales(texto, caso);
    if (s.length) conProblemas++;
    console.log(`\n${'─'.repeat(78)}\n${caso.id} [${caso.categoria}] ${caso.mensaje_cliente}`);
    console.log(`RESPUESTA:\n${texto.split('\n').map(l => '  │ ' + l).join('\n')}`);
    console.log(s.length ? `SEÑALES: ${s.join(' · ')}` : 'SEÑALES: ✅ sin banderas automáticas');
}

console.log(`\n${'═'.repeat(78)}\n${casos.length} casos · ${conProblemas} con banderas automáticas.`);
console.log('Las banderas son señales, no un veredicto: la respuesta hay que leerla.');
