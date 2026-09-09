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

    // ── 2x1 con los DOS pares cobrados, reclamados a Grupo Óptico el 8/9/2026 ──
    // Las facturas ORIGINALES estaban bien: el lab cobró los dos pares en vez
    // de bonificar el segundo. Ishtar lo reclamó. Dos de los ocho (Cardozo
    // 80532689 y Barroso 80535525) ya se verificaron RESUELTOS: el estado de
    // cuenta del 8/9/2026 muestra el saldo de esos comprobantes YA ACREDITADO
    // por Grupo Óptico ($217.799→$4.654 y $139.181→$13.386) — el reclamo
    // funcionó. Los otros seis todavía no aparecen en ningún estado de cuenta
    // posterior al reclamo: sin confirmar si ya se acreditaron.
    '80532699': 'RECLAMADO a Grupo Óptico el 8/9/2026 (2x1 con los dos pares cobrados) — comprobante 0004-00349127, Alejandra Cardozo. Crédito sin confirmar todavía.',
    '80532689': 'RECLAMADO y ACREDITADO por Grupo Óptico — comprobante 0004-00349065, Alejandra Cardozo. Confirmado en el estado de cuenta del 8/9/2026: pasó de $217.799 a $4.654.',
    '80525166': 'RECLAMADO a Grupo Óptico el 8/9/2026 (2x1 con los dos pares cobrados) — comprobante 0004-00346394, Ender Romero. Crédito sin confirmar todavía.',
    '80525215': 'RECLAMADO a Grupo Óptico el 8/9/2026 (2x1 con los dos pares cobrados) — comprobante 0004-00346124, Ender Romero. Crédito sin confirmar todavía.',
    '80536021': 'RECLAMADO a Grupo Óptico el 8/9/2026 (2x1 con los dos pares cobrados) — comprobante 0004-00351080, Paolo Taliente. Crédito sin confirmar todavía.',
    '80536028': 'RECLAMADO a Grupo Óptico el 8/9/2026 (2x1 con los dos pares cobrados) — comprobante 0004-00350736, Paolo Taliente. Crédito sin confirmar todavía.',
    '80535525': 'RECLAMADO y ACREDITADO por Grupo Óptico — comprobante 0004-00349999, Ramon Barroso. Confirmado en el estado de cuenta del 8/9/2026: pasó de $139.181 a $13.386.',
    '80535521': 'RECLAMADO a Grupo Óptico el 8/9/2026 (2x1 con los dos pares cobrados) — comprobante 0004-00350080, Ramon Barroso. En el estado de cuenta del 8/9/2026 el saldo bajó poco ($187.746→$184.023): revisar si el crédito de este par en particular ya se aplicó entero.',
};
