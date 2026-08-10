/**
 * Vocabulario ÚNICO de las etiquetas que el SISTEMA administra sobre un cliente:
 * la del canal de origen (`Client.contactSource`) y la del anuncio que lo trajo
 * (`Client.adTag`).
 *
 * POR QUÉ existe: el espejo canal→etiqueta cubría 3 de los 9 canales canónicos
 * (Google Ads, Meta y Ya es Cliente) y el apodo del anuncio no generaba ninguna
 * etiqueta: vivía solo como columna, invisible en el buscador de etiquetas y en
 * los filtros. Pedido textual de la dueña: "las etiquetas que solo detectás en
 * sistema que vinieron de meta ¿con una etiqueta visible? ¿así queda todo Meta
 * unificado? ¿lo mismo con Google?".
 *
 * Este archivo es SOLO vocabulario y colores (puro, sin base). Quién conecta y
 * desconecta es `syncContactTags()` en `src/services/contact.service.ts`.
 *
 * ── Cómo se distingue una etiqueta ADMINISTRADA de una de negocio ────────────
 * Es la pregunta clave: el sync desconecta etiquetas y jamás puede tocar las que
 * pone el staff o el bot ("Multifocal", "Bot Lead", "Sin Seguimiento", "Ocusis",
 * "VIP", …). La frontera es explícita y cerrada, y son solo dos reglas:
 *
 *   1) el nombre está en `NOMBRES_ADMINISTRADOS` (derivado de `TAG_POR_CANAL`), o
 *   2) el nombre empieza con uno de los `PREFIJOS_ANUNCIO` ("Meta · " / "Google · ").
 *
 * Los prefijos quedan RESERVADOS para el sistema: nadie debe crear a mano una
 * etiqueta que empiece así. El separador es el punto medio "·" (U+00B7), no un
 * guion, justamente para que no aparezca por accidente en una etiqueta escrita
 * a mano. Agregar un canal nuevo al vocabulario y olvidarse de acá es imposible:
 * `TAG_POR_CANAL` está tipado como `Record<ContactSource, ...>` y el compilador
 * exige la entrada.
 *
 * ── Colores ──────────────────────────────────────────────────────────────────
 * El color de una etiqueta se pinta como FONDO SÓLIDO con texto blanco encima
 * (`getLabelStyleInline` en el panel de WhatsApp y en `ChatLabelPicker`, y
 * `client-pdf-generator.ts`). O sea: el piso de 4,5:1 se mide blanco-sobre-color,
 * y por eso todos los valores de acá son tonos oscuros. Los tres colores
 * históricos NO llegaban (#1677ff 4,10:1 · #E91E63 4,35:1 · #4CAF50 2,78:1);
 * los de esta tabla van de 5,02:1 a 10,36:1.
 *
 * Familias, para que el ojo agrupe sin leer:
 *   - Google (pauta, orgánico y Maps) → azules diferenciados
 *   - Meta                            → magentas
 *   - presencial / boca a boca        → tierra
 *   - propios (tienda y base)         → verdes
 *   - el anuncio                      → la versión OSCURA del azul/magenta de su
 *     plataforma: se lee "misma familia, otra cosa" de un vistazo.
 */

import { CONTACT_SOURCES, type ContactSource } from '@/lib/contact-source';
import { platformFromStoredTag, parseAdTag, type AdPlatform } from '@/lib/ads/ad-tag';

export interface EtiquetaAdministrada {
    name: string;
    color: string;
}

/**
 * Canal canónico → etiqueta visible.
 *
 * Los nombres son los del canal TAL CUAL, con dos excepciones históricas que NO
 * se pueden renombrar porque ya hay clientes colgando de ellas en producción
 * (686 y 518 al 9/8/2026): 'Meta' escribe "Meta Ads" y 'Ya es Cliente' escribe
 * "Ya es cliente" (con c minúscula). Renombrarlas dejaría los clientes viejos
 * en una etiqueta huérfana y los nuevos en otra.
 */
