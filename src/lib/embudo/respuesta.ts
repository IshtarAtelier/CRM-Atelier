/**
 * QUÉ QUISO DECIR el cliente cuando contestó un seguimiento.
 *
 * Hasta el 8/10/2026 cualquier respuesta frenaba el motor para siempre
 * ("sigue una persona") y le creaba una tarea al vendedor. Medido en
 * producción ese día: de 501 oportunidades de septiembre sin comprar, 142
 * habían respondido —casi siempre un 👍, un "gracias" o un "ok"—, el motor
 * las soltó, y los vendedores cerraron 11 de esas tareas en todo el mes. El
 * embudo se perdía justo en la gente que daba señales de vida.
 *
 * Decisión de Ishtar (8/10/2026): "en embudo no debe haber nada para humano".
 * Entonces la respuesta la lee el sistema, con tres salidas y nada más:
 *
 *  - `cierre`:   dijo que no, que ya compró en otro lado, que no le escriban.
 *                Se cierra como perdido y no recibe más nada.
 *  - `posponer`: "más adelante", "cuando cobre", "por ahora no". Se pausa
 *                30 días; si para entonces sigue en la ventana, se retoma.
 *  - `seguir`:   todo lo demás (reacciones, "gracias", "ok", un audio, una
 *                pregunta). La charla viva la atiende el bot; cuando pasan
 *                las 48 h de silencio, la cadencia sigue con el toque que falta.
 *
 * Puro y sin IA a propósito: tiene que dar lo mismo en el tick, en el check de
 * CI y en la simulación. Ante la duda es `seguir`, no `cierre`: un mensaje de
 * más se perdona; marcar perdido a alguien que preguntó algo, no.
 */

export type Clasificacion = 'cierre' | 'posponer' | 'seguir';

export interface MensajeEntrante {
    content: string | null;
    type?: string | null;
}

/** "Más adelante": se mira ANTES que el cierre, porque "por ahora no" también tiene un "no". */
const POSPONER: RegExp[] = [
    /m[aá]s adelante/,
    /por ahora no/,
    /por el momento/,
    /todav[ií]a no/,
    /a[uú]n no/,
    /fin de mes|mes que viene|pr[oó]xim[oa] (mes|semana)|semana que viene/,
    /cuando (cobre|pueda|tenga|me paguen|junte)/,
    /espera(r|ndo)? (a )?cobrar|debo esperar|tengo que esperar/,
    /(lo|la) (estoy|sigo) (pensando|viendo|evaluando|analizando)|sigo viendo|lo voy a pensar/,
    /en unos d[ií]as|despu[eé]s (te|les) (aviso|escribo|digo|confirmo)|(te|les) aviso/,
    /me vuelvo a comunicar|yo (te|les) escribo|cualquier cosa (te|les) (escribo|aviso)/,
];

/**
 * Dijo que no. Sin ambigüedad, o va a `seguir`. Medido contra producción el
 * 8/10/2026 sobre 272 respuestas reales: "obra social" y "PAMI" solos eran
 * preguntas ("¿atienden por obra social?"), "ya tengo" era "ya tengo los
 * marcos, pasame presupuesto". Solo cuenta lo que no admite otra lectura.
 */
const CIERRE: RegExp[] = [
    /\bno,? (muchas )?gracias\b/,
    /\bno (me )?interesa|no estoy interesad|no me sirve|no lo necesito|no quiero|no voy a (querer|comprar|hacer)/,
    /\bno (te|les) agradezco\b/,
    /\bya (los? |las? |lo |la |me )?(compr[eé]|resolv[ií]|hice|consegu[ií]|encargu[eé]|realic[eé])/,
    /(en |por |de )otra [oó]ptica|en otro lado|en otro lugar/,
    /\b(ya|consegu[ií]).{0,20}\b(por|x|con) (el )?(pami|(la |mi )?obra social)/,
    /no (me )?(escriban|escribas|manden|mandes|molesten|molestes|insistan)/,
    /dej(a|á|en) de (escribir|mandar|insistir)|basta de|no m[aá]s mensajes/,
    /n[uú]mero equivocado|se equivocaron|no soy (yo|esa persona)|no pedí/,
    /fuera de (mi )?presupuesto|no est[aá] dentro (de mi|del) presupuesto|no me alcanza|no me convenci[oó]/,
];

