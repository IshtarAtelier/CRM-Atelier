/**
 * Qué par de una promo de "dos pares" va CON CARGO y cuál SIN CARGO (o al
 * precio de promo), para cualquier laboratorio con carga asistida.
 *
 * Regla de Ishtar (8/10/2026): **el par de mayor valor es el primero (con
 * cargo) y el de menor valor es el sin cargo**. Si son el mismo cristal, el
 * orden no cambia: el par 1 de la venta va con cargo y el par 2 sin cargo.
 *
 * El valor de un par es la suma de sus cristales al PRECIO DE LISTA DEL
 * PRODUCTO (`product.price`), nunca al de la línea: en el 2x1 de Grupo Óptico
 * el CRM deja el 2º par en $0 al armar la venta (promo-utils.ts,
 * `recalculateCrystalPrices`, que empareja por orden y no por armazón), así
 * que la línea no dice cuánto vale el cristal sino a cuál le tocó el regalo
 * (auditoría 5, 8/10/2026). Y con el mismo producto en los dos pares el empate
 * se fuerza por nombre, sin mirar importes.
 *
 * La identidad del par en el CRM sigue siendo `framePosition` (par 1 / par 2):
 * esto solo decide el ROL de cada uno al cargarlo. Puro.
 */
export interface RolesDePares {
    /** El par que se carga primero y se cobra. */
    conCargo: number;
    /** El par que se carga con el nº del otro (sin cargo o al precio de promo). */
    sinCargo: number;
    /** true si lo decidió el valor (dos cristales distintos); false si quedó el orden de la venta. */
    porValor: boolean;
    valores: Record<number, number>;
}

export function rolesPorValor(valores: { pair: number; valor: number }[]): RolesDePares | null {
    const dos = [...valores].sort((x, y) => x.pair - y.pair).slice(0, 2);
    if (dos.length < 2) return null;
    const [a, b] = dos;
    const tabla = { [a.pair]: a.valor, [b.pair]: b.valor };
    if (b.valor > a.valor) return { conCargo: b.pair, sinCargo: a.pair, porValor: true, valores: tabla };
    return { conCargo: a.pair, sinCargo: b.pair, porValor: a.valor !== b.valor, valores: tabla };
}

/**
 * El valor de lista de los cristales de un par (precio × cantidad). Recibe los
 * ítems YA agrupados por par: quién agrupa es cada laboratorio (Grupo Óptico
 * con `cristalesPorArmazon`, que también resuelve los ítems sin armazón
 * asignado; Vitolen por `framePosition`). Puro.
 */
export function valorDeCristales(items: { price?: number | null; quantity?: number | null; product?: { price?: number | null } | null }[]): number {
    // Precio de lista del producto si está; si no, la línea (lo único que hay).
    const precio = (i: typeof items[number]) => { const lista = Number(i.product?.price); return Number.isFinite(lista) && lista > 0 ? lista : Number(i.price) || 0; };
    return items.reduce((s, i) => s + precio(i) * (Number(i.quantity) || 1), 0);
}

const nombreDe = (i: { productNameSnapshot?: string | null; product?: { name?: string | null } | null }) => String(i.product?.name ?? i.productNameSnapshot ?? '').trim().toLowerCase();

/**
 * Los roles de dos pares ya agrupados: mismo producto en los dos → empate
 * (orden de la venta); distintos → por valor de lista. Puro.
 */
export function rolesDeDosPares(pares: { pair: number; items: { price?: number | null; quantity?: number | null; product?: { price?: number | null; name?: string | null } | null; productNameSnapshot?: string | null }[] }[]): RolesDePares | null {
    const dos = [...pares].sort((a, b) => a.pair - b.pair).slice(0, 2);
    if (dos.length < 2) return null;
    const nombres = (p: typeof dos[number]) => [...new Set(p.items.map(nombreDe).filter(Boolean))].sort().join('|');
    const mismoProducto = nombres(dos[0]) !== '' && nombres(dos[0]) === nombres(dos[1]);
    if (mismoProducto) {
        const v = valorDeCristales(dos[0].items);
        return { conCargo: dos[0].pair, sinCargo: dos[1].pair, porValor: false, valores: { [dos[0].pair]: v, [dos[1].pair]: v } };
    }
    return rolesPorValor(dos.map(p => ({ pair: p.pair, valor: valorDeCristales(p.items) })));
}

/** Texto para la ficha cuando el valor dio vuelta el orden de la venta. */
export function avisoDeRoles(r: RolesDePares, formatear: (n: number) => string): string | null {
    if (!r.porValor || r.conCargo === 1) return null;
    return `promo de dos pares: el par ${r.conCargo} es el de mayor valor (${formatear(r.valores[r.conCargo])}) y va CON CARGO; el par ${r.sinCargo} (${formatear(r.valores[r.sinCargo])}) va sin cargo, con el nº del par ${r.conCargo}`;
}