export const TAG_POR_CANAL: Record<ContactSource, EtiquetaAdministrada> = {
    // Google: tres azules distinguibles entre sí.
    'Google Ads': { name: 'Google Ads', color: '#1D4ED8' },          // 6,70:1
    'Google orgánico': { name: 'Google orgánico', color: '#0369A1' },// 5,93:1
    'Google Maps': { name: 'Google Maps', color: '#0E7490' },        // 5,36:1
    // Meta: magenta.
    'Meta': { name: 'Meta Ads', color: '#C2185B' },                  // 5,87:1  ← nombre histórico
    // Presencial y boca a boca: tierra.
    'Calle': { name: 'Calle', color: '#92400E' },                    // 7,09:1
    'Referido': { name: 'Referido', color: '#B45309' },              // 5,02:1
    // Propios: la base y la tienda.
    'Ya es Cliente': { name: 'Ya es cliente', color: '#15803D' },    // 5,02:1  ← nombre histórico
    'Tienda online': { name: 'Tienda online', color: '#6D28D9' },    // 7,10:1
    // Cajón de sastre.
    'Otros': { name: 'Otros', color: '#57534E' },                    // 7,63:1
};

/** Prefijo de la etiqueta del anuncio, por plataforma. El "·" es U+00B7. */
export const PREFIJO_ANUNCIO: Record<AdPlatform, string> = {
    META: 'Meta · ',
    GOOGLE: 'Google · ',
};

/**
 * Color de la etiqueta del anuncio: el tono oscuro de la familia de su
 * plataforma. Deliberadamente distinto del color del canal (Meta Ads #C2185B /
 * Google Ads #1D4ED8) para que canal y anuncio no se confundan de un vistazo.
 */
export const COLOR_ANUNCIO: Record<AdPlatform, string> = {
    META: '#831843',   // 9,65:1  — magenta vino
    GOOGLE: '#1E3A8A', // 10,36:1 — azul marino
};

const PREFIJOS_ANUNCIO = Object.values(PREFIJO_ANUNCIO);

/** Nombres de las etiquetas de canal. Cerrado: sale de `TAG_POR_CANAL`. */
export const NOMBRES_ADMINISTRADOS: ReadonlySet<string> = new Set(
    CONTACT_SOURCES.map(s => TAG_POR_CANAL[s].name)
);

/**
 * ¿Esta etiqueta la ESCRIBE el sistema (canal o anuncio)?
 *
 * Responde "¿puedo crearla y conectarla yo?". NO alcanza para borrar: para eso
 * está `esEtiquetaDesconectable()`, que es más estrecha a propósito.
 */
export function esEtiquetaAdministrada(name: string | null | undefined): boolean {
    if (!name) return false;
    return NOMBRES_ADMINISTRADOS.has(name) || PREFIJOS_ANUNCIO.some(p => name.startsWith(p));
}

/**
 * Nombres administrados que el sistema NO se anima a desconectar, porque son
 * palabras corrientes que alguien más pudo haber usado con otro significado.
 *
 * POR QUÉ existe: `Tag` es una fila ÚNICA por nombre y la relación con el
 * cliente no guarda quién la puso. O sea: no hay forma de distinguir un
 * "Referido" que escribió este sync de un "Referido" que puso el staff o el bot
 * queriendo decir "vino recomendado". Y el bot los escribe con nombre LIBRE: la
 * tool `add_tags` (wa-service/agent-tools.js) recibe `tagName: z.string()`
 * inventado por el LLM, y `passive-extractor.js` manda `parsed.interestTag`, que
 * es texto libre del modelo. Encima `graph.js` le mete al prompt los nombres de
 * las etiquetas que tengan `autoAssignCondition`: en cuanto estas etiquetas
 * existan como fila, la dueña puede ponerles una condición desde el gestor y el
 * bot va a empezar a aplicarlas.
 *
 * Verificado el 9/8/2026 contra la base local: con "Referido" en la ficha de un
 * cliente de canal 'Meta', el sync la desconectaba en silencio.
 *
 * La decisión es asimétrica a propósito: una etiqueta de más es ruido visual,
 * una etiqueta de menos es información perdida sin dejar rastro en la ficha.
 * Estas tres se siguen CONECTANDO (la dueña las quería visibles); lo único que
 * no se hace es sacárselas a nadie.
 *
 * Las que sí se desconectan son las que nadie escribiría a mano con otro
 * sentido: "Meta Ads", "Google Ads", "Google Maps", "Google orgánico",
 * "Tienda online", "Ya es cliente" y todo lo que empieza con "Meta · " /
 * "Google · ". Con eso alcanza para el caso que motivó todo esto: el cliente que
 * pasa de Meta a Google Ads y quedaba con las dos pegadas.
 */
