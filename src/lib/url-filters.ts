'use client';

/**
 * Sincroniza filtros de una pantalla a la URL (querystring) sin recargar la
 * página ni disparar navegación de Next.js, para que cualquier combinación
 * de filtros sea un link compartible (ej. WhatsApp a un vendedor). Los
 * valores que coinciden con su default (vacío/false/undefined) se omiten
 * para no ensuciar la URL.
 */
export function syncUrlParams(pathname: string, params: Record<string, string | number | boolean | null | undefined>) {
    if (typeof window === 'undefined') return;
    const usp = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value === null || value === undefined || value === '' || value === false) continue;
        usp.set(key, String(value));
    }
    const qs = usp.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    if (`${window.location.pathname}${window.location.search}` !== url) {
        window.history.replaceState(null, '', url);
    }
}

/** Lee un string de searchParams con fallback. */
export function getUrlParam(searchParams: { get(key: string): string | null }, key: string, fallback: string): string {
    return searchParams.get(key) ?? fallback;
}

/** Lee un boolean de searchParams ('1' o 'true' = true). */
export function getUrlBoolParam(searchParams: { get(key: string): string | null }, key: string): boolean {
    const v = searchParams.get(key);
    return v === '1' || v === 'true';
}
