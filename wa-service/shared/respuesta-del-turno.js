'use strict';

/**
 * De "lo que devolvió el grafo" a "las burbujas que se mandan". Una sola
 * función para los dos bots (`bot-cloud.js` e `index.js`), sin I/O: decide,
 * no envía. El envío lo hace cada bot, burbuja por burbuja, por el transporte
 * (que exige origen y vuelve a revisar cada texto del modelo).
 *
 * POR QUÉ un módulo aparte (10/10/2026): cada bot armaba la respuesta a su
 * manera — `index.js` con un anti-repetición literal propio, `bot-cloud.js`
 * con otro — y las fotos de `send_product_photos` salían por un tercer camino,
 * desde adentro del grafo, sin pasar por ninguno de los controles del turno.
 * Acá entra todo lo que el turno quiere decir y sale UNA lista ordenada.
 *
 * Una burbuja es `{ texto, imagenes: string[], origen: 'llm'|'sistema' }`.
 */

const {
    sanearBloques, quitarRepeticiones, limitarEmojis, partirEnBurbujas, FRASE_EN_VEZ_DE_DERIVAR,
} = require('./limpiar-salida-bot');

/** Herramientas de "respuesta estructurada" (graph.js): cierran el turno. */
const HERRAMIENTA_RESPONDER = 'responder_al_cliente';
const HERRAMIENTA_NO_RESPONDER = 'no_responder';
const HERRAMIENTAS_DE_SALIDA = new Set([HERRAMIENTA_RESPONDER, HERRAMIENTA_NO_RESPONDER]);

/**
 * Herramientas que dejan a ALGUIEN encargado de volver a escribirle al
 * cliente. Solo con una de estas corrida en el turno, "Lo confirmo y te escribo
 * en un ratito" es una promesa que alguien va a cumplir.
 */
const HERRAMIENTAS_DE_DERIVACION = new Set(['create_task', 'pedir_ayuda', 'report_complaint', 'cancel_bot']);

const IMAGEN = /\[IMAGE:\s*(https?:\/\/[^\]\s]+)\s*\]/gi;

/** Solo las partes de TEXTO de un mensaje (nunca 'thinking' ni 'reasoning'). */
function textoDe(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content.map(p => (typeof p === 'string' ? p
            : (p && typeof p.text === 'string' && (!p.type || p.type === 'text') ? p.text : ''))).join('');
    }
    return '';
}

/**
 * Lee la salida del grafo.
 *
 * @param {{ messages?: any[], salidaFinal?: object }} resultado lo que devolvió `graph.invoke`
 * @param {number} [desde] cuántos mensajes eran historial (no se miran sus tool_calls)
 * @returns {{
 *   tipo: 'responder'|'callar'|'texto'|'vacio',
 *   mensajes: string[], motivo?: string,
 *   herramientas: Set<string>,      // las que corrieron en ESTE turno
 *   cortadoPorBucle: boolean,
 * }}
 */
function leerSalidaDelGrafo(resultado, desde = 0) {
    const mensajes = Array.isArray(resultado && resultado.messages) ? resultado.messages : [];
    const delTurno = mensajes.slice(Math.max(0, desde));
    const herramientas = new Set();
    for (const m of delTurno) {
        for (const c of (Array.isArray(m && m.tool_calls) ? m.tool_calls : [])) {
            if (c && c.name && !HERRAMIENTAS_DE_SALIDA.has(c.name)) herramientas.add(c.name);
        }
    }
    const cortadoPorBucle = Boolean(resultado && resultado.loopBroken);
    const base = { herramientas, cortadoPorBucle };

    // El auditor del grafo ya dejó la salida resuelta.
    const sf = resultado && resultado.salidaFinal;
    if (sf && sf.tipo) {
        if (sf.tipo === 'callar') return { ...base, tipo: 'callar', mensajes: [], motivo: sf.motivo || '' };
        const ms = (sf.mensajes || []).map(String).filter(t => t.trim());
        return { ...base, tipo: ms.length ? sf.tipo : 'vacio', mensajes: ms };
    }

    // Grafo sin auditor nuevo (o un resultado armado a mano): el último mensaje.
    const ultimo = delTurno[delTurno.length - 1] || mensajes[mensajes.length - 1];
    if (!ultimo) return { ...base, tipo: 'vacio', mensajes: [] };
    const llamada = (ultimo.tool_calls || []).find(c => HERRAMIENTAS_DE_SALIDA.has(c.name));
    if (llamada && llamada.name === HERRAMIENTA_NO_RESPONDER) return { ...base, tipo: 'callar', mensajes: [], motivo: (llamada.args || {}).motivo || '' };
    if (llamada) {
        const ms = mensajesDeResponder(llamada.args);
        return { ...base, tipo: ms.length ? 'responder' : 'vacio', mensajes: ms };
    }
    const t = textoDe(ultimo.content).trim();
    return { ...base, tipo: t ? 'texto' : 'vacio', mensajes: t ? [t] : [] };
}

