/**
 * ¿QUÉ ARMAZÓN ES CADA PAR? — el emparejado entre los ítems de armazón que se
 * vendieron y los pares de cristales del pedido.
 *
 * El problema real (venta de Adriana, 25/8/26): el pedido tenía dos pares de
 * cristales y tres ítems de armazón ("Vulk Anteojo de sol", "Carolina Emanuel",
 * "Clip-on Classic"). La ficha del laboratorio sabía que el 1º par iba en el
 * Vulk y el 2º en el clip-on ("clipo on metal"), pero esa relación vivía solo
 * en el detalle de medidas: la confirmación mostraba "2º PAR" sin decir cuál
 * era, y el clip-on caía en "También llevás" como si fuera un accesorio suelto.
 * La dueña lo dijo tal cual: «habría que ver cómo hacer que quede claro cuál
 * es cuál».
 *
 * La relación formal no existe en el modelo (los ítems de armazón no llevan
 * `framePosition`), así que se empareja por NOMBRE contra el detalle del
 * armazón del laboratorio ("Vulk" ↔ "Vulk Anteojo de sol", "clipo on metal" ↔
 * "Clip-on Classic"), tolerando las erratas de carga. Si un ítem no matchea
 * con ningún par, queda sin asignar — mejor una bolsa honesta ("También
 * llevás") que una asignación inventada.
 *
 * Vive acá y no copiado en el mail y el PDF: regla de CLAUDE.md — un dato que
 * se muestra en más de un lugar se arma en UN helper.
 */

/** Minúsculas, sin acentos, solo letras y números. "Clip-on" → "clipon". */
const norm = (s: string): string =>
    (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

/** Tokens con sustancia del texto (3+ letras), normalizados. */
const tokens = (s: string): string[] =>
    (s || '').split(/[^a-zA-Z0-9]+/).map(norm).filter(t => t.length >= 3);

export interface ParConDetalle {
    pair: number;
    details: string | null;
    shape: string | null;
}

/**
 * Empareja ítems de armazón con su par por parecido de nombre.
 *
 * Devuelve un Map par→ítem. Cada ítem se asigna a UN solo par y cada par
 * recibe UN solo ítem (el de mejor puntaje); los que no matchean quedan fuera.
 */
export function armazonesPorPar(
    armazonesItems: any[],
    pares: ParConDetalle[],
): Map<number, any> {
    const nombreDe = (it: any) => norm(
        `${it.product?.brand || it.productBrandSnapshot || ''} ${it.product?.name || it.productNameSnapshot || ''}`,
    );

    // Puntaje = cuántos tokens del detalle del armazón aparecen dentro del
    // nombre del ítem (o al revés). "clipo on metal" → [clipo, metal];
    // "cliponclassic" contiene "clipo" → matchea aun con la errata.
    // Un ANTEOJO TERMINADO (de sol, con sus lentes puestos) nunca se asigna a
    // un par graduado por parecido de nombre. Caso real: la venta llevaba un
    // "Vulk Anteojo de sol" APARTE y el detalle del 1º par decía "Vulk" (el
    // armazón óptico de la misma marca) — el emparejador lo habría metido en el
    // par equivocado con total confianza. Aclarado por la dueña: «el que era
    // tercero y aparte es el de sol».
    const esTerminado = (it: any) => {
        const cat = `${it.product?.category || it.productCategorySnapshot || ''}`.toLowerCase();
        if (cat.includes('sol')) return true; // categoría "Lentes de Sol"
        return /anteojo\s+de\s+sol|de\s*sol\b/.test(
            `${it.product?.name || it.productNameSnapshot || ''}`.toLowerCase());
    };

    const puntaje = (it: any, par: ParConDetalle): number => {
        if (esTerminado(it)) return 0;
        const nombre = nombreDe(it);
        if (!nombre) return 0;
        const deta = tokens(`${par.details || ''} ${par.shape || ''}`);
        return deta.filter(t => nombre.includes(t) || (norm(t).length >= 4 && t.includes(nombre))).length;
    };

    const resultado = new Map<number, any>();
    const usados = new Set<any>();

    // Los pares CON detalle eligen primero, por mejor puntaje.
    const candidatos = pares
        .flatMap(par => armazonesItems.map(it => ({ par, it, p: puntaje(it, par) })))
        .filter(x => x.p > 0)
        .sort((a, b) => b.p - a.p);
    for (const { par, it } of candidatos) {
        if (resultado.has(par.pair) || usados.has(it)) continue;
        resultado.set(par.pair, it);
        usados.add(it);
    }

    // Sin detalles no hay para qué adivinar — salvo el caso trivial: tantos
    // armazones como pares, se asignan en orden (1º con 1º).
    const sinTerminados = armazonesItems.filter(it => !esTerminado(it));
    if (resultado.size === 0 && sinTerminados.length === pares.length) {
        pares.forEach((p, i) => resultado.set(p.pair, sinTerminados[i]));
    }
    return resultado;
}

/** "1º par — Vulk" / "2º par — clipo on metal": el título que dice CUÁL es. */
export function tituloDePar(par: ParConDetalle, totalPares: number, indice: number): string {
    const base = totalPares > 1 ? `${indice + 1}º par` : 'Tu anteojo';
    const detalle = (par.details || '').trim() || (par.shape || '').trim();
    return detalle ? `${base} — ${detalle}` : base;
}
