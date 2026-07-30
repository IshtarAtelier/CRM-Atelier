/**
 * Mensajes de seguimiento de las Oportunidades de Cierre.
 *
 * Por qué existe este archivo (y por qué tiene varias redacciones de lo mismo):
 * los mensajes salen por `whatsapp-web.js`, es decir una cuenta real manejada
 * desde WhatsApp Web. Mandar el MISMO texto palabra por palabra a decenas de
 * números es el patrón que WhatsApp marca como spam y termina en baneo. Por eso
 * cada seguimiento tiene varias redacciones equivalentes y se elige una según el
 * cliente, para que dos personas distintas nunca reciban el texto idéntico.
 *
 * La elección es determinística (hash del id, no random): si abrís el mismo
 * contacto dos veces te ofrece el mismo texto, y no cambia solo entre clicks.
 *
 * Los datos duros (dirección, horarios, Instagram, maps) NO se escriben a mano
 * acá: salen de BUSINESS_INFO. Ya pasó que un horario copiado quedara viejo y se
 * mandaran horarios inventados.
 *
 * OJO: variar el texto ayuda, pero no es lo que más pesa. Lo que más cuida la
 * cuenta es el volumen (no disparar decenas seguidas), escribirle solo a gente
 * que ya nos contactó, y que nadie te marque como spam. Por eso varias de las
 * redacciones van sin link: mensajes con URL a un número que no te tiene
 * agendado son los que más se denuncian.
 */

import { BUSINESS_INFO } from './business-info';

export type FollowUpType = 'STALLED_FAVORITE' | 'PENDING_QUOTE' | 'ABANDONED_CART';

/** Cuál de los 3 seguimientos corresponde. */
export type FollowUpTouch = 1 | 2 | 3;

const STORE_WEB = 'atelieroptica.com.ar';

/**
 * Hash estable de un string. Sirve para elegir siempre la misma redacción para
 * el mismo cliente sin guardar nada en la base.
 */
