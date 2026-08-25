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
 * Desde el 25/8 la relación formal SÍ existe: el ítem de armazón lleva
 * `framePosition` (el chip "¿de cuál par?" del cotizador) y eso manda. El
 * emparejado por NOMBRE contra el detalle del laboratorio ("Vulk" ↔ "Vulk
 * Anteojo de sol", "clipo on metal" ↔ "Clip-on Classic") queda como red para
 * los pedidos viejos cargados antes del chip. Si un ítem no matchea con
 * ningún par, queda sin asignar — mejor una bolsa honesta ("También llevás")
 * que una asignación inventada.
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

/**
 * ¿Este ítem del pedido es un armazón? `includes` y no igualdad: las categorías
 * reales del catálogo son "Armazón de Receta" y "Lentes de Sol" — un filtro
 * exacto `=== 'Armazón'` no matcheaba ningún producto (pasó en la confirmación).
 * Y "Sol" cuenta: un anteojo de sol puede ser el armazón de un par graduado.
 */
export const esArmazonItem = (it: any): boolean =>
    /Armazón|Sol/i.test(`${it.product?.category || it.productCategorySnapshot || ''}`);

/** "Vulk Anteojo de sol", con la marca adelante si la hay. */
export const nombreDeArmazon = (it: any): string =>
    [it.product?.brand || it.productBrandSnapshot, it.product?.name || it.productNameSnapshot]
        .filter(Boolean).join(' ').trim();

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

    // LA ASOCIACIÓN EXPLÍCITA MANDA. Desde el 25/8 el ítem de armazón lleva su
    // chip "¿de cuál par?" (item.framePosition): si el vendedor lo eligió, no
    // hay nada que adivinar — el emparejado por nombre queda solo para los
    // pedidos viejos sin el dato. Regla del negocio: el par que quede sin
    // armazón de la óptica va en el armazón DEL CLIENTE (frameSource), y si
    // tampoco lo hay, ese par no debería existir.
    for (const it of armazonesItems) {
        if (it.framePosition && pares.some(p => p.pair === it.framePosition) && !resultado.has(it.framePosition)) {
            resultado.set(it.framePosition, it);
            usados.add(it);
        }
    }

    // Los pares CON detalle eligen primero, por mejor puntaje.
    const candidatos = pares
        .filter(par => !resultado.has(par.pair))
        .flatMap(par => armazonesItems.filter(it => !usados.has(it)).map(it => ({ par, it, p: puntaje(it, par) })))
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

/**
 * Qué armazones vendidos faltan asociar a su par ANTES de enviar a fábrica.
 *
 * Regla de Ishtar (25/8): «se agrega el teñido pero antes de enviar a fábrica
 * sí o sí hay que asociarlo al armazón 1 o 2» — y lo mismo el armazón. El
 * teñido ya tiene su traba (`faltantesDeColor`, code ARMAZON_TENIDO); esta es
 * la gemela para los ítems de armazón.
 *
 * NO exige asociar TODOS los ítems de armazón: un anteojo de sol suelto
 * (Carolina Emanuel) se vende aparte y no corresponde a ningún par. Lo que no
 * puede pasar es que quede un PAR sin armazón elegido mientras hay armazones
 * sueltos sin asociar — ahí la fábrica adivinaría. El par que legítimamente no
 * lleva armazón de la óptica va en el del cliente (frameSource), y eso lo
 * validan las reglas de armazón del usuario, no esta.
 *
 * Una sola función para el checkout (lista lo que falta ANTES de intentar) y
 * el servidor (rechaza la conversión) — si divergen, la pantalla deja apretar
 * y el server rebota con un error que nadie anticipó.
 */
export function faltanAsociarArmazones(items: any[] | null | undefined, totalArmazones: number): string[] {
    if (totalArmazones <= 1) return [];
    const armazones = (items || []).filter(esArmazonItem);
    if (armazones.length === 0) return [];
    const asignados = new Set(armazones.map(it => it.framePosition).filter(Boolean));
    const sueltos = armazones.filter(it => !it.framePosition);
    const paresSinArmazon: number[] = [];
    for (let pos = 1; pos <= totalArmazones; pos++) if (!asignados.has(pos)) paresSinArmazon.push(pos);
    if (sueltos.length === 0 || paresSinArmazon.length === 0) return [];
    const nombres = sueltos.map(it => `«${nombreDeArmazon(it) || 'armazón sin nombre'}»`).join(', ');
    const pares = paresSinArmazon.map(par => `${par}º`).join(' y ');
    return [
        `El ${pares} par quedó sin armazón elegido y hay ${sueltos.length === 1 ? 'un armazón sin asociar' : 'armazones sin asociar'} (${nombres}). Marcá en esa línea si es el 1º o el 2º; el que va aparte se deja sin marcar, y el par sin armazón de la óptica va en el del cliente.`,
    ];
}

/** "1º par — Vulk" / "2º par — clipo on metal": el título que dice CUÁL es. */
export function tituloDePar(par: ParConDetalle, totalPares: number, indice: number): string {
    const base = totalPares > 1 ? `${indice + 1}º par` : 'Tu anteojo';
    const detalle = (par.details || '').trim() || (par.shape || '').trim();
    return detalle ? `${base} — ${detalle}` : base;
}
