/**
 * Resoluciones conocidas de pedidos de laboratorio sin venta ("huérfanos").
 *
 * Cuando el administrador investiga un pedido y determina qué fue, se registra
 * acá: la conciliación agrega la aclaración a las notas de la entrada, de modo
 * que quede visible en la página, en los reportes y en los emails, y el caso no
 * vuelva a aparecer como misterio en cada corrida. Es data (no lógica): una
 * línea por pedido resuelto.
 */
export const RESOLUCIONES_CONOCIDAS: Record<string, string> = {
    // Belkis Alicia - Cambio RX 1 ($179.735, fact. 00330446 + 00330447)
    '80494514': 'RESUELTO 16/7/2026: el vendedor lo cargó a costo de Atelier — caso de COSTO VENDEDOR.',
};
