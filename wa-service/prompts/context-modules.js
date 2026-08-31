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

/**
 * Datos comerciales: se leen del espejo CommonJS, que tiene chequeo de paridad
 * en CI contra `src/lib/business-info.ts` (`npm run check:businessinfo`).
 * NO escribir a mano un horario, un porcentaje ni una franja acá abajo: si el
 * valor cambia en `business-info.ts`, tiene que llegar por este require.
 */
const {
    APPOINTMENT_SLOTS,
    EXAM_SLOTS,
    DISCOUNT_CASH_PERCENT,
    DISCOUNT_TRANSFER_PERCENT,
    RECARGO_MP_CUOTAS_LARGAS,
} = require('../shared/business-info');

/**
 * Formas de pago vigentes. Los números salen del espejo de arriba.
 *
 * Por qué se reescribió (30/8/2026): el bloque decía "3 o 6 cuotas sin interés,
 * Naranja Plan Z, transferencia, efectivo, GoCuotas" y a un "se puede en 12
 * cuotas?" el bot contestaba "en 12 cuotas no trabajamos" — falso desde el
 * 27/8, cuando entraron a producción las 12 cuotas de Mercado Pago Ishtar.
 *
 * 31/8/2026: los porcentajes dejaron de estar escritos a mano acá (se
 * interpolan del espejo) y se agregó la prohibición explícita de calcular la
 * cuota a mano. `get_price_list` es la única fuente de un número en pesos.
 */
const FORMAS_DE_PAGO = `<formas_de_pago>
  1. EFECTIVO o TRANSFERENCIA: ${DISCOUNT_CASH_PERCENT}% de descuento sobre el precio de lista (efectivo ${DISCOUNT_CASH_PERCENT}%, transferencia ${DISCOUNT_TRANSFER_PERCENT}%). Es la opción que se ofrece PRIMERO.
  2. TARJETAS BANCARIAS: 3 o 6 cuotas SIN INTERÉS (al precio de lista).
  3. MERCADO PAGO: hasta 12 cuotas. Las de 12 llevan ${RECARGO_MP_CUOTAS_LARGAS}% de costo financiero y SIEMPRE hay que aclararlo. PROHIBIDO decir "12 cuotas sin interés" o que no tienen recargo: sin interés son solo 3 y 6.
  4. NARANJA Plan Z: 3 cuotas sin interés.
  5. GOCUOTAS: hasta 4 cuotas con débito.
  ⚠️ PROHIBIDO decir que "no trabajamos en 12 cuotas": sí trabajamos, con Mercado Pago y el ${RECARGO_MP_CUOTAS_LARGAS}% aclarado.
  ⚠️ PROHIBIDO calcular una cuota, un descuento o un total a mano. Los montos salen de 'get_price_list' y se copian tal cual.
</formas_de_pago>`;

