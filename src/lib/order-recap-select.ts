// ────────────────────────────────────────────────────────────────────────────
// TODO lo que hay que leer de un pedido para armar su repaso.
//
// Por qué existe. El repaso (armazones, medidas, teñido, receta, fotos) se arma
// en cinco lugares: la nota de la ficha, la re-confirmación, la confirmación
// que recibe el cliente, la pantalla de la venta y el listado. Cada uno tenía su
// propio `select` escrito a mano, y ese fue EL bug repetido de todo el trabajo:
// se agregaba un campo, se enganchaba en la pantalla, y en los otros cuatro
// lugares el dato simplemente no llegaba. Sin error, sin log — el campo llegaba
// `undefined` y el repaso salía a medias o directamente mentía ("NO lleva
// teñido" en un pedido con teñido).
//
// Ahora hay UN select. Agregar un campo al repaso es agregarlo acá, y llega a
// todos lados a la vez. Si mañana aparece un dato nuevo del armazón, no hay que
// acordarse de cinco archivos.
//
// Los `select` de otros usos (facturación, caja, listados) siguen siendo suyos:
// esto es específicamente lo que necesita el REPASO.
// ────────────────────────────────────────────────────────────────────────────

import type { Prisma } from '@prisma/client';

/** Los campos de cada línea del pedido que el repaso necesita. */
export const SELECT_ITEMS_REPASO = {
    id: true,
    quantity: true,
    price: true,
    eye: true,
    // Teñido: qué color, de qué tipo, con qué grado y para cuál armazón.
    crystalColor: true,
    crystalColorType: true,
    crystalColorNote: true,
    framePosition: true,
    // Snapshots: lo que se vendió sobrevive aunque el producto se borre o cambie.
    productNameSnapshot: true,
    productCategorySnapshot: true,
    productTypeSnapshot: true,
    productBrandSnapshot: true,
    product: {
        select: {
            id: true, name: true, brand: true, category: true, type: true,
            is2x1: true, imagenesCatalogo: true,
        },
    },
} satisfies Prisma.OrderItemSelect;

/** Los armazones del pedido (uno por par de cristales), en orden. */
export const SELECT_FRAMES_REPASO = {
    orderBy: { position: 'asc' },
    select: {
        position: true, shape: true, a: true, b: true, dbl: true, edc: true,
        details: true, imageUrl: true, heightOD: true, heightOI: true,
    },
} as const;

/**
 * Todo lo que necesita el repaso de un pedido.
 *
 * Incluye las columnas viejas de armazón (frameA…, frameA2…) además de la tabla
 * `frames`: hay pedidos anteriores a la migración que solo tienen esas, y
 * `framesDeLaOrden()` cae a ellas cuando la fila no existe.
 */
export const SELECT_REPASO = {
    id: true,
    total: true,
    paid: true,
    orderType: true,
    isLocked: true,
    clientId: true,
    labSentBy: true,
    labSentAt: true,
    labStatus: true,
    appliedPromoName: true,
    prescriptionSnapshot: true,
    prescriptionId: true,

    // Origen del armazón
    frameSource: true,
    userFrameBrand: true,
    userFrameModel: true,
    userFrameNotes: true,

    // Armazón 1 y 2 en columnas (compatibilidad con pedidos viejos)
    labFrameShape: true, labFrameDetails: true,
    frameA: true, frameB: true, frameDbl: true, frameEdc: true,
    frameImageUrl: true, labHeightOD: true, labHeightOI: true,
    labFrameShape2: true, labFrameDetails2: true,
    frameA2: true, frameB2: true, frameDbl2: true, frameEdc2: true,
    frameImageUrl2: true, labHeightOD2: true, labHeightOI2: true,

    // Teñido por el camino viejo (respaldo de los items)
    labColor: true,
    labTreatment: true,
    labNotes: true,

    frames: SELECT_FRAMES_REPASO,
    items: { select: SELECT_ITEMS_REPASO },
    prescription: true,
} satisfies Prisma.OrderSelect;

/** El repaso + los datos del cliente, para lo que además le escribe. */
export const SELECT_REPASO_CON_CLIENTE = {
    ...SELECT_REPASO,
    client: { select: { id: true, name: true, email: true, phone: true } },
} satisfies Prisma.OrderSelect;
