/**
 * Vocabulario ÚNICO de canales de origen (Client.contactSource).
 *
 * POR QUÉ existe este archivo: el vocabulario del desplegable "Origen / Canal"
 * vivía copiado en 5 lugares (ContactForm, cotizador, panel de WhatsApp,
 * extract-client y contact.service) y cada copia divergió a su manera:
 * mayúsculas distintas, "Tienda Online" vs "Tienda nube", y —lo más caro—
 * cualquier mención de Google/Maps terminaba contada como "Google Ads",
 * inflando el retorno aparente de la pauta. Toda pantalla, ruta o service que
 * necesite la lista o normalizar un valor importa de acá; agregar un canal
 * nuevo es tocar SOLO este archivo.
 *
 * Reglas de atribución de Google (la grieta que motivó la separación):
 * - "Google Ads"      → SOLO señal determinística de pauta (el template del
 *                       anuncio, o mención explícita de un anuncio en Google).
 * - "Google Maps"     → el cliente los encontró por Maps. NO es pauta.
 * - "Google orgánico" → búsqueda genérica en Google sin mención de anuncio.
 *                       Tampoco es pauta.
 */

/** Valor de presentación cuando la ficha no tiene canal cargado. NO se guarda en la base (ahí va null). */
export const SIN_ORIGEN = 'Sin origen';

/**
 * Valores canónicos del desplegable Origen / Canal.
 * Los strings son EXACTOS: así se guardan en Client.contactSource y así los
 * agrupan los reportes. No editar un valor sin plan de migración de los datos.
 */
export const CONTACT_SOURCES = [
    'Google Ads',
    'Google Maps',
    'Google orgánico',
    'Meta',
    'Calle',
    'Jemima',
    'Ya es Cliente',
    'Tienda nube',
    'Referido',
    'Wave',
    'Salida',
    'Otros',
] as const;

export type ContactSource = (typeof CONTACT_SOURCES)[number];

/** trim + colapso de espacios internos ("visita  showroom " → "visita showroom"). */
function limpiar(raw: string): string {
    return raw.trim().replace(/\s+/g, ' ');
}

/** Canónicos indexados por su versión en minúsculas, para match case-insensitive. */
const CANONICO_POR_LOWER: Record<string, ContactSource> = Object.fromEntries(
    CONTACT_SOURCES.map(s => [s.toLowerCase(), s])
) as Record<string, ContactSource>;

/**
 * Variantes históricas → canónico. Match EXACTO sobre el valor completo
 * (lowercase, espacios colapsados). A propósito NO hay matching por substring:
 * los `includes('google')` / `includes('meta')` de las copias viejas eran la
 * fuente de falsos positivos (p. ej. "maps" contado como Google Ads).
 */
const VARIANTES: Record<string, ContactSource> = {
    // Pauta de Google: solo alias inequívocos de la pauta.
    'gads': 'Google Ads',
    'adwords': 'Google Ads',
    'google adwords': 'Google Ads',
    // Maps NO es pauta.
    'maps': 'Google Maps',
    // Búsqueda genérica NO es pauta.
    'google': 'Google orgánico',
    'google organico': 'Google orgánico',
    'busqueda': 'Google orgánico',
    'búsqueda': 'Google orgánico',
    'busqueda de google': 'Google orgánico',
    // Meta y sus redes. 'face' solo como valor completo (como substring daba falsos positivos).
    'instagram': 'Meta',
    'facebook': 'Meta',
    'ig': 'Meta',
    'fb': 'Meta',
    'face': 'Meta',
    'meta ads': 'Meta',
    // Clientes preexistentes. "Importado" = migración del sistema anterior: ya eran clientes.
    'cliente': 'Ya es Cliente',
    'antiguo': 'Ya es Cliente',
    'importado': 'Ya es Cliente',
    'importados': 'Ya es Cliente',
    // La tienda web: el checkout escribió "Tienda Online" y algunas pantallas "WEB_STOREFRONT".
    'tienda online': 'Tienda nube',
    'tiendanube': 'Tienda nube',
    'web_storefront': 'Tienda nube',
    // Referidos.
    'recomendado': 'Referido',
    'recomendada': 'Referido',
};

/**
 * Intenta llevar un valor crudo a un canónico. Devuelve null si no lo reconoce
 * (o si viene vacío): útil donde "no sé" debe quedar sin cargar para que un
 * humano elija (p. ej. la extracción de cliente desde un chat de WhatsApp).
 */
export function matchContactSource(raw: string | null | undefined): ContactSource | null {
    if (!raw) return null;
    const clean = limpiar(raw);
    if (!clean) return null;
    const lower = clean.toLowerCase();
    return CANONICO_POR_LOWER[lower] ?? VARIANTES[lower] ?? null;
}

/**
 * Normaliza para agrupar/reportar: canónico si lo reconoce, SIN_ORIGEN si viene
 * vacío, y el valor crudo limpio si es un canal histórico desconocido (mejor
 * verlo en el reporte que fundirlo en silencio dentro de "Otros").
 */
export function normalizeContactSource(raw: string | null | undefined): string {
    if (!raw || !limpiar(raw)) return SIN_ORIGEN;
    return matchContactSource(raw) ?? limpiar(raw);
}

/** Texto para mostrar en pantalla. Hoy coincide con normalizar; las vistas usan este nombre. */
export function displayContactSource(raw: string | null | undefined): string {
    return normalizeContactSource(raw);
}