const NO_DESCONECTABLES: ReadonlySet<string> = new Set(['Calle', 'Referido', 'Otros']);

/**
 * ¿Esta etiqueta se le puede SACAR a un cliente?
 *
 * Es el único portero del borrado: `syncContactTags()` y el backfill solo
 * desconectan etiquetas para las que esto devuelve true. Todo lo demás —lo que
 * pone el staff a mano, lo que pone el bot, y las tres ambiguas de arriba— es
 * intocable.
 */
export function esEtiquetaDesconectable(name: string | null | undefined): boolean {
    if (!name) return false;
    if (NO_DESCONECTABLES.has(name)) return false;
    return esEtiquetaAdministrada(name);
}

/**
 * Etiqueta del anuncio a partir del valor guardado en `Client.adTag`.
 *
 * El parseo NO se reinventa acá: la plataforma sale de `platformFromStoredTag()`
 * (Meta va sin prefijo y Google con "google:" adelante, por historial) y el
 * apodo de `parseAdTag()` sobre la forma con corchetes, que es la que ese parser
 * entiende. "ishvarilux" → "Meta · ishvarilux"; "google:verano" → "Google · verano".
 */
export function tagDeAnuncio(adTag: string | null | undefined): EtiquetaAdministrada | null {
    const limpio = adTag?.trim();
    if (!limpio) return null;
    const platform = platformFromStoredTag(limpio);
    if (!platform) return null;
    // `parseAdTag` lee la forma con corchetes del prefill; el valor guardado ya
    // viene sin ellos, así que se la reconstruimos y él hace la normalización
    // real (minúsculas, sin espacios). Google guarda "google:verano" → hay que
    // pasarle "[googleverano]"; Meta guarda pelado → "[metaishvarilux]".
    const bracket = platform === 'GOOGLE'
        ? `[${limpio.replace(/^google:/i, 'google')}]`
        : `[meta${limpio}]`;
    const campaign = parseAdTag(bracket)?.campaign;
    if (!campaign) return null;
    return { name: `${PREFIJO_ANUNCIO[platform]}${campaign}`, color: COLOR_ANUNCIO[platform] };
}

/**
 * El canal que le corresponde a la etiqueta cuando el anuncio es la única
 * señal: un `adTag` ES prueba determinística de que el clic vino pago.
 */
const CANAL_POR_PLATAFORMA: Record<AdPlatform, ContactSource> = {
    META: 'Meta',
    GOOGLE: 'Google Ads',
};

/**
 * Estado EXACTO de etiquetas administradas que le corresponde a un cliente.
 * Puro: no toca la base. Lo consumen el sync del service y el backfill, así los
 * dos calculan lo mismo.
 *
 * Reglas:
 *  - manda `contactSource` (es el juicio de la persona que atendió);
 *  - si no hay canal cargado pero sí anuncio, el canal se deduce de la
 *    plataforma del anuncio en vez de quedar en blanco;
 *  - un canal histórico que ya no está en el vocabulario no genera etiqueta
 *    (mejor sin etiqueta que con una inventada).
 */
export function etiquetasQueLeCorresponden(
    contactSource: string | null | undefined,
    adTag: string | null | undefined
): EtiquetaAdministrada[] {
    const anuncio = tagDeAnuncio(adTag);

    let canal: EtiquetaAdministrada | null =
        contactSource && contactSource in TAG_POR_CANAL
            ? TAG_POR_CANAL[contactSource as ContactSource]
            : null;

    if (!canal && !contactSource && anuncio) {
        const platform = platformFromStoredTag(adTag);
        if (platform) canal = TAG_POR_CANAL[CANAL_POR_PLATAFORMA[platform]];
    }

    return [canal, anuncio].filter((t): t is EtiquetaAdministrada => t !== null);
}