/**
 * Un "No" pelado es cierre SOLO si es la primera burbuja después del toque
 * (contesta "¿pudiste ver el presupuesto?" / "¿resolviste lo de tus
 * anteojitos?"). Más adelante en la charla, "No" responde a lo que haya
 * preguntado el bot ("¿tenés la receta?") y no dice nada sobre la compra.
 */
const NO_PELADO = /^no\b[\s.,!]*(gracias|muchas gracias|te agradezco)?[\s.!]*$/;

/**
 * Una PREGUNTA es interés, aunque traiga un "no" adentro ("¿no trabajan con
 * obra social?"). Solo le gana lo que no admite otra lectura.
 */
const CIERRE_FUERTE: RegExp[] = [
    /\bya (los? |las? |lo |la |me )?(compr[eé]|resolv[ií]|hice|consegu[ií]|encargu[eé]|realic[eé])/,
    /(en |por |de )otra [oó]ptica|en otro lado|en otro lugar/,
    /no (me )?(escriban|escribas|manden|mandes|molesten|molestes|insistan)|no (sigas|sigan|sigu[aá]s) (insistiendo|escribiendo|mandando)/,
];

function normalizar(texto: string): string {
    return texto
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Las listas se escriben con tildes para leerse; se comparan sin tildes.
const sinTildes = (lista: RegExp[]) => lista.map(r => new RegExp(normalizar(r.source), r.flags));
const POSPONER_N = sinTildes(POSPONER);
const CIERRE_N = sinTildes(CIERRE);
const CIERRE_FUERTE_N = sinTildes(CIERRE_FUERTE);

/** Clasifica UN mensaje. Reacciones, audios, fotos y stickers son `seguir`. */
export function clasificarMensaje(m: MensajeEntrante, opciones: { primera?: boolean } = {}): Clasificacion {
    const tipo = (m.type || 'TEXT').toUpperCase();
    const crudo = (m.content || '').trim();
    if (tipo !== 'TEXT' || !crudo || /^\[(reacci[oó]n|mensaje audio|audio|imagen|sticker|video|documento)/i.test(crudo)) return 'seguir';
    const t = normalizar(crudo);
    if (opciones.primera && NO_PELADO.test(t)) return 'cierre';
    if (CIERRE_FUERTE_N.some(r => r.test(t))) return 'cierre';
    if (t.includes('?')) return 'seguir';
    if (POSPONER_N.some(r => r.test(t))) return 'posponer';
    if (CIERRE_N.some(r => r.test(t))) return 'cierre';
    return 'seguir';
}

/**
 * Clasifica TODO lo que contestó después del último seguimiento. Manda la
 * señal más fuerte: si en tres burbujas una dice "no, gracias", es cierre
 * aunque las otras sean un 👍.
 */
export function clasificarRespuesta(mensajes: MensajeEntrante[]): Clasificacion {
    const clases = mensajes.map((m, i) => clasificarMensaje(m, { primera: i === 0 }));
    if (clases.includes('cierre')) return 'cierre';
    if (clases.includes('posponer')) return 'posponer';
    return 'seguir';
}

/** Cuánto se pausa a quien pidió "más adelante". */
export const PAUSA_POSPONER_DIAS = 30;

/**
 * Qué cuenta como respuesta AL TOQUE: lo que escribió en los primeros días
 * después del seguimiento. Medido el 8/10/2026: hay chats con meses de charla
 * posterior al último toque (Ricardo, 50 mensajes), y leer todo eso
 * encontraba un "ya compré" de hace semanas en alguien que hoy pide precios.
 */
export const VENTANA_RESPUESTA_DIAS = 7;

/** Filtra los entrantes que responden al toque de `lastFollowUpAt`. */
export function respuestasAlToque<T extends { createdAt: Date }>(mensajes: T[], lastFollowUpAt: Date): T[] {
    const desde = lastFollowUpAt.getTime();
    const hasta = desde + VENTANA_RESPUESTA_DIAS * 24 * 3_600_000;
    return mensajes.filter(m => m.createdAt.getTime() > desde && m.createdAt.getTime() <= hasta);
}
