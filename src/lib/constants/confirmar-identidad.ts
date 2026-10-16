/**
 * Confirmación de identidad en la computadora compartida.
 *
 * Milena y Matías trabajan en la MISMA computadora: la sesión del CRM queda
 * abierta con el usuario de quien entró primero, y todo lo que hace el otro
 * sale firmado con el nombre equivocado (ficha, AuditLog, "vendedor"). Cada
 * cierto tiempo de trabajo REAL el panel pregunta "¿sos Milena o Matías?".
 * Ishtar, 15/10/2026.
 */

/** Horas de trabajo activo entre pregunta y pregunta. */
export const HORAS_ENTRE_CONFIRMACIONES = 3;

/** Sin tocar el teclado ni el mouse por más de esto, el reloj no suma. */
export const MINUTOS_INACTIVIDAD = 5;

/** Los únicos usuarios que comparten la compu. Se compara contra el nombre sin tildes. */
export const USUARIOS_COMPARTIDOS = ['milena', 'matias'] as const;

export const NOMBRES_VISIBLES: Record<(typeof USUARIOS_COMPARTIDOS)[number], string> = {
    milena: 'Milena',
    matias: 'Matías',
};

/** "Matías Turchi" → "matias" si es uno de los dos; null si no comparte. */
export function usuarioCompartido(nombre: string | null | undefined): (typeof USUARIOS_COMPARTIDOS)[number] | null {
    const limpio = (nombre || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim()
        .toLowerCase();
    return USUARIOS_COMPARTIDOS.find((u) => limpio === u || limpio.startsWith(u + ' ')) ?? null;
}