// ── Normalización del texto de conversación ──
function normalizeText(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Extrae señales de los últimos mensajes (LangChain messages) para el selector.
 */
// `take` pasó de 12 a 30 el 31/8/2026: 12 era la ventana de la que salían los
// disparadores de módulos, y el bot manda varias burbujas por turno (cada una
// es una fila del historial). Con un presupuesto de 3 opciones + 3 fotos, 12
// mensajes son DOS intercambios reales: las reglas de precios o de receta se
// apagaban a mitad de la charla y el bot volvía a preguntar lo ya dicho. 30 es
// el mismo tamaño que trae el historial (`bot-cloud.js` → HISTORY_SIZE), así
// que mirar menos era descartar contexto que ya estaba cargado y pago.
function getConversationSignals(messages, take = 30) {
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

// ─────────────────────────────────────────────────────────────────────────────
// ¿Ya hay mensajes NUESTROS en este hilo?
//
// El minado de 264 conversaciones reales (scripts/maintenance/bot-eval) dejó
// "repite el saludo / se re-presenta" como la falla #1: 89 conversaciones. El
// caso que más duele es conv-017: una compañera había escrito "Hola buen dia
// Clau mi nombre es Mile" y el bot contestó después "Hola Claudia, buen día 😊
// Soy Matías de Atelier Óptica, contame qué estás necesitando" — o sea, se
// presentó en una charla que ya estaba abierta y con otro nombre firmando. Son
// 27 conversaciones en las que la presentación NO cae en el primer saliente.
//
// La regla ya estaba escrita en el prompt (regla 5 de estilo) y no alcanzó: es
// una línea más entre sesenta. Acá se refuerza de forma PROGRAMÁTICA — el
// módulo solo se inyecta cuando el historial efectivamente tiene un mensaje
// nuestro, y le muestra al modelo el texto exacto con el que ya arrancamos la
// conversación, que es mucho más difícil de ignorar que una prohibición
// genérica.
// ─────────────────────────────────────────────────────────────────────────────

/** Un mensaje del historial que salió de nuestro lado (bot, vendedora o seguimiento). */
function esMensajeNuestro(m) {
    if (!m) return false;
    try {
        if (typeof m._getType === 'function') return m._getType() === 'ai';
    } catch {
        // Un mensaje raro no puede voltear el armado del prompt.
    }
    const tipo = m.role || m.type || (m.constructor && m.constructor.name) || '';
    return /^ai/i.test(String(tipo)) || String(tipo) === 'AIMessage';
}

/** Texto plano de un mensaje del historial (puede venir multimodal). */
function textoDeMensaje(m) {
    const content = m && m.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content.filter(p => p && p.type === 'text' && p.text).map(p => p.text).join(' ');
    }
    return '';
}

/**
 * Señales de "esta charla ya está empezada": si hubo mensajes nuestros y cuál
 * fue el primero (el que ya cumplió la función de saludo y presentación).
 */
function getHistorySignals(messages) {
    const nuestros = (messages || []).filter(esMensajeNuestro);
    if (nuestros.length === 0) return { yaHablamos: false, primerMensajeNuestro: '' };
    const primero = textoDeMensaje(nuestros[0])
        // Los mensajes del historial llegan con el sello de fecha adelante
        // ("[mar, 4 ago, 21:26] "): sacarlo deja la frase que se leyó el cliente.
        .replace(/^\[[^\]]{5,40}\]\s*/, '')
        .replace(/\s+/g, ' ')
        .trim();
    return { yaHablamos: true, primerMensajeNuestro: primero.slice(0, 160) };
}

