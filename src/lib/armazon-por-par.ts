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
    // LA CATEGORÍA NO EXCLUYE: un anteojo de sol puede ser el armazón de un
    // par graduado (la venta de Adriana llevaba los cristales del 1º par EN el
    // Vulk de sol — lo aclaró la dueña: «el Vulk y el clip-on eran el 1 y el 2;
    // el aparte era el Carolina Emanuel»). La única autoridad es el NOMBRE
    // contra el detalle que cargó el laboratorio; lo que no matchea queda
    // aparte, sin inventar: «si no lleva asociación, ok».
    const puntaje = (it: any, par: ParConDetalle): number => {
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
    if (resultado.size === 0 && armazonesItems.length === pares.length) {
        pares.forEach((p, i) => resultado.set(p.pair, armazonesItems[i]));
    }
    return resultado;
}

/**
 * Qué ES el producto, dicho en criollo: "Carolina Emanuel" a secas no le dice
 * nada al cliente — falta "Anteojo de sol" o "Armazón de receta" al lado.
 * Devuelve null cuando el nombre ya lo dice (no repetir "Anteojo de sol" bajo
 * "Anteojo de sol - Vulk").
 */
export function tipoDeItem(it: any): string | null {
    const cat = `${it.product?.category || it.productCategorySnapshot || ''}`.toLowerCase();
    const nombre = `${it.product?.name || it.productNameSnapshot || ''}`.toLowerCase();
    if (cat.includes('sol')) return nombre.includes('sol') ? null : 'Anteojo de sol';
    if (cat.includes('armazón') || cat.includes('armazon')) return nombre.includes('armaz') ? null : 'Armazón de receta';
    return null;
}

/** "1º par — Vulk" / "2º par — clipo on metal": el título que dice CUÁL es. */
export function tituloDePar(par: ParConDetalle, totalPares: number, indice: number): string {
    const base = totalPares > 1 ? `${indice + 1}º par` : 'Tu anteojo';
    const detalle = (par.details || '').trim() || (par.shape || '').trim();
    return detalle ? `${base} — ${detalle}` : base;
}
