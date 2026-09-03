// ────────────────────────────────────────────────────────────────────────────
// 2x1 en armazones de la TIENDA WEB — la regla, en un solo lugar.
//
// Pedido de Ishtar el 2/9/2026: que la tienda pueda hacer 2x1 en armazones.
//
// QUÉ ES (y qué NO es)
// Esto es una promo de la tienda web: el cliente pone DOS armazones en el
// carrito y paga uno. No tiene nada que ver con el 2x1 de MULTIFOCALES del CRM
// (`promo-utils.ts`: `hasActive2x1Promo` + `pick2x1FrameDiscount`), que regala
// un armazón cuando se venden dos pares de cristales multifocales y solo
// bonifica los que están tildados con `eligible2x1`. Son dos promos distintas
// que se llaman parecido; no comparten código a propósito, porque comparten
// nombre y nada más.
//
// POR QUÉ ESTÁ TODO ACÁ Y NO EN CADA PANTALLA
// Regla del proyecto: el cálculo de plata vive en un solo lugar. Esta función
// la llaman el carrito, el checkout y —lo que importa— la ruta de pago, que es
// la única que cobra de verdad. Si el descuento se calculara aparte en el
// cliente, cualquiera podría mandar el total que quiera.
//
// LAS DECISIONES, Y POR QUÉ
//
//  · GRATIS EL MÁS BARATO. Con dos armazones de $136.000 y $180.000, el que se
//    regala es el de $136.000. Es lo que hace cualquier 2x1 y es lo que protege
//    el margen; "el más caro gratis" con un catálogo de precios parejos suena
//    igual para el cliente y cuesta más.
//
//  · SOLO LA PARTE DEL ARMAZÓN. Si el armazón viene con cristales cargados, lo
//    que se bonifica es el armazón, no los cristales. Los cristales tienen su
//    propia promo (el 2x1 de Varilux) y sumarlas regalaría un par entero.
//
//  · DE A PARES. Tres armazones = uno gratis. Cuatro = dos. Nunca "el tercero
//    también" — se regala floor(n/2).
//
//  · NO PARA MAYORISTAS. Una óptica logueada ya compra a precio mayorista;
//    encima el 2x1 sería vender por debajo del costo. Se excluye en el borde,
//    no acá: quien llama pasa la lista ya filtrada.
//
//  · SE PRENDE Y SE APAGA. Nada de esto corre si `web_promo_2x1_frames` está en
//    false. Una promo que regala producto tiene que poder apagarse desde
//    /admin/web sin un deploy.
//
// CÓMO SE COMBINA CON EL 15% DE TRANSFERENCIA
// Primero el 2x1, después el 15%. El 2x1 cambia QUÉ se cobra (un armazón menos);
// el 15% es una condición de PAGO sobre lo que quedó a cobrar. En ese orden el
// cliente que paga por transferencia dos armazones de $136.000 paga
// $136.000 − 15% = $115.600, y no $115.600 − $136.000, que daría negativo.
// ────────────────────────────────────────────────────────────────────────────

/** Un armazón del carrito, ya separado de sus cristales. */
export interface ArmazonEnCarrito {
    /** Id de la línea del carrito (para poder marcarla como bonificada). */
    id: string;
    /** Precio SOLO del armazón, sin cristales ni tratamientos. */
    precioArmazon: number;
    /** Cuántas unidades de ese armazón hay en la línea. */
    cantidad: number;
}

export interface Resultado2x1 {
    /** La promo está prendida Y hay al menos un par. */
    aplica: boolean;
    /** Cuántos armazones se regalan. */
    bonificados: number;
    /** Cuánta plata se descuenta del total, en pesos. */
    descuento: number;
    /** Líneas del carrito que tienen al menos una unidad bonificada. */
    idsBonificados: string[];
    /**
     * Cuántos armazones más hay que sumar para que entre otro gratis.
     * Con 1 armazón da 1 ("sumá uno y va gratis"); con 2 da 2. Es el número que
     * usa el empujón del carrito, y por eso se calcula acá y no en la vista.
     */
    faltanParaElProximo: number;
}

const VACIO: Resultado2x1 = {
    aplica: false,
    bonificados: 0,
    descuento: 0,
    idsBonificados: [],
    faltanParaElProximo: 0,
};

/**
 * Calcula el 2x1 de armazones de la tienda.
 *
 * @param armazones  Solo armazones, ya sin cristales y sin mayoristas.
 * @param promoActiva `web_promo_2x1_frames`. En false devuelve todo en cero.
 */
