/**
 * ¿Dos nombres de ficha son la misma persona?
 *
 * Nace de una auditoría de producción (29/7/2026): sobre 1.605 fichas había
 * duplicados que la comparación anterior —igualdad exacta o "uno contiene al
 * otro" sobre el texto pegado— no podía ver:
 *
 *   "Veronica Ontivero"  vs  "Onvitero Veronica"   (orden invertido + typo)
 *   "Katherina Wesphe"   vs  "Katherine Wesphe"    (una letra)
 *   "casatellano silvia" vs  "Castellano Silvia"   (typo + orden)
 *
 * Al mismo tiempo NO puede fusionar familias que comparten teléfono, que es el
 * caso legítimo y frecuente (4 fichas Paz Milet en un mismo número):
 *
 *   "Lorena Milet Paz"  vs  "Faustino Paz Milet"   → personas distintas
 *
 * La diferencia entre ambos grupos es el nombre de pila: los duplicados reales
 * comparten TODAS las palabras salvo typos; las familias comparten el apellido
 * pero tienen nombres de pila distintos.
 */

/** Sin acentos, sin puntuación, en minúscula. */
function normalizar(texto: string): string {
    return String(texto || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Palabras significativas del nombre (descarta conectores y partículas). */
function palabras(nombre: string): string[] {
    const IGNORAR = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'da', 'do', 'san', 'sta']);
    return normalizar(nombre)
        .split(' ')
        .filter(p => p.length >= 2 && !IGNORAR.has(p));
}

/** Distancia de edición (Levenshtein). Cuántas letras hay que cambiar. */
function distancia(a: string, b: string): number {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (m === 0 || n === 0) return Math.max(m, n);

    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
        const cur = [i];
        for (let j = 1; j <= n; j++) {
            cur[j] = Math.min(
                prev[j] + 1,
                cur[j - 1] + 1,
                prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
            );
        }
        prev = cur;
    }
    return prev[n];
}

/**
 * ¿Dos palabras son la misma con un typo? Tolerancia proporcional al largo:
 * palabras cortas exigen coincidencia exacta (para no confundir "Ana" con "Ema").
 */
function mismaPalabra(a: string, b: string): boolean {
    if (a === b) return true;
    const corta = Math.min(a.length, b.length);
    if (corta <= 3) return false;
    const tolerancia = corta <= 6 ? 1 : 2;
    return distancia(a, b) <= tolerancia;
}

/**
 * ¿Son la misma persona? true = duplicado (no crear ficha nueva).
 *
 * Criterio: el nombre más corto tiene que estar ENTERO dentro del más largo,
 * en cualquier orden y tolerando typos. Así "Onvitero Veronica" entra en
 * "Veronica Ontivero", pero "Faustino Paz Milet" no entra en "Lorena Milet Paz"
 * (le falta "lorena", y a la inversa le falta "faustino").
 */
export function esMismaPersona(nombreA: string, nombreB: string): boolean {
    const a = palabras(nombreA);
    const b = palabras(nombreB);
    if (a.length === 0 || b.length === 0) return false;

    const [corto, largo] = a.length <= b.length ? [a, b] : [b, a];

    // Una sola palabra ("Silvia") es demasiado poco para afirmar que es la misma
    // persona salvo que el otro nombre también sea una sola palabra.
    if (corto.length === 1 && largo.length > 1) return false;

    const disponibles = [...largo];
    for (const palabra of corto) {
        const i = disponibles.findIndex(otra => mismaPalabra(palabra, otra));
        if (i === -1) return false;
        disponibles.splice(i, 1); // cada palabra se consume una sola vez
    }
    return true;
}