/** Los `mensajes` de una llamada a `responder_al_cliente`, tolerando formas raras. */
function mensajesDeResponder(args) {
    const a = args || {};
    let ms = a.mensajes ?? a.messages ?? a.texto ?? a.text;
    if (typeof ms === 'string') ms = [ms];
    return Array.isArray(ms) ? ms.map(x => String(x ?? '')).filter(t => t.trim()) : [];
}

/** Separa las `[IMAGE: url]` del texto de un bloque. */
function separarImagenes(bloque) {
    const imagenes = [];
    IMAGEN.lastIndex = 0;
    let m;
    while ((m = IMAGEN.exec(bloque)) !== null) imagenes.push(m[1]);
    IMAGEN.lastIndex = 0;
    const texto = bloque.replace(IMAGEN, '').replace(/[ \t]{2,}/g, ' ').replace(/\n{2,}/g, '\n').trim();
    return { texto, imagenes };
}

/**
 * Arma las burbujas del turno.
 *
 * @param {object} p
 * @param {ReturnType<typeof leerSalidaDelGrafo>} p.salida
 * @param {Array<{ texto: string, imagenes?: string[] }>} [p.encolados]  envíos que encolaron las herramientas (fotos)
 * @param {string[]} [p.dichoAntes]  lo último que dijeron el bot y el equipo (anti-repetición)
 * @param {null|{ fase: string, validar: (t: string) => { ok: boolean, motivo?: string }, respaldo: string }} [p.restriccion]
 *        turno de apertura (shared/fase-de-la-charla.js → restriccionDeFase): si
 *        el modelo calla, falla o mete un precio/foto/link, sale `respaldo`
 *        (el saludo armado por el código). Un primer contacto nunca queda sin respuesta.
 * @returns {{
 *   accion: 'enviar'|'callar'|'rechazar'|'nada',
 *   burbujas: Array<{ texto: string, imagenes: string[], origen: 'llm'|'sistema' }>,
 *   textoLLM: string,                 // lo del modelo, junto (para el guardrail del turno)
 *   motivo?: string, quitado: string[], repetidas: string[],
 *   escalar: null | { motivo: string },  // derivó o prometió sin herramienta → crear la tarea desde el código
 * }}
 */