function hashSeed(seed: string): number {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
        h = (h * 31 + seed.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}

/** Saludo según la hora, para no mandar "buen día" a las 7 de la tarde. */
function greetingFor(now: Date): string {
    const hour = now.getHours();
    if (hour < 13) return 'buen día';
    if (hour < 20) return 'buenas tardes';
    return 'buenas noches';
}

/**
 * Primer seguimiento. Es el único que cambia según el tipo de oportunidad,
 * porque referencia qué pasó antes (un presupuesto, una charla, un carrito).
 */
const TOUCH_1: Record<FollowUpType, ((name: string, greeting: string) => string)[]> = {
    PENDING_QUOTE: [
        (n, g) =>
            `Hola ${n}, ${g}! ¿Cómo estás? Contame, ¿pudiste ver el presupuesto que te pasamos? ¿Qué te pareció, está dentro de lo que estabas buscando? Si querés te mando fotitos de los modelos que tenemos disponibles.`,
        (n, g) =>
            `¡Hola ${n}, ${g}! ¿Cómo va? Te escribo para saber si llegaste a mirar el presupuesto. ¿Te cerró más o menos con lo que tenías en mente? Cualquier cosa te paso fotos de algunos modelos. También podés ir chusmeando en ${STORE_WEB}, igual en el local tenemos muchos más.`,
        (n, g) =>
            `Hola ${n}, ${g}! ¿Todo bien? Quería consultarte por el presupuesto que te enviamos, ¿alcanzaste a verlo? Si te sirve te mando fotitos de los modelos que hay ahora.`,
        (n, g) =>
            `¡Hola ${n}! ${g.charAt(0).toUpperCase() + g.slice(1)}. Te escribo por el presupuesto que te habíamos armado, ¿pudiste verlo? Contame qué te pareció y si andabas buscando algo distinto. En ${STORE_WEB} podés ver parte de la colección, aunque en el local hay bastante más variedad.`,
    ],
    STALLED_FAVORITE: [
        (n, g) =>
            `Hola ${n}, ${g}! ¿Cómo estás? Te escribo por los lentes que estuvimos viendo, ¿seguís con la idea? Si querés te mando fotitos de los modelos que tenemos ahora.`,
        (n, g) =>
            `¡Hola ${n}, ${g}! ¿Cómo va todo? Me quedó pendiente lo tuyo y no quería dejarlo pasar. ¿Necesitabas ver algo más para decidirte? Cualquier cosa te paso fotos de lo que hay disponible.`,
        (n, g) =>
            `Hola ${n}, ${g}! ¿Todo bien? Quería saber si te quedó alguna duda de lo que habíamos charlado. Si te sirve te muestro los modelos que entraron. También está ${STORE_WEB} para ir mirando.`,
        (n, g) =>
            `¡Hola ${n}! ${g.charAt(0).toUpperCase() + g.slice(1)}. Te escribo para retomar lo de tus lentes, ¿seguís buscando? Contame qué estabas necesitando y te armo un par de opciones.`,
    ],
    ABANDONED_CART: [
        (n, g) =>
            `Hola ${n}, ${g}! ¿Cómo estás? Vi que te quedaron unos productos en el carrito de la tienda, ¿te surgió alguna duda? Si querés te doy una mano para terminarlo.`,
        (n, g) =>
            `¡Hola ${n}, ${g}! ¿Cómo va? Me aparece una compra tuya sin finalizar en ${STORE_WEB}. ¿Te trabó algo o quedaste dudando con el modelo? Cualquier cosa te paso fotos reales antes de que decidas.`,
        (n, g) =>
            `Hola ${n}, ${g}! ¿Todo bien? Quedó una compra a medio hacer en la tienda y quería ver si necesitabas algo. Si preferís lo cerramos por acá, sin vueltas.`,
        (n, g) =>
            `¡Hola ${n}! ${g.charAt(0).toUpperCase() + g.slice(1)}. Te escribo porque quedaron unos artículos tuyos en el carrito. ¿Querés que te ayude a completarlo o preferís verlos en el local antes?`,
    ],
};

/**
 * Segundo seguimiento: invitar al local. Ya no depende del tipo — a esta altura
 * lo que mueve la aguja es que la persona venga a probarse los armazones.
 */
const TOUCH_2: ((name: string, greeting: string) => string)[] = [
    (n, g) =>
        `Hola ${n}, ${g}! ¿Cómo estás? Contame, ¿te gustó alguna de las opciones que te mandé? Si querés pasá por el local y las ves en persona, estamos en ${BUSINESS_INFO.address}. ${BUSINESS_INFO.hours}. ¿Qué día te queda más cómodo?`,
    (n, g) =>
        `¡Hola ${n}, ${g}! ¿Cómo va? ¿Pudiste definir algo de lo que charlamos? Te tiro una idea: date una vuelta por el local y te las probás con calma. Estamos en ${BUSINESS_INFO.address}. ${BUSINESS_INFO.hours}. ¿Te viene bien alguna tarde?`,
    (n, g) =>
        `Hola ${n}, ${g}! ¿Todo bien? Quería saber si alguna opción te convenció. Igual lo mejor es verlas puestas — acá te dejo cómo llegar: ${BUSINESS_INFO.mapsUrl}. ${BUSINESS_INFO.hours}. ¿Cuándo te queda cómodo?`,
    (n, g) =>
        `¡Hola ${n}! ${g.charAt(0).toUpperCase() + g.slice(1)}. ¿Llegaste a mirar lo que te pasé? Si querés te espero en el local así elegís con calma, estamos en ${BUSINESS_INFO.address}. ${BUSINESS_INFO.hours}. Decime qué momento te sirve y te reservo el turno.`,
];

/**
 * Tercer y último seguimiento. Acá recién aparece el descuento: es el empujón
 * final, no algo que convenga ofrecer en el primer mensaje.
 */
const TOUCH_3: ((name: string, greeting: string) => string)[] = [
    (n, g) =>
        `Hola ${n}, ${g}! ¿Cómo estás? Te quería invitar a seguirnos en Instagram, ahí subimos los modelos que van entrando: ${BUSINESS_INFO.instagramUrl}. Y contame, ¿al final resolviste lo de tus anteojitos? Si todavía no, tengo un descuento especial para hacerte.`,
    (n, g) =>
        `¡Hola ${n}, ${g}! ¿Cómo va? Contame una cosa, ¿ya conseguiste tus anteojos? Si no llegaste a comprarlos, me guardé una promo especial para vos. Y si querés ir viendo novedades, seguinos en ${BUSINESS_INFO.instagramUrl}.`,
    (n, g) =>
        `Hola ${n}, ${g}! ¿Todo bien? Última que te molesto: ¿llegaste a comprar tus lentes? Si seguís dando vueltas, puedo hacerte un precio especial para que te decidas. Cualquier cosa acá estoy.`,
    (n, g) =>
        `¡Hola ${n}! ${g.charAt(0).toUpperCase() + g.slice(1)}. ¿Cómo terminó lo de tus anteojitos, los compraste? Si todavía no, tengo un descuento reservado para vos. También te dejo el Instagram por si querés ver lo nuevo: ${BUSINESS_INFO.instagramUrl}.`,
];

/**
 * Qué seguimiento corresponde según hace cuánto está fría la oportunidad.
 * Sin registro de envíos previos, los días son la mejor aproximación.
 */
export function touchForDays(daysElapsed: number): FollowUpTouch {
    if (daysElapsed <= 7) return 1;
    if (daysElapsed <= 15) return 2;
    return 3;
}

/**
 * Arma el mensaje de seguimiento listo para mandar.
 *
 * @param seed  Id del cliente u oportunidad — fija qué redacción le toca.
 */
export function buildFollowUpMessage({
    clientName,
    type,
    daysElapsed,
    seed,
    now = new Date(),
}: {
    clientName: string;
    type: FollowUpType;
    daysElapsed: number;
    seed: string;
    now?: Date;
}): { message: string; touch: FollowUpTouch } {
    const firstName = clientName.trim().split(/\s+/)[0] || 'Hola';
    const greeting = greetingFor(now);
    const touch = touchForDays(daysElapsed);

    const variants = touch === 1 ? TOUCH_1[type] : touch === 2 ? TOUCH_2 : TOUCH_3;
    const index = hashSeed(`${seed}:${touch}`) % variants.length;

    return { message: variants[index](firstName, greeting), touch };
}