export function calcular2x1Armazones(
    armazones: ArmazonEnCarrito[],
    promoActiva: boolean,
): Resultado2x1 {
    if (!promoActiva) return VACIO;

    // Cada unidad cuenta por separado: dos veces el mismo armazón en una línea
    // con cantidad 2 es un par, igual que dos líneas distintas.
    const unidades: { id: string; precio: number }[] = [];
    for (const a of armazones) {
        const precio = Number(a.precioArmazon);
        const cantidad = Math.floor(Number(a.cantidad));
        // Un precio inválido o <= 0 no participa: regalar contra un precio que
        // no se pudo leer es exactamente el error que hay que evitar.
        if (!Number.isFinite(precio) || precio <= 0) continue;
        if (!Number.isFinite(cantidad) || cantidad <= 0) continue;
        for (let i = 0; i < cantidad; i++) unidades.push({ id: a.id, precio });
    }

    if (unidades.length < 2) {
        return {
            ...VACIO,
            // Con un solo armazón, falta uno para el par. Con ninguno, faltan dos.
            faltanParaElProximo: unidades.length === 1 ? 1 : 2,
        };
    }

    // De menor a mayor: los bonificados son los más baratos.
    unidades.sort((x, y) => x.precio - y.precio);

    const bonificados = Math.floor(unidades.length / 2);
    const regalados = unidades.slice(0, bonificados);

    return {
        aplica: bonificados > 0,
        bonificados,
        descuento: regalados.reduce((t, u) => t + u.precio, 0),
        idsBonificados: [...new Set(regalados.map(u => u.id))],
        // Si la cantidad es par, ya está todo aprovechado y faltan 2 para el
        // próximo. Si es impar, hay uno suelto y falta 1.
        faltanParaElProximo: unidades.length % 2 === 0 ? 2 : 1,
    };
}

/**
 * Traduce las líneas del carrito del navegador a lo que espera
 * `calcular2x1Armazones`.
 *
 * OJO — ESTO Y EL SERVIDOR TIENEN QUE COINCIDIR
 * La ruta de pago decide "es armazón" con `isFrame(dbProduct)` sobre la fila de
 * la base. Acá no hay fila: el carrito vive en el navegador y solo guarda lo que
 * se le puso al agregar. Se usa el criterio más ESTRECHO posible a propósito —
 * tiene que tener `productId` y un `basePrice` propio— porque los dos errores no
 * cuestan lo mismo:
 *   · si acá sobra un ítem que el servidor no considera armazón, el cliente ve
 *     un total más bajo que el que el servidor calcula, y la guarda anti-fraude
 *     del checkout RECHAZA la compra. Una venta perdida.
 *   · si acá falta uno, el cliente ve un total más alto y el servidor le cobra
 *     menos. Feo, pero cobra bien y la compra pasa.
 * Entre los dos, se prefiere el segundo.
 *
 * Lo que queda afuera:
 *   · el segundo par del 2x1 de Varilux, que ya vale $0;
 *   · los mayoristas — eso lo decide quien llama, con `esMayorista`.
 */
export function armazonesDelCarrito(
    items: {
        id: string;
        productId?: string;
        price: number;
        basePrice?: number;
        quantity: number;
        lensConfig?: { secondPair2x1?: boolean } | null;
    }[],
    esMayorista: boolean,
    /**
     * Ids de los armazones marcados en /admin/web. Solo esos entran.
     * Un Set vacío significa que no entra ninguno — y eso es lo correcto: la
     * promo se prende con el interruptor, pero sobre QUÉ se aplica lo dice el
     * tilde. Sin tildes no hay 2x1.
     */
    marcados: Set<string>,
): ArmazonEnCarrito[] {
    if (esMayorista) return [];
    return items
        .filter(i => !!i.productId && i.productId !== 'unknown')
        .filter(i => marcados.has(i.productId as string))
        .filter(i => !i.lensConfig?.secondPair2x1)
        .map(i => ({
            id: i.id,
            // El armazón sin cristales. Si no hay `basePrice` (líneas viejas
            // guardadas antes de que existiera) se usa el precio del ítem: es lo
            // que había, y para un armazón sin cristales son el mismo número.
            precioArmazon: i.basePrice ?? i.price,
            cantidad: i.quantity,
        }));
}