// ── Definición de módulos ──
const MODULES = [
    {
        key: 'conversacion_en_curso',
        trigger: ({ yaHablamos }) => yaHablamos === true,
        text: {
            '*': ({ primerMensajeNuestro }) => `<conversacion_ya_empezada>
  ⛔ ESTA CONVERSACIÓN YA ESTÁ EMPEZADA: en el historial YA hay mensajes enviados por nosotros${primerMensajeNuestro ? `. El primero fue: "${primerMensajeNuestro}"` : '.'}
  Por lo tanto, en este turno:
  - PROHIBIDO saludar. Nada de "Hola", "Hola [nombre]", "Buenas", "Buen día", "Cómo andás?" ni ninguna apertura de primer contacto. Tu respuesta arranca directo por el tema.
  - PROHIBIDO presentarte de nuevo, con cualquier fórmula ("soy el asistente de Atelier", "te habla..."). El cliente ya sabe con quién habla.
  - Da igual cuánto tiempo pasó, que el cliente haya tardado días en responder, que el tema haya cambiado o que el mensaje nuestro anterior lo haya escrito una compañera firmando con su nombre: la charla es la misma y volver a presentarse delata que no estás leyendo.
  - PROHIBIDO repetir textual una frase que ya dijimos en este hilo (sobre todo los sondeos tipo "pudiste ver las opciones?" / "querés que te mande fotitos?"). Si ya la usaste, decilo con otras palabras o avanzá a otra cosa.
  - ⚠️ Algunos de esos mensajes nuestros los escribió una PERSONA del equipo, no vos. Todo lo que ahí se dijo, se prometió o se preguntó ya está dicho: no lo repreguntes ni lo contradigas. Si una compañera ya le pasó un precio o le prometió algo, seguí desde ahí.
</conversacion_ya_empezada>`,
        },
    },
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
  - LA FECHA DE LA RECETA NO IMPORTA: cualquier receta, de cuando sea, sirve para presupuestar. Nunca la mires para decidir, nunca la comentes, nunca digas que es vieja o que está vencida y nunca pidas una más nueva.
  - Tampoco le pidas que te dicte los valores ni le digas que la foto no se ve: leelos vos.
  - Después de guardar, cotiza usando 'get_price_list' pasando 'chatId' y 'clientId'.
</lectura_multimodal>`,
            executive: `<lectura_multimodal>
  Si el cliente envía una receta médica nueva, lee AMBOS ojos con precisión (OD y OI: Esfera, Cilindro, Eje).
  - Guarda los valores ORIGINALES (sin transponer) usando 'save_prescription_data'.
  - NO le repitas al cliente los valores de la receta (esferas, cilindros, ejes, etc.). Confirmá breve que la recibiste ("Perfecto, ya la tengo") y pasá directo a cotizar. NUNCA le anuncies que estás guardando o registrando sus datos.
  - LA FECHA DE LA RECETA NO IMPORTA: cualquier receta, de cuando sea, sirve para presupuestar. Nunca la mires para decidir, nunca la comentes, nunca digas que es vieja o que está vencida y nunca pidas una más nueva.
  - Tampoco le pidas que te dicte los valores ni le digas que la foto no se ve: leelos vos.
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
            // Reescrito el 31/8/2026. El texto anterior ordenaba "con obra social
            // incluye descuento en el precio" y "obra social -> particular: sumar
            // 15%", sin que exista NINGÚN dato de cobertura en el sistema
            // (`Client.insurance` es texto libre con el nombre; no hay tabla de
            // convenios ni porcentajes — verificado en prisma/schema.prisma y src/).
            // Resultado real: en conv-142 el bot leyó "SAD y DAS" del membrete de
            // una receta y le dijo a la clienta "con eso tenés un 20% de descuento
            // en cristales". Era falso, y ella lo corrigió: "no soy afiliada, es un
            // rp de los policonsultorios". El modelo de negocio es REINTEGRO
            // (src/app/obras-sociales/page.tsx), no cobertura directa.
            '*': `<obra_social>
  🏥 OBRA SOCIAL — LO QUE SÍ Y LO QUE NO:
  - PROHIBIDO decir cualquier porcentaje o monto de cobertura, o dar a entender que el precio baja por tener obra social. NO tenemos ningún dato de cobertura: inventarlo es prometer plata que después no aparece.
  - PROHIBIDO deducir la obra social del membrete de una receta. Un sello de un consultorio no es una afiliación. Si no lo dijo el cliente, no lo sabés.
  - Qué se contesta, siempre igual: trabajamos con todas. La óptica te entrega la factura y la documentación para que pidas el REINTEGRO a tu obra social o prepaga; cuánto te reintegran depende del plan que tengas, eso lo confirmás con ellos. El presupuesto que te paso es el precio final.
  - Preguntala UNA SOLA VEZ, y solo si viene al caso. Si el cliente la ignora o insiste con el precio, cotizá y no vuelvas a preguntar nunca más.
  - No inventes nombres de obras sociales a partir de siglas.
  - REGISTRO (OBLIGATORIO): al usar 'convert_into_lead' o 'save_prescription_data', completá 'insurance' con el nombre exacto que dijo el cliente, o "Particular" si dijo que no tiene o no contestó.
  - PAMI: no trabajamos directo. No cierres la puerta: "Con PAMI directamente no trabajamos, pero hay opciones que PAMI no cubre y te puedo mostrar. Tenés tu recetita?"
</obra_social>`,
        },
    },
    {
        // ─────────────────────────────────────────────────────────────────────
        // Turnos: el examen visual NO se toma en cualquier horario.
        //
        // `BUSINESS_INFO.examSlots` (src/lib/business-info.ts, regla que dio
        // Ishtar el 31/8/2026) — espejo CommonJS en shared/business-info.js con
        // chequeo de paridad en CI (`npm run check:businessinfo`).
        //
        // Por qué hace falta: en conv-047 el bot contestó "No es necesario que
        // vaya con receta si viene a nuestro local. Aquí podemos hacerle el
        // control visual completo" y acto seguido pasó el horario del local
        // (8 a 20). O sea, ofreció un turno de graduación que no se puede
        // cumplir. Los humanos sí lo aclaran, y explican el motivo — conv-036:
        // "lo ideal seria entre las 11.30 y 16hs que en la optica estamos los 2
        // profesionales para poder atenderlo bien".
        // ─────────────────────────────────────────────────────────────────────
        key: 'turnos_y_graduacion',
        trigger: ({ text }) => /turno|graduaci|agudeza|control visual|examen|medir la vista|tomar.{0,12}(vista|medida)|revisar.{0,12}(vista|graduacion)|sin receta|no tengo receta/.test(text),
        text: {
            '*': `<turnos_y_graduacion>
  👓 DOS COSAS DISTINTAS, NO LAS MEZCLES:
  - VISITA AL LOCAL (probarse armazones, retirar, consultar, elegir modelos): cualquier hora del horario de atención, ${APPOINTMENT_SLOTS}. No hace falta turno.
  - TOMA DE GRADUACIÓN (control visual / medir la vista): SOLO ${EXAM_SLOTS}. Es la única franja en la que están los dos profesionales.
  ⚠️ Si el cliente no tiene receta y quiere que le tomemos la graduación, decile la franja ANTES de que elija el día. Prometer un control visual "cuando quieras" es prometer algo que no se puede cumplir.
  - Cómo se dice, natural: "para tomarte la graduación te esperamos entre las 12 y las 16, que es cuando están los dos profesionales. Para probarte armazones venís a la hora que quieras."
  - El control visual no tiene costo con la compra del anteojo.
</turnos_y_graduacion>`,
        },
    },
    {
        key: 'precios',
        trigger: ({ text }) =>
            /precio|cuest|cuant|valor|presupuest|cotiz|cuota|promo|descuent|barat|caro|oferta|2x1|pagar|pago|efectivo|transferencia|tarjeta|sale[nn]?\b/.test(text),
        text: {
            // Reescrito el 31/8/2026. Tres cosas se fueron de acá:
            //
            // 1. "Sumar $30.000 internamente al presupuesto (NUNCA informar al
            //    cliente)". Un cargo invisible. Si la medición tiene costo, va
            //    como línea con nombre y precio; si no, no va.
            // 2. "2 pares de cristales + segundo armazón sin cargo". El bot lo
            //    prometía por su cuenta (conv-141, conv-153, conv-170) sin poder
            //    verificarlo: `Product.eligible2x1` se tilda a mano y hoy hay 0
            //    armazones tildados sobre 481 en la base local. Lo que la promo
            //    incluye ahora se dice tal cual lo devuelve 'get_price_list'.
            //    ⚠️ El equipo humano SÍ ofrece el armazón bonificado todos los
            //    días y lo entrega (conv-014, conv-251, conv-153). O sea: la
            //    promo existe, lo que falta es el dato tildado en Stock. Está
            //    anotado en docs/como-atiende-bien-atelier.md para que Ishtar
            //    decida — mientras tanto el bot no promete lo que no puede ver.
            // 3. 'aptoMiPrimerVarilux' / 'aptoMr7Asferico': no existen en el
            //    schema ni en el endpoint; graph.js:282 siempre imprime "No".
            //    Eran reglas muertas ocupando lugar en el prompt.
            '*': `<precios_y_presupuestos>
  - Los precios salen SOLO de 'get_price_list' y se copian TAL CUAL. Prohibido calcular, redondear, estimar o actualizar un precio de memoria.
  - Máximo 3 opciones, separadas por una línea en blanco:
    [IMAGE: <url>] (solo si la opción vino con foto)
    *Opción N – Nombre completo*
    • Precio contado: $xx.xxx
    • 6 cuotas sin interés de $xx.xxx (total $xx.xxx)
    Una mini-descripción por opción, en criollo ("AR" se escribe "Antirreflejo").
  - Cerrá con una sola línea: "contame qué opción te gusta más?". Nada más después.
  - Si el cliente pregunta por 12 cuotas: usá 'cuota12' y 'total12' si la herramienta te los dio. Si NO te los dio, no los calcules: decile que las 12 son con Mercado Pago y llevan 10% de costo financiero, y ofrecé pasarle el número exacto (derivá con 'create_task').
  - Si un producto que te piden no aparece en la lista: no digas que no lo encontraste ni inventes un precio. Derivá despidiéndote ('create_task' con "Falta precio de artículo específico").
  - 📋 SIN RECETA: se cotiza igual, con los valores que haya. Nunca sumes un cargo que no le dijiste al cliente: todo lo que se cobra se nombra.
  - 🎁 PROMO 2x1: solo multifocales (los que vienen con is2x1). Decí exactamente lo que la herramienta dice que incluye, ni una palabra más — no prometas armazones sin cargo por tu cuenta. Con monofocales corregí amable: "la promo 2x1 es solo para multifocales".
</precios_y_presupuestos>

<upselling_y_restricciones>
  - Fotocromáticos: no los ofrezcas salvo que los pidan.
  - Cristales teñidos monofocales: el policarbonato no se tiñe, solo el orgánico blanco.
</upselling_y_restricciones>

${FORMAS_DE_PAGO}`,
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
  - MULTIFOCALES: "Son lentes progresivos que te permiten ver bien a todas las distancias (lejos, intermedio y cerca) sin saltos de imagen y con un solo anteojo."
  - BIFOCALES: "Tienen dos zonas bien definidas: la parte de arriba para lejos y la ventanita de abajo para cerca."
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
  - ARMAZONES: Desde $100.000. SÍ tenés fotos para mandarle: usá 'send_product_photos' (manda hasta 3, con el nombre y el precio de contado al pie). Mandalas cuando las pida, cuando te diga que sí a tu ofrecimiento, o cuando te cuente qué modelito le gustó de la tienda (pasá ese nombre en 'search'). Si querés ofrecerlas, ofrecelas UNA vez y esperá el sí. Después de mandarlas, una sola línea corta: cuál te gustó más? E invitalo igual a probárselos en el local.
  - CLIP-ONS: Ofrecer únicamente el Clip-on normal. Prohibido ofrecer o mencionar clip-ons de niño/Kids. NO le aclares al cliente que es "para adultos" (es un dato innecesario), simplemente pasale el valor.
  - GAFAS WICUE: Se oscurecen con botón, sin graduación. Link: https://atelieroptica.com.ar/producto/wicue-cargador-regulable
</armazones_y_productos>`,
            executive: `<armazones_y_productos>
  - ARMAZONES: Desde $100.000. SÍ tenés fotos para mandarle: usá 'send_product_photos' (manda hasta 3, con el nombre y el precio de contado al pie), solo cuando el cliente pida ver modelos o acepte que se las mandes. Después, una sola línea corta preguntando cuál le gustó, e invitalo a probárselos en el local.
  - CLIP-ONS: Ofrecer únicamente Clip-on de Adulto. Prohibido ofrecer, mencionar o consultar por de niño/Kids. No envíes ningún link de producto para Clip-ons.
  - GAFAS WICUE: Se oscurecen con botón, sin graduación. Link: https://atelieroptica.com.ar/producto/wicue-cargador-regulable
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
  1. No ofrezcas llamar por defecto. Solo si el cliente lo pide.
  2. Atendés online a toda hora: no te apagues por el horario.
  3. Si pide que lo llamen:
     - En horario de atención (${APPOINTMENT_SLOTS}): despedite con "Perfecto, ahí te llamamos 😊" y en el mismo turno 'create_task' ("Llamar urgente"). Escribí la despedida SIEMPRE: derivar no es desaparecer.
     - Fuera de horario: "Te agendo para que te llamemos mañana apenas abrimos, te parece?" -> 'create_task' ("Llamar mañana"), y seguí la charla normalmente.
  4. Si quiere venir fuera de horario: pasale los horarios y ofrecele seguir por acá mientras tanto.
</reglas_llamadas_y_horarios>`,
        },
    },
    {
        key: 'post_venta',
        trigger: ({ text }) => /reclamo|garantia|falla|roto|rompi|rayado|arregl|ajust|molest|duele|veo mal|no veo|no me adapto|queja|defecto/.test(text),
        text: {
            '*': `<post_venta>
  - POST-VENTA / RECLAMOS: primero la persona, después el trámite. Escuchá, dale la razón sin discutir y pedí el detalle que falte.
  - No intentes resolverlo vos ni lo tapes con opciones o promociones: un cliente enojado al que le ofrecen un presupuesto se enoja más.
  - Cuando tengas el detalle: despedite ("Ya lo paso al equipo para que lo resuelvan y te contestan a la brevedad 🙏") y en el mismo turno llamá a 'report_complaint'. La despedida va SIEMPRE — nunca lo dejes sin respuesta.
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
    const { yaHablamos, primerMensajeNuestro } = getHistorySignals(messages);
    const signals = {
        text: conversationText + '\n' + summaryText,
        hasImage,
        clientData: clientData || null,
        yaHablamos,
        primerMensajeNuestro,
    };

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
        // Un módulo puede armar su texto con las señales del turno (ej. citar el
        // primer mensaje que ya le mandamos al cliente).
        let resuelto = text;
        if (typeof text === 'function') {
            try {
                resuelto = text(signals);
            } catch {
                // Un módulo que no puede armar su texto no puede voltear el turno.
                resuelto = '';
            }
        }
        if (resuelto) active.push(resuelto);
    }

    return active.join('\n\n');
}

module.exports = { buildContextModules, getConversationSignals, getHistorySignals, MODULES };
