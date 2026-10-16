// ────────────────────────────────────────────────────────────────────────────
// ¿El cliente dejó su reseña en Google? Lo pregunta el cierre de una tarea
// "Solicitar comentario" (Ishtar, 16/10/2026): la tarea no se da por hecha
// porque el vendedor mandó el pedido, sino cuando la reseña FIGURA.
//
// LÍMITE CONOCIDO: la API de Places devuelve como mucho 5 reseñas por pedido.
// Se piden las 5 más NUEVAS (legacy, reviews_sort=newest) y las 5 más
// relevantes (New): alcanza para lo que entró en los últimos días, no para
// una reseña de hace meses. Por eso el "no figura" nunca bloquea: pregunta.
// ────────────────────────────────────────────────────────────────────────────

const TIMEOUT_MS = 5000;

const tokens = (t: string) =>
    (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3);

/** Mismo nombre si comparten al menos dos palabras (nombre + apellido, en cualquier orden). */
export function mismoNombre(cliente: string, autorGoogle: string): boolean {
    const a = new Set(tokens(cliente));
    return tokens(autorGoogle).filter(w => a.has(w)).length >= 2;
}

async function autoresRecientes(): Promise<string[]> {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    const placeId = process.env.GOOGLE_PLACE_ID || 'ChIJjZd3QbC6l00RxWWzy_uJz80';
    if (!apiKey) throw new Error('Falta GOOGLE_PLACES_API_KEY');

    const [nuevas, relevantes] = await Promise.allSettled([
        fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews&reviews_sort=newest&language=es&key=${apiKey}`,
            { cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) })
            .then(r => r.json())
            .then(d => (d.result?.reviews || []).map((r: any) => String(r.author_name || ''))),
        fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=es`, {
            cache: 'no-store',
            signal: AbortSignal.timeout(TIMEOUT_MS),
            headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'reviews' },
        })
            .then(r => r.json())
            .then(d => (d.reviews || []).map((r: any) => String(r.authorAttribution?.displayName || ''))),
    ]);
    const autores = [nuevas, relevantes].flatMap(r => (r.status === 'fulfilled' ? r.value : []));
    if (nuevas.status === 'rejected' && relevantes.status === 'rejected') throw new Error('Google no respondió');
    return autores;
}

export type VerificacionResena = { figura: true; autor: string } | { figura: false; error?: string };

export const GoogleReviewsCheckService = {
    async verificar(nombreCliente: string): Promise<VerificacionResena> {
        try {
            const autor = (await autoresRecientes()).find(a => mismoNombre(nombreCliente, a));
            return autor ? { figura: true, autor } : { figura: false };
        } catch (e: any) {
            return { figura: false, error: e?.message || 'No se pudo consultar Google' };
        }
    },
};
