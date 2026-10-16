/**
 * El retoque de las fotos de sesión sin editar (sesión de Agostina y
 * originales de Massaru) cuando se recortan para una placa: un poco de luz,
 * de contraste y de nitidez. Es el que se aprobó con las stories del 29/9/2026;
 * lo comparten generar-stories-agostina.mjs y generar-feed-modelos.mjs.
 */
export const retoque = (img, brillo = 1.04) =>
    img.modulate({ brightness: brillo, saturation: 1.03 }).linear(1.06, -6).sharpen({ sigma: 0.6 });

/**
 * Los originales de Massaru vienen más fríos y más oscuros que los de Agos
 * (otra luz, otro día). Para que en el feed las dos sesiones se vean de la
 * misma familia, a los de Massaru se les suma luz y un toque cálido, en la
 * línea de la edición que Ishtar aprobó para la tienda ("luz cálida").
 */
export const retoqueCalido = (img) =>
    retoque(img, 1.10).recomb([[1.03, 0, 0], [0, 1.0, 0], [0, 0, 0.96]]);
