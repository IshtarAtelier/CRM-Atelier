/**
 * Módulos contextuales del prompt de los agentes.
 *
 * En lugar de un prompt monolítico con 60+ reglas siempre presentes, el núcleo
 * (salesPrompt / executivePrompt) contiene solo identidad, estilo y seguridad,
 * y estos módulos se inyectan en [MODULOS_CONTEXTUALES] SOLO cuando la
 * conversación los hace relevantes. Menos reglas activas por turno = mejor
 * cumplimiento de cada una.
 *
 * Cada módulo define:
 *  - trigger: regex sobre el texto reciente de la conversación (sin tildes,
 *    lowercase) y/o función sobre las señales (hasImage, clientData).
 *  - text: { sales, executive } — variante por agente ('*' si es compartida).
 */

// ── Normalización del texto de conversación ──
function normalizeText(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Extrae señales de los últimos mensajes (LangChain messages) para el selector.
 */
function getConversationSignals(messages, take = 12) {
    const recent = (messages || []).slice(-take);
    let hasImage = false;
    const parts = [];
    for (const m of recent) {
        const content = m.content;
        if (typeof content === 'string') {
            parts.push(content);
        } else if (Array.isArray(content)) {
            for (const p of content) {
                if (p && p.type === 'text' && p.text) parts.push(p.text);
                if (p && p.type === 'image_url') hasImage = true;
            }
        }
    }
    return { conversationText: normalizeText(parts.join('\n')), hasImage };
}

// ── Definición de módulos ──
const MODULES = [
    {
        key: 'receta',
        trigger: ({ text, hasImage, clientData }) =>
            hasImage ||
            /recet|graduaci|aumento|oftalmolog|oculista|dioptr|\[imagen adjunta/.test(text) ||
            (clientData && Array.isArray(clientData.prescriptions) && clientData.prescriptions.length > 0),
        text: {
            sales: `<lectura_multimodal>
  Si el cliente envía una receta médica, lee AMBOS ojos con precisión (OD y OI: Esfera, Cilindro, Eje).
  - Guarda los valores ORIGINALES (sin transponer) usando 'save_prescription_data'.
  - NO le repitas al cliente los valores de la receta (esferas, cilindros, ejes, etc.). No es necesario y es molesto. Simplemente confirmá que la recibiste con algo breve como "Perfecto, ya la tengo" y pasá directo a cotizar.
  - Si hay nombre de paciente legible en la receta, ese ES el nombre del cliente: pasalo como 'userName' y usá su nombre de pila en la charla. JAMÁS le preguntes el nombre.
  - Después de guardar, cotiza usando 'get_price_list' pasando 'chatId' y 'clientId'.
</lectura_multimodal>`,
            executive: `<lectura_multimodal>
  Si el cliente envía una receta médica nueva, lee AMBOS ojos con precisión (OD y OI: Esfera, Cilindro, Eje).
  - Guarda los valores ORIGINALES (sin transponer) usando 'save_prescription_data'.
  - NO le repitas al cliente los valores de la receta (esferas, cilindros, ejes, etc.). Confirmá breve que la recibiste ("Perfecto, ya la tengo") y pasá directo a cotizar. NUNCA le anuncies que estás guardando o registrando sus datos.
  - Después de guardar, cotiza usando 'get_price_list' con la graduación.
</lectura_multimodal>`,
        },
    },
    {
        key: 'obra_social',
        trigger: ({ text, clientData }) =>
            !(clientData && clientData.insurance) ||
            /obra social|prepaga|osde|swiss|pami|apross|galeno|omint|ioma|sancor|medife|particular/.test(text),
        text: {
            sales: `<obra_social>
  🏥 OBRA SOCIAL:
  - Si ves obra social en la receta, asume que la tiene y nómbrala. No la preguntes.
  - Preguntala UNA SOLA VEZ en toda la conversación. Si el cliente ignora la pregunta, no responde o insiste con el precio directo, NUNCA la vuelvas a preguntar. Cotiza como particular de inmediato sin insistir jamás.
  - REGISTRO DEL DATO (OBLIGATORIO): Al registrar al cliente con 'convert_into_lead' o 'save_prescription_data', SIEMPRE completá el campo de obra social ('insurance' / 'obraSocial'): el nombre exacto si tiene (ej: "OSDE", "Swiss Medical"), o el texto "Particular" si dijo que no tiene o ignoró la pregunta. La ficha nunca debe quedar sin este dato.
  - Con obra social: incluye descuento en el precio.
  - Particular: precio tal cual.
  - Obra social -> particular: sumar 15% al precio.
  - PAMI: No trabajamos directo, pero retén al cliente: "Con PAMI directamente no trabajamos, pero hay opciones premium que PAMI no cubre y podemos ayudarte. Tenés tu recetita?"
</obra_social>`,
            executive: `<obra_social>
  🏥 OBRA SOCIAL:
  - Si la obra social ya figura en la ficha o en el resumen, usala directamente: NO la vuelvas a preguntar.
  - Si no la tenés, preguntala UNA SOLA VEZ en toda la conversación. Si el cliente la ignora, no responde o insiste con el precio, cotizá como particular de inmediato sin volver a preguntar jamás. Aceptamos todas.
  - Prohibido inventar nombres de obras sociales a partir de siglas.
  - Si dice que sí: incluye descuento por obra social.
  - Si dice obra social y luego particular: sumar 15% al presupuesto.
  - Si dice particular: precio tal cual.
  - PAMI: No trabajamos directo, pero retén al cliente: "Con PAMI directamente no trabajamos, pero hay opciones premium que PAMI no cubre y podemos ayudarte. Tenés tu recetita?"
</obra_social>`,
        },
    },
    {
        key: 'precios',
        trigger: ({ text }) =>
            /precio|cuest|cuant|valor|presupuest|cotiz|cuota|promo|descuent|barat|caro|oferta|2x1|pagar|pago|efectivo|transferencia|tarjeta|sale[nn]?\b/.test(text),
        text: {
            sales: `<precios_y_presupuestos>
  - Precios exactos solo de 'get_price_list'. Nunca inventes.
  - Formato de opciones (con línea en blanco entre ellas, máximo 3 opciones):
    *Opción N – Nombre completo*
    • Precio contado: $xx.xxx
    • 6 cuotas sin interés de $xx.xxx (total $xx.xxx)

    Cerrar con: "contame qué opción te gusta más?"
    Notas: "AR" = "Antirreflejo". Usa "6 cuotas sin interés de". Incluye mini-descripción.
  - 📋 SIN RECETA: Podemos resolverlo en el local. Sumar $30.000 internamente al presupuesto (NUNCA informar al cliente).
  - 🎁 PROMOCIONES 2x1: Solo multifocales (is2x1: true): 2 pares de cristales + segundo armazón sin cargo. Monofocales: No hay 2x1. Corrige amablemente: "La promo 2x1 aplica exclusivamente para multifocales."
</precios_y_presupuestos>

<upselling_y_restricciones>
  - Opciones por defecto: 1) Smart Free Blue, 2) New Edition, 3) Varilux Physio. Premium: Physio 3.0, Comfort Max, XR Design.
  - Fotocromáticos: No ofrezcas salvo que lo pidan.
  - Mi primer Varilux: Solo si "aptoMiPrimerVarilux: true" y ADD ≤ 1.50. Par simple con 50% desc (no 2x1).
  - MR7 Asférico: Solo si "aptoMr7Asferico: true".
  - Cristales teñidos monofocales: Policarbonato no se tiñe, solo Orgánico Blanco.
</upselling_y_restricciones>

<formas_de_pago>
  1. 3 o 6 cuotas sin interés (tarjetas bancarias)
  2. Naranja Plan Z 3 cuotas sin interés
  3. Transferencia
  4. Efectivo
  5. GoCuotas hasta 4 cuotas con débito
</formas_de_pago>`,
            executive: `<precios_y_presupuestos>
  - Precios exactos solo de 'get_price_list'. Nunca inventes.
  - Formato de opciones (con línea en blanco entre ellas, máximo 3 opciones):
    *Opción N – Nombre completo*
    • Precio contado: $xx.xxx
    • 6 cuotas sin interés de $xx.xxx (total $xx.xxx)

    Cerrar con: "contame qué opción te gusta más?"
    Notas: "AR" = "Antirreflejo". Usa "6 cuotas sin interés de". Incluye mini-descripción.
  - 📋 SIN RECETA: Podemos resolverlo en el local. Sumar $30.000 internamente al presupuesto (NUNCA informar al cliente).
  - 🎁 PROMOCIONES 2x1: Solo multifocales (is2x1: true). Monofocales: No hay 2x1. Corrige amablemente: "La promo 2x1 aplica exclusivamente para multifocales."
</precios_y_presupuestos>

<upselling_y_restricciones>
  - Opciones por defecto: 1) Línea Smart Free (básica/económica), 2) Kodak (Premium Plus), 3) Línea Comfort de Varilux (Recomendada). Premium: Physio 3.0, Comfort Max, XR Design.
  - Fotocromáticos: No ofrezcas salvo que lo pidan.
  - Mi primer Varilux: Solo si "aptoMiPrimerVarilux: true" y ADD ≤ 1.50. Par simple con 50% desc (no 2x1).
  - MR7 Asférico: Solo si "aptoMr7Asferico: true".
  - Cristales teñidos monofocales: Policarbonato no se tiñe, solo Orgánico Blanco.
</upselling_y_restricciones>

<formas_de_pago>
  1. 3 o 6 cuotas sin interés (tarjetas bancarias)
  2. Naranja Plan Z 3 cuotas sin interés
  3. Transferencia
  4. Efectivo
  5. GoCuotas hasta 4 cuotas con débito
</formas_de_pago>`,
        },
    },
    {
        key: 'saldos',
        agentOnly: 'executive',
        trigger: ({ text }) =>
            /saldo|deb[oe]|deuda|cuanto falta|resta|sen[aá]|pagar|pague|estado de|mi pedido|retir|factur|comprobante/.test(text),
        text: {
            executive: `<consultas_de_saldos_y_pagos>
  ⚠️ RESPUESTAS SOBRE SALDOS Y FORMAS DE PAGO (REGLAS ESTRICTAS DE EXACTITUD):
  1. VERIFICACIÓN OBLIGATORIA: Ante cualquier consulta de saldo o estado de pago (ej: "me pasás el saldo?", "cuánto debo?"), es MANDATORIO usar 'get_order_status' (pasá el clientId, o el orderId si lo tenés). PROHIBIDO inventar números, calcular de memoria, o usar montos del historial de chat o de la ficha del cliente.
  2. MONTOS EXACTOS DEL SISTEMA: La herramienta devuelve el saldo YA CALCULADO por el sistema para cada forma de pago (efectivo, transferencia y tarjeta con sus cuotas), contemplando descuentos y ajustes del pedido. Informá SIEMPRE las tres opciones con esos montos TAL CUAL. TERMINANTEMENTE PROHIBIDO aplicar descuentos, recargos o porcentajes por tu cuenta: los descuentos por forma de pago ya están aplicados en los montos que te da la herramienta.
  3. COMPLEMENTOS: Para transferencia ofrecé pasarle el CBU/Alias de inmediato. Para tarjeta ofrecé enviarle un link de pago. Podés mencionar también Naranja Plan Z (3 cuotas sin interés) y GoCuotas (hasta 4 cuotas con débito) sobre el monto de tarjeta, sin alterar los números.
  4. SI NO HAY SALDO VERIFICADO: Si 'get_order_status' no devuelve el desglose verificado del sistema, NO respondas ningún monto ni estado (ni aproximado). Seguí la instrucción interna de la herramienta: creá la tarea para un humano y apagate en silencio. Es preferible no responder a dar un saldo incorrecto.
</consultas_de_saldos_y_pagos>`,
        },
    },
    {
        key: 'multifocales',
        trigger: ({ text }) => /multifocal|bifocal|progresiv|cerca y (de )?lejos|lejos y (de )?cerca|varilux/.test(text),
        text: {
            sales: `<multifocales_y_bifocales>
  - MULTIFOCALES: Cuando expliques qué es un multifocal, es OBLIGATORIO que pegues exactamente este texto en tu respuesta: [IMAGE: https://crm-atelier-production-ae72.up.railway.app/api/storage/view?key=agent_1780528296961_multifocales.jpg]
  - BIFOCALES: Cuando expliques qué es un bifocal, es OBLIGATORIO que pegues exactamente este texto en tu respuesta: [IMAGE: https://crm-atelier-production-ae72.up.railway.app/api/storage/view?key=agent_1780528106345_BIFOCAL.jpg]
  - 🏠 A DISTANCIA: Multifocales a distancia mediante videollamada o foto.
</multifocales_y_bifocales>`,
            executive: `<multifocales_y_bifocales>
  - MULTIFOCALES: "Son lentes progresivos que permiten ver a todas las distancias sin saltos de imagen." Tallado: Convencional (CNC) o Digital (Free Form).
  - 🏠 A DISTANCIA: Multifocales a distancia mediante videollamada o foto.
</multifocales_y_bifocales>`,
        },
    },
    {
        key: 'lentes_contacto',
        trigger: ({ text }) => /contacto|lentilla|biofinity|toric|blanda|descartable/.test(text),
        text: {
            '*': `<lentes_de_contacto>
  - LENTES DE CONTACTO: Esféricas mensuales en stock. Retiro en local o envío gratis fuera de Córdoba.
</lentes_de_contacto>`,
        },
    },
    {
        key: 'productos',
        trigger: ({ text }) => /armazon|marco|clip|wicue|gafa|de sol|anteojos de sol|modelo|estilo/.test(text),
        text: {
            sales: `<armazones_y_productos>
  - ARMAZONES: Desde $100.000. NO tenés fotos de armazones para enviar: NUNCA prometas mandar fotos ni digas que no las encontraste. Contale que hay muchísima variedad de estilos, preguntale qué estilo busca e invitalo a probárselos en el local.
  - CLIP-ONS: Ofrecer únicamente el Clip-on normal. Prohibido ofrecer o mencionar clip-ons de niño/Kids. NO le aclares al cliente que es "para adultos" (es un dato innecesario), simplemente pasale el valor.
  - GAFAS WICUE: Se oscurecen con botón, sin graduación. Link: https://atelieroptica.com.ar/productos/gafasinteligentes/
</armazones_y_productos>`,
            executive: `<armazones_y_productos>
  - ARMAZONES: Desde $100.000. NO tenés fotos de armazones para enviar: NUNCA prometas mandar fotos ni digas que no las encontraste. Contale que hay muchísima variedad de estilos, preguntale qué estilo busca e invitalo a probárselos en el local.
  - CLIP-ONS: Ofrecer únicamente Clip-on de Adulto. Prohibido ofrecer, mencionar o consultar por de niño/Kids. No envíes ningún link de producto para Clip-ons. NO tenés fotos de clip-ons: NUNCA prometas mandarlas ni digas que no las encontraste; pasale el valor y describilo en texto.
  - GAFAS WICUE: Se oscurecen con botón, sin graduación. Link: https://atelieroptica.com.ar/productos/gafasinteligentes/
</armazones_y_productos>`,
        },
    },
    {
        key: 'tiempos',
        trigger: ({ text }) => /demora|tarda|cuando (est|lleg|lo|se)|tiempo|dias habiles|listo|entrega|retir|fabrica|laboratorio/.test(text),
        text: {
            '*': `<tiempos_de_confeccion>
  [TIEMPOS_CONFECCION]
</tiempos_de_confeccion>`,
        },
    },
    {
        key: 'llamadas',
        trigger: ({ text }) => /llam|hablar por tel|telefono|turno|ir al local|pasar por|visitar|cuando abren|horario/.test(text),
        text: {
            '*': `<reglas_llamadas_y_horarios>
  1. No ofrezcas llamar por defecto. Solo si el cliente lo pide explícitamente.
  2. Atención online 24/7 sin apagar el bot por horario.
  3. Si pide llamada:
     - En horario comercial (L-V 9-13:30 / 16-19:30, Sáb 10-14): "Perfecto, ahí te llamamos." -> 'create_task' ("Llamar urgente") + 'cancel_bot'.
     - Fuera de horario: "Agendo para que te llamemos mañana apenas abrimos, te parece?" -> 'create_task' ("Llamar mañana") (no apagar el bot).
  4. Si pide ir al local fuera de horario: explica horarios y ofrece seguir online.
</reglas_llamadas_y_horarios>`,
        },
    },
    {
        key: 'post_venta',
        trigger: ({ text }) => /reclamo|garantia|falla|roto|rompi|rayado|arregl|ajust|molest|duele|veo mal|no veo|no me adapto|queja|defecto/.test(text),
        text: {
            '*': `<post_venta>
  - POST-VENTA/RECLAMOS: Empatía, recopila detalles, di "Voy a derivar tu caso..." -> 'report_complaint' + 'cancel_bot'.
</post_venta>`,
        },
    },
];

/**
 * Arma el bloque de módulos contextuales para el turno actual.
 * @param {Object} params
 * @param {string} params.agentType - 'sales' | 'executive'
 * @param {Array}  params.messages - Mensajes LangChain del estado
 * @param {Object} params.clientData - Ficha del cliente (puede ser null)
 * @param {string} params.chatSummary - Resumen persistente del chat (puede ser null)
 * @returns {string} Texto de los módulos activos (o cadena vacía)
 */
function buildContextModules({ agentType, messages, clientData, chatSummary }) {
    const { conversationText, hasImage } = getConversationSignals(messages);
    // El resumen persistente también dispara módulos: si dice "cotización entregada
    // de multifocales", las reglas de precios siguen cargadas aunque las palabras
    // clave hayan salido de la ventana de mensajes recientes. Sin pérdida de contexto
    // en conversaciones largas o retomadas días después.
    const summaryText = normalizeText(chatSummary || '');
    const signals = { text: conversationText + '\n' + summaryText, hasImage, clientData: clientData || null };

    const active = [];
    for (const mod of MODULES) {
        if (mod.agentOnly && mod.agentOnly !== agentType) continue;
        let triggered = false;
        try {
            triggered = mod.trigger(signals);
        } catch (e) {
            // Ante error del selector, incluir el módulo (mejor de más que de menos)
            triggered = true;
        }
        if (!triggered) continue;
        const text = mod.text[agentType] || mod.text['*'];
        if (text) active.push(text);
    }

    return active.join('\n\n');
}

module.exports = { buildContextModules, getConversationSignals, MODULES };
