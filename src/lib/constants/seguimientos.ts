import type { TemplateName } from '@/lib/whatsapp/templates';

/**
 * Motor automático de seguimientos — los números y las decisiones.
 * Diseño en `docs/plan-motor-seguimientos.md`.
 */

/**
 * Solo se tocan leads que entraron DESPUÉS de esta fecha. Decisión de Ishtar
 * (7/9/2026): a los viejos se les escribe a mano. Sin este corte, el primer
 * día el motor le mandaría plantillas a 779 personas que consultaron hace más
 * de un mes — lo que más se parece a spam y lo que más le pega a la calidad
 * del número.
 */
export const MOTOR_SEGUIMIENTOS_DESDE = new Date('2026-09-07T00:00:00-03:00');

/**
 * PRENDIDO ('real') desde el 11/9/2026, con el OK explícito de Ishtar sobre la
 * lista real del día (24 personas, plantilla `seguimiento_presupuesto`):
 * "el embudo de seguimientos de leads tiene que ser 100 % automático, salvo
 * que se apague desde el lead". Arrancó EN SECO el 7/9 y corrió así cuatro
 * días listando a quién le habría escrito; en ese lapso se cerraron los
 * dobles envíos latentes y se agregó el interruptor por persona
 * (`seguimientoApagado` en politica.ts). Se puede apagar sin deploy con
 * `SystemSetting.seguimientos_auto_modo = 'seco'` (o `followups_enabled = false`).
 */
export const MODO_POR_DEFECTO: 'seco' | 'real' = 'real';

/** Tope de envíos automáticos por día. Se pisa con `SystemSetting.seguimientos_cupo_diario`. */
export const CUPO_DIARIO_POR_DEFECTO = 30;

/**
 * Cuántos salen por cada tick horario, con pausa entre uno y otro. El cupo es
 * el techo del día; el lote es el ritmo. 5 por hora entre las 10 y las 19 son
 * hasta 45: el cupo corta antes.
 */
export const LOTE_POR_TICK = 5;
export const PAUSA_ENTRE_ENVIOS_MS: readonly [number, number] = [15_000, 25_000];

/** Horario en que salen (hora de Córdoba). Igual que las campañas: 10 a 19. */
export const HORA_DESDE = 10;
export const HORA_HASTA = 19;

/**
 * Si el cliente escribió hace menos de esto, la charla está viva: la atiende
 * el bot o una persona, y meterle una plantilla encima es pisar la conversación.
 */
export const SILENCIO_MINIMO_HORAS = 48;

/**
 * Las plantillas que el motor tiene permitido mandar solo. Cinco: las DOS
 * puertas de entrada al primer toque (con presupuesto / sin presupuesto —
 * esta última partida en con/sin receta desde el 7/9/26), el segundo y el
 * último (`playbook.ts`).
 * `seguimiento_carrito` NO está: lo cubre el cron de carritos abandonados.
 * `retomar_conversacion` NO está: la usan Matías e Ishtar a mano, y está bien así.
 */
export const PLANTILLAS_AUTOMATICAS: readonly TemplateName[] = [
    'seguimiento_presupuesto',
    'seguimiento_lentes_sin_receta',
    'seguimiento_lentes_con_receta',
    'invitacion_local_v4',
    'ultimo_seguimiento',
];
