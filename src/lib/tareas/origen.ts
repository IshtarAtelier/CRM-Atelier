/**
 * DE QUIÉN ES CADA TAREA — la única definición.
 *
 * Regla dictada por Ishtar el 10/9/2026: en "Tareas" tienen que estar
 * ÚNICAMENTE las que programó una persona del equipo. Todo lo que genera un
 * motor automático (el embudo, el extractor pasivo, el bot, los seguimientos
 * de retención) es REGISTRO de lo que hizo el sistema, y mezclado con lo que
 * el vendedor tiene que hacer convierte la campanita en ruido: en producción
 * se midió que de 334 tareas creadas en una semana, CERO las había creado una
 * persona (`internal-messaging.service.ts`, 22/8/2026).
 *
 * Cómo se separan, y por qué así:
 *
 * - Las del EMBUDO nacen con `type: 'EMBUDO'` (`sincronizar-tareas.ts`). Es la
 *   separación limpia: `type` ya es un String suelto en el schema, así que
 *   sumar un valor no pide migración, y la campanita —que filtra por
 *   `type: 'TASK'`— deja de verlas sola. Tienen su propio ícono en el dock.
 *
 * - Los otros motores (`wa-service`) siguen escribiendo `type: 'TASK'` y NO se
 *   tocan: están apagados desde la migración a la API oficial
 *   (`WA_TRANSPORT=cloud` no carga ni los seguimientos ni el extractor), y
 *   `smart-task-executor.js` los busca por `type + createdBy`. Cambiarles el
 *   tipo rompería un motor dormido sin que nadie lo note. Se los filtra en la
 *   LECTURA, con la lista de abajo: si algún día vuelven a prenderse, sus
 *   tareas siguen sin ensuciar la campanita.
 *
 * - Las `⚠️` de fallo (una confirmación que no salió, un aviso de despacho que
 *   se cayó) ya NO nacen como tarea: van como mensaje del sistema a la
 *   mensajería interna del equipo (`src/lib/avisos/aviso-al-equipo.ts`). Los
 *   nombres quedan igual en la lista por las que ya están en la base.
 */

import type { Prisma } from '@prisma/client';

/** Las tareas del embudo llevan su propio tipo, fuera de la campanita. */
export const TIPO_EMBUDO = 'EMBUDO';

/**
 * `createdBy` de los motores automáticos. Medidos contra producción el
 * 22/8/2026 y confirmados en el código de `wa-service/`.
 */
export const CREADORES_AUTOMATICOS = [
    'Sistema',
    'Sistema (Embudo)',
    'Sistema (Pasivo)',
    'Sistema (Retención)',
    'Sistema (Retencion)',
    'Sistema (cierre venta)',
    'Bot',
    'Agente Bot',
    'Bot Trigger',
] as const;

/**
 * Prefijos que delatan una tarea de máquina aunque `createdBy` haya quedado en
 * null (pasaba con los fallbacks de notificación y con 12 de las 334 medidas).
 * Se comparan en SQL con `startsWith`.
 */
export const PREFIJOS_AUTOMATICOS = [
    '[Extracción Inteligente]',
    '[Seguimiento Manual]',
    '[RECETA POR FOTO]',
    '⚠️',
    '⚠',
] as const;

/**
 * Filtro Prisma: SOLO lo que programó una persona.
 *
 * `createdBy: null` NO se descarta: las tareas viejas de la base no tienen
 * autor y entre ellas hay manuales legítimas. La limpieza de arrastre la hace
 * `scripts/maintenance/limpiar-tareas-automaticas.mjs` una sola vez; de acá en
 * adelante toda tarea manual nace firmada (`ContactService.addTask` guarda el
 * `actor.name`).
 */
export const SOLO_DEL_VENDEDOR: Prisma.ClientTaskWhereInput = {
    type: 'TASK',
    AND: [
        // El `OR` con `null` NO es decorativo: en SQL `NULL NOT IN (...)` no da
        // TRUE sino NULL, así que un `notIn` a secas se comía TODAS las tareas
        // sin autor — que son justamente las viejas escritas a mano ("Quedó que
        // pasaba por el local", "(ish) ya le pasé presu"). Se probó: dejaba la
        // campanita en cero.
        { OR: [{ createdBy: null }, { createdBy: { notIn: [...CREADORES_AUTOMATICOS] } }] },
        // `description` nunca es null (columna obligatoria), así que acá el
        // NOT se comporta como uno espera.
        ...PREFIJOS_AUTOMATICOS.map(p => ({ NOT: { description: { startsWith: p } } })),
    ],
};

/** Filtro Prisma: solo las del embudo (las que muestra su ícono del dock). */
export const SOLO_DEL_EMBUDO: Prisma.ClientTaskWhereInput = { type: TIPO_EMBUDO };
