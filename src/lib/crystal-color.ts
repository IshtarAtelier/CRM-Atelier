// ────────────────────────────────────────────────────────────────────────────
// El color de un cristal: qué es, cómo se escribe y de qué color se pinta.
//
// Hay DOS cosas distintas que se guardan en el mismo campo (`crystalColor`) y
// que no significan lo mismo:
//
//   · TEÑIDO — un color que se le manda a hacer al cristal. Tiene tono, grado
//     (qué tan oscuro) y, cuando el pedido lleva más de un anteojo, a cuál va.
//   · FOTOCROMÁTICO — el cristal ya viene así de fábrica y se oscurece solo con
//     el sol. Solo se elige de qué color se pone. NO tiene grado.
//
// Por qué existe este módulo: cuando el fotocromático empezó a guardar su tono,
// todas las pantallas que decían "cualquier item con crystalColor es teñido"
// pasaron a mentir — y una de ellas es la que arma el pedido para SmartLab. Un
// Transitions Zafiro se habría mandado a fábrica como "teñido Zafiro". El
// laboratorio no tiene cómo saber que está mal.
//
// Módulo PURO (sin prisma): lo usan las pantallas, el PDF, el mensaje al
// cliente y el export al laboratorio, todos con el mismo criterio y la misma
// redacción.
// ────────────────────────────────────────────────────────────────────────────

import { isTeñidoAddon } from './promo-utils';
import { paletaDeFotocromatico, TONOS } from './constants/paletas-color';
import { TONOS_TENIDO } from './constants/tenido';

export interface ItemConColor {
    crystalColor?: string | null;
    crystalColorType?: string | null;
    crystalColorNote?: string | null;
    framePosition?: number | null;
    eye?: string | null;
    product?: { name?: string | null; category?: string | null; type?: string | null } | null;
    productNameSnapshot?: string | null;
    productCategorySnapshot?: string | null;
    productTypeSnapshot?: string | null;
}

/** El producto de la línea, mirando también los snapshots (pedidos viejos). */
export function productoDeItem(item: ItemConColor) {
    return item?.product || {
        name: item?.productNameSnapshot,
        category: item?.productCategorySnapshot,
        type: item?.productTypeSnapshot,
    };
}

/** ¿Esta línea es un TEÑIDO? (no: un fotocromático con color NO lo es). */
export function esItemDeTenido(item: ItemConColor): boolean {
    return isTeñidoAddon(productoDeItem(item));
}

/** Qué clase de color lleva esta línea, o null si no lleva ninguno. */
export function claseDeColor(item: ItemConColor): 'TENIDO' | 'FOTOCROMATICO' | null {
    if (esItemDeTenido(item)) return 'TENIDO';
    return paletaDeFotocromatico(productoDeItem(item)) ? 'FOTOCROMATICO' : null;
}

/**
 * ¿Este PRODUCTO tiene colores para elegir?
 *
 * Mismo criterio que `claseDeColor`, pero sobre el producto suelto: lo usa el
 * carrito, que decide si dibuja el botón antes de que exista una línea. Manda
 * la paleta, no una lista de palabras clave aparte — cuando eran dos listas,
 * los 15 cristales Xperio tenían su paleta cargada y el botón nunca aparecía.
 */
export function needsColorSelection(product: any): boolean {
    if (!product) return false;
    if (isTeñidoAddon(product)) return true;
    return paletaDeFotocromatico(product) !== null;
}

/** Solo las líneas de TEÑIDO. Lo que va al laboratorio como color a hacer. */
export function itemsDeTenido<T extends ItemConColor>(items: T[] | null | undefined): T[] {
    return (items || []).filter(esItemDeTenido);
}

/** El estilo del teñido con el nombre que usa el laboratorio, o null. */
export function estiloDeTenido(item: ItemConColor): string | null {
    if (item.crystalColorType === 'DEGRADE') return 'Degradé';
    if (item.crystalColorType === 'MUESTRA') return 'Según muestra';
    if (item.crystalColorType === 'COMPACTO') return 'Compacto';
    return null;
}

/**
 * Cómo se describe UNA línea de teñido: "Compacto · Sepia · grado 3".
 *
 * "sin color elegido" no es relleno: es el faltante que traba la venta, y
 * verlo escrito es lo que le dice al vendedor qué le falta cargar.
 */
export function tintItemLabel(item: ItemConColor): string {
    const partes = [
        estiloDeTenido(item),
        item.crystalColor,
        item.crystalColorNote ? `grado ${item.crystalColorNote}` : null,
    ].filter(Boolean);
    return partes.length > 0 ? partes.join(' · ') : 'sin color elegido';
}

