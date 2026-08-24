/**
 * El COLOR de la lente, derivado del nombre del cristal.
 *
 * Un cristal blanco puede tener filtro azul y antirreflejo y sigue siendo
 * blanco: no es de sol. Los de sol son los fotocromáticos (Transitions,
 * Acclimates, Xtractive, fotosensibles), los polarizados (Xperio) y los
 * espejados. El nombre del laboratorio no siempre lo aclara, así que el
 * vendedor tenía que deducirlo del material — y el cliente no tenía cómo.
 *
 * Se deriva del nombre en vez de guardarse en un campo: el catálogo se carga
 * desde las listas del lab y un campo nuevo quedaría vacío en cada producto
 * que entre. Acá, en cambio, un cristal nuevo se clasifica solo.
 *
 * OJO: es distinto de `crystalColor` del OrderItem, que es el color que ELIGE
 * el cliente cuando manda a teñir (ver crystal-color.ts). Esto es lo que el
 * cristal ES de fábrica.
 */

const normalizar = (t: string): string =>
    (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Etiqueta corta para mostrar al lado del índice. `null` si no es un cristal. */
export function colorDeLente(product: { name?: string | null; category?: string | null; type?: string | null } | null | undefined): string | null {
    if (!product) return null;
    const esCristal = product.category === 'Cristal' || normalizar(product.type || '').includes('cristal');
    if (!esCristal) return null;

    const n = normalizar(product.name || '');
    if (!n) return null;

    // Polarizado y espejado se dicen tal cual: son los más distintos a la vista.
    if (n.includes('espejad')) return 'Espejado';
    if (n.includes('xperio') || n.includes('polariz')) return 'Polarizado';

    // Fotocromáticos: la marca (Transitions, Acclimates, Xtractive) importa
    // menos que el color en el que oscurece, que es lo que pregunta el cliente.
    const esFotocromatico = /transitions|acclimat|xtractive|fotocrom|otocrom|fotosensible/.test(n);
    if (esFotocromatico) {
        if (n.includes('gris')) return 'Fotocromático gris';
        if (n.includes('marron') || n.includes('cafe') || n.includes('brown')) return 'Fotocromático marrón';
        if (n.includes('verde')) return 'Fotocromático verde';
        if (n.includes('color')) return 'Fotocromático de color';
        return 'Fotocromático';
    }

    // Todo lo demás es blanco: el filtro azul y el antirreflejo no lo tiñen.
    return 'Blanco';
}
