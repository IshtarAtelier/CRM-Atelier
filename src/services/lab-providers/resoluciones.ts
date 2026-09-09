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

    // ── 2x1 con los DOS pares cobrados, ya reclamados a Grupo Óptico ──────────
    // Ishtar los reportó al laboratorio el 8/9/2026. Siguen siendo sobrecostos
    // reales —el segundo par de un 2x1 lo pone el lab y no debería facturarse—,
    // pero ya están en tratativa: la aclaración evita volver a levantarlos como
    // hallazgo nuevo en cada corrida.
    '80532699': 'YA RECLAMADO a Grupo Óptico el 8/9/2026 (2x1 con los dos pares cobrados) — comprobante 0004-00349127, Alejandra Cardozo.',
    '80532689': 'YA RECLAMADO a Grupo Óptico el 8/9/2026 (2x1 con los dos pares cobrados) — comprobante 0004-00349065, Alejandra Cardozo.',
    '80525166': 'YA RECLAMADO a Grupo Óptico el 8/9/2026 (2x1 con los dos pares cobrados) — comprobante 0004-00346394, Ender Romero.',
    '80525215': 'YA RECLAMADO a Grupo Óptico el 8/9/2026 (2x1 con los dos pares cobrados) — comprobante 0004-00346124, Ender Romero.',
    '80536021': 'YA RECLAMADO a Grupo Óptico el 8/9/2026 (2x1 con los dos pares cobrados) — comprobante 0004-00351080, Paolo Taliente.',
    '80536028': 'YA RECLAMADO a Grupo Óptico el 8/9/2026 (2x1 con los dos pares cobrados) — comprobante 0004-00350736, Paolo Taliente.',
    '80535525': 'YA RECLAMADO a Grupo Óptico el 8/9/2026 (2x1 con los dos pares cobrados) — comprobante 0004-00349999, Ramon Barroso.',
    '80535521': 'YA RECLAMADO a Grupo Óptico el 8/9/2026 (2x1 con los dos pares cobrados) — comprobante 0004-00350080, Ramon Barroso.',
};