/**
 * La línea completa tal cual se muestra en una lista, un PDF o una ficha:
 * "Teñido · Compacto · Sepia · grado 3 · 2º armazón" o
 * "Fotocromático · Zafiro (Azul)".
 *
 * Devuelve null cuando la línea no lleva color: así quien la usa no tiene que
 * decidir si mostrar algo o no.
 */
export function colorLineaLabel(item: ItemConColor): string | null {
    const clase = claseDeColor(item);
    if (!clase) return null;
    if (!item.crystalColor && !item.crystalColorNote) return null;

    if (clase === 'FOTOCROMATICO') {
        return `Fotocromático · ${item.crystalColor || 'sin color elegido'}`;
    }
    return [
        'Teñido',
        tintItemLabel(item),
        item.framePosition ? `${item.framePosition}º armazón` : null,
    ].filter(Boolean).join(' · ');
}

/**
 * Qué le falta al COLOR de los cristales para poder vender.
 *
 * Una sola función porque son tres los lugares que tienen que dar la misma
 * respuesta: el checkout (que lista lo que falta ANTES de intentar), el
 * servidor (que rechaza la conversión) y el chip de cada línea. Cuando cada uno
 * tenía su propia lista, el checkout dejaba apretar y el servidor tiraba un
 * error que la pantalla nunca había anticipado.
 *
 * `totalArmazones` decide si hay que preguntar a cuál va el teñido: con un solo
 * anteojo no hay nada que elegir.
 */
export type CodigoFaltante = 'COLOR_TENIDO' | 'GRADO_TENIDO' | 'ARMAZON_TENIDO' | 'COLOR_FOTOCROMATICO';

export interface FaltanteDeColor {
    code: CodigoFaltante;
    /** El nombre del producto de esa línea, para poder señalarla. */
    producto: string;
    /** El texto que se le muestra a quien tiene que resolverlo. */
    mensaje: string;
}

export function faltantesDeColor(
    items: ItemConColor[] | null | undefined,
    totalArmazones: number,
): FaltanteDeColor[] {
    const salida: FaltanteDeColor[] = [];
    for (const it of items || []) {
        const clase = claseDeColor(it);
        if (!clase) continue;
        const producto = (productoDeItem(it)?.name || 'el cristal') as string;

        if (clase === 'TENIDO') {
            if (!(it.crystalColor || '').trim()) {
                salida.push({ code: 'COLOR_TENIDO', producto, mensaje: 'El teñido no tiene color elegido. Abrí ELEGIR COLOR en esa línea y elegí el tono.' });
            }
            if (!(it.crystalColorNote || '').trim()) {
                salida.push({ code: 'GRADO_TENIDO', producto, mensaje: 'El teñido no tiene grado elegido. Abrí ELEGIR COLOR en esa línea y elegí el grado (0.5 a 4).' });
            }
            if (totalArmazones > 1 && !it.framePosition) {
                salida.push({ code: 'ARMAZON_TENIDO', producto, mensaje: `El pedido tiene ${totalArmazones} armazones y el teñido está sin asignar. Marcá en esa línea a cuál corresponde.` });
            }
            continue;
        }

        // Fotocromático: solo el tono, y solo si ese cristal viene en más de uno.
        const paleta = paletaDeFotocromatico(productoDeItem(it));
        if (paleta && paleta.tonos.length > 1 && !(it.crystalColor || '').trim()) {
            salida.push({ code: 'COLOR_FOTOCROMATICO', producto, mensaje: `Falta elegir de qué color se pone el fotocromático (${producto}). Abrí ELEGIR COLOR en esa línea y elegí el tono.` });
        }
    }
    return salida;
}

/**
 * La muestra del color, para pintar el redondelito.
 *
 * Sale del catálogo maestro de tonos —los de los fotocromáticos y los de
 * SmartLab—, no de una escalera de `includes('Gris')` escrita a mano en cada
 * pantalla: esas se desincronizan en cuanto se agrega un tono.
 */
export function hexDelColor(nombre?: string | null): string | null {
    if (!nombre) return null;
    const todos = [...Object.values(TONOS), ...TONOS_TENIDO];
    const exacto = todos.find(t => t.name.toLowerCase() === nombre.toLowerCase());
    if (exacto) return exacto.hexColor;
    // Un color cargado a mano (tabla `CrystalColor`) puede no estar en las
    // listas: se busca por parecido antes de rendirse.
    const parecido = todos.find(t => nombre.toLowerCase().includes(t.name.toLowerCase().split(' ')[0]));
    return parecido ? parecido.hexColor : null;
}