function armarRespuesta({ salida, encolados = [], dichoAntes = [], restriccion = null }) {
    if (restriccion) return armarRespuestaDeApertura({ salida, dichoAntes, restriccion });
    // Lo que encolaron las herramientas lo eligió el SISTEMA (foto + nombre +
    // precio de la base): sale aunque el modelo se calle, y antes del texto,
    // que es "cuál te gustó" sobre esas fotos.
    const delSistema = (encolados || [])
        .map(e => ({ texto: String(e.texto || '').trim(), imagenes: (e.imagenes || []).filter(Boolean), origen: 'sistema' }))
        .filter(b => b.texto || b.imagenes.length);
    const resultado = (extra) => ({ burbujas: delSistema, textoLLM: '', quitado: [], repetidas: [], escalar: null, ...extra });

    if (!salida || salida.tipo === 'vacio') return resultado({ accion: delSistema.length ? 'enviar' : 'nada' });
    if (salida.tipo === 'callar') return resultado({ accion: delSistema.length ? 'enviar' : 'callar', motivo: salida.motivo || 'el modelo decidió no responder' });

    const s = sanearBloques(salida.mensajes);
    if (s.rechazo) {
        return resultado({ accion: delSistema.length ? 'enviar' : 'rechazar', motivo: s.rechazo.motivo, tipoRechazo: s.rechazo.tipo, quitado: s.quitado });
    }

    let bloques = s.bloques;
    const rep = quitarRepeticiones(bloques, dichoAntes);
    bloques = rep.bloques;

    // ── Derivar / prometer volver: solo con alguien encargado ───────────────
    // Antes el saneador reemplazaba cualquier derivación por "Lo confirmo y te
    // escribo en un ratito" sin crear nada: una promesa que nadie cumplía. Y
    // el corte de bucles del grafo mandaba la misma frase. Ahora la frase la
    // pone el código, y si no corrió ninguna herramienta que deje una tarea,
    // el turno la crea (`escalar`).
    const quiereApartarse = s.derivo || s.promete || salida.cortadoPorBucle;
    let escalar = null;
    if (quiereApartarse) {
        const hayEncargado = [...(salida.herramientas || [])].some(h => HERRAMIENTAS_DE_DERIVACION.has(h));
        if (!hayEncargado) {
            escalar = {
                motivo: salida.cortadoPorBucle
                    ? 'el bot se trabó repitiendo una herramienta y le dijo al cliente que le confirma en un rato'
                    : 'el bot le dijo al cliente que le confirma en un rato y no dejó ninguna tarea',
            };
        }
        if (!bloques.some(b => /te escribo en un ratito|lo confirmo y te/i.test(b))) bloques = [...bloques, FRASE_EN_VEZ_DE_DERIVAR];
    }

    // ── Burbujas: sin duplicados, partidas como escribe el equipo ───────────
    const vistos = new Set();
    const delModelo = bloques
        .filter(b => {
            const firma = b.toLowerCase().replace(/\s+/g, ' ');
            if (vistos.has(firma)) return false;
            vistos.add(firma);
            return true;
        })
        .map(separarImagenes)
        .flatMap(({ texto, imagenes }) => {
            // Una foto lleva su texto como caption: no se parte.
            if (imagenes.length) return [{ texto: limitarEmojis(texto), imagenes }];
            return partirEnBurbujas(texto).map(t => ({ texto: limitarEmojis(t), imagenes: [] }));
        })
        .filter(b => b.texto || b.imagenes.length)
        .map(b => ({ ...b, origen: 'llm' }));

    const burbujas = [...delSistema, ...delModelo];
    return {
        accion: burbujas.length ? 'enviar' : 'nada',
        burbujas,
        textoLLM: delModelo.map(b => b.texto).filter(Boolean).join('\n\n'),
        quitado: s.quitado,
        repetidas: rep.quitadas,
        escalar,
    };
}

/**
 * El turno de apertura: lo del modelo, si pasa la validación; si no, el saludo
 * del código. Lo que hayan encolado las herramientas se descarta (en la
 * apertura no hay herramientas de fotos; si algo llegó, no sale).
 */
function armarRespuestaDeApertura({ salida, dichoAntes, restriccion }) {
    const respaldo = (motivo) => ({
        accion: 'enviar',
        burbujas: [{ texto: restriccion.respaldo, imagenes: [], origen: 'sistema' }],
        textoLLM: '',
        quitado: [`saludo de apertura reemplazado por el del código (${motivo})`],
        repetidas: [],
        escalar: null,
    });
    if (!salida || salida.tipo === 'vacio') return respaldo('el modelo no dijo nada');
    if (salida.tipo === 'callar') return respaldo('el modelo eligió callarse en un primer contacto');
    const normal = armarRespuesta({ salida, encolados: [], dichoAntes });
    if (normal.accion !== 'enviar') return respaldo(normal.motivo || 'no quedó nada para decir');
    if (normal.burbujas.some(b => b.imagenes.length)) return respaldo('una foto en el saludo');
    const v = restriccion.validar(normal.textoLLM);
    if (!v.ok) return respaldo(v.motivo || 'no pasó la validación');
    return normal;
}

/**
 * Cola de envíos del turno. Las herramientas NO mandan nada: encolan acá, y
 * el turno lo manda en el mismo bucle que el texto, con todos sus controles
 * (¿escribió de nuevo el cliente?, ¿contestó una persona?, ¿se venció el
 * turno?). Se la pasa por `config.configurable.turno` a `graph.invoke`.
 */
function crearTurno() {
    const envios = [];
    const turno = {
        cancelado: false,
        envios,
        /** @param {{ texto: string, imagenes?: string[] }} envio */
        encolar(envio) {
            if (turno.cancelado) return false;
            envios.push(envio);
            return true;
        },
        cancelar() { turno.cancelado = true; envios.length = 0; },
    };
    return turno;
}

module.exports = {
    leerSalidaDelGrafo, armarRespuesta, crearTurno, textoDe, mensajesDeResponder,
    HERRAMIENTA_RESPONDER, HERRAMIENTA_NO_RESPONDER, HERRAMIENTAS_DE_SALIDA, HERRAMIENTAS_DE_DERIVACION,
};
