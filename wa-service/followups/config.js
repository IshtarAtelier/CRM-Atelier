/**
 * Configuración centralizada del sistema de seguimientos de venta.
 * Todos los parámetros, constantes y flags viven aquí.
 */

// ──────────────────────────────────────────────
// MODO TEST: redirige TODOS los envíos al admin
// ──────────────────────────────────────────────
const TEST_MODE = false;
const TEST_PHONE = '5493541215971@c.us';

// ──────────────────────────────────────────────
// Intervalos de seguimiento (en horas)
// ──────────────────────────────────────────────
const FOLLOWUP_TIERS = [
    { type: 'DIA_1',  label: 'SEGUIMIENTO_DIA_1',  hoursAfterQuote: 48,  requiresPrevious: null },
    { type: 'DIA_4',  label: 'SEGUIMIENTO_DIA_4',  hoursAfterQuote: 96,  requiresPrevious: 'SEGUIMIENTO_DIA_1' },
    { type: 'DIA_15', label: 'SEGUIMIENTO_DIA_15', hoursAfterQuote: 360, requiresPrevious: 'SEGUIMIENTO_DIA_4' },
];

// Todas las labels de seguimiento (para exclusión mutua con inactividad)
const ALL_FOLLOWUP_LABELS = FOLLOWUP_TIERS.map(t => t.label);

// ──────────────────────────────────────────────
// Cooldowns y ventanas
// ──────────────────────────────────────────────
const COOLDOWN_HOURS = 48;                          // Mínimo entre follow-ups (48hs según políticas)
const ACTIVITY_WINDOW_HOURS = 24;                   // Chat debe estar inactivo este tiempo
const PRE_SEND_ACTIVITY_WINDOW_HOURS = 2;           // Re-check antes de enviar
const QUOTE_LOOKBACK_DAYS = 20;                     // Buscar presupuestos de los últimos N días

// ──────────────────────────────────────────────
// Delays entre envíos (minutos)
// ──────────────────────────────────────────────
// Los delays se ACUMULAN dentro de una corrida (el 5º envío espera la suma de
// los 4 anteriores). Junto con MAX_TASKS_PER_CYCLE tienen que dar menos que el
// intervalo del cron (30 min), o la cola queda a medio vaciar cuando arranca la
// corrida siguiente: 6 tareas × 4 min = 24 min como peor caso.
const SEND_DELAY_MIN_MINUTES = 2;
const SEND_DELAY_MAX_MINUTES = 4;

// ──────────────────────────────────────────────
// Cola de envíos
// ──────────────────────────────────────────────
/** Tope de envíos por corrida. Cuida la cuenta de WhatsApp y acota la cola. */
const MAX_TASKS_PER_CYCLE = 6;

/**
 * Tope de tareas NUEVAS por día. Es el freno anti-bloqueo más importante.
 *
 * Los seguimientos estuvieron atados al interruptor del agente y nunca salió
 * ninguno: al separarlos quedaron 265 presupuestos represados en el primer
 * escalón (medido en producción el 4/8/2026). Soltarlos de una es un patrón de
 * envío masivo no solicitado — la forma más rápida de que WhatsApp bloquee el
 * número, que es la línea comercial de la óptica.
 *
 * Con 25 por día la deuda se drena en ~10 días hábiles, a un ritmo que se
 * parece al de una persona escribiendo. Subir SOLO después de ver varios días
 * sin advertencias y sin quejas de clientes.
 */
const MAX_NEW_TASKS_PER_DAY = Number(process.env.FOLLOWUP_MAX_NEW_PER_DAY) || 25;

/**
 * Cuánto se tolera llegar tarde a un escalón, en horas.
 *
 * Sin esto, un presupuesto de hace 20 días recibía HOY su seguimiento de
 * "48 horas": al cliente le llega un "¿pudiste verlo?" tres semanas después,
 * que suena a error y quema la relación. Si el escalón quedó más viejo que esta
 * tolerancia, se da por perdido y se pasa al siguiente que corresponda.
 */
const TIER_GRACE_HOURS = Number(process.env.FOLLOWUP_TIER_GRACE_HOURS) || 72;

/**
 * Una tarea reclamada (status SENDING) que quedó más de este tiempo sin
 * resolverse se considera huérfana y se vuelve a tomar. Es lo que rescata los
 * envíos que se perdían cuando Railway reiniciaba con timers en memoria.
 * Tiene que ser mayor que el intervalo del cron.
 */
const STALE_CLAIM_MINUTES = 45;

// ──────────────────────────────────────────────
// Tareas que el ejecutor puede mandar solo
// ──────────────────────────────────────────────
/**
 * LISTA BLANCA — solo las tareas con este prefijo se convierten en un WhatsApp
 * automático al cliente.
 *
 * Es lista blanca a propósito. El filtro anterior era solo
 * `createdBy: 'Sistema (Pasivo)'`, y con ese criterio entraban también notas
 * internas del equipo: '[RECETA POR FOTO] ... buscarla en el WhatsApp del local'
 * y '[Seguimiento Manual] Contactar a X - Razón: "..."'. Al ejecutor se le pide
 * "redactá un mensaje que cumpla esta tarea", así que esas notas se le podían
 * terminar mandando al cliente. Con lista negra, cada tipo de nota interna nuevo
 * volvería a filtrarse; con lista blanca, lo que no está previsto no sale.
 */
const AUTO_SENDABLE_TASK_PREFIXES = [
    '[Extracción Inteligente]',
    // Flujos de retención sobre la base instalada (renovación de receta,
    // posventa, segundo par). Van por el MISMO pipeline y la misma cola anti-ban
    // que el resto: el plan es explícito en no construir un sexto sistema de
    // seguimientos. Cada prefijo se agrega acá cuando el flujo que lo emite
    // existe, no antes.
    //
    // EL PEDIDO DE RESEÑA NO VA ACÁ, Y ES A PROPÓSITO. Es la única acción de
    // retención que se decidió dejar en manos de una persona: pedirle la opinión
    // a alguien que está esperando un pedido demorado o que tuvo un problema de
    // posventa es la forma más rápida de cosechar una estrella, y una reseña
    // mala no se borra. Las tareas REVIEW_REQUEST que crea el CRM al entregar
    // llevan `createdBy: 'Sistema'`, que tampoco está en la lista blanca de
    // creadores de abajo: quedan como recordatorio en la ficha y las levanta el
    // mostrador. No agregar '[RESENA]' acá sin hablarlo.
    '[CARRITO]',
    '[RENOVACION]',
    '[POSVENTA]',
    '[SEGUNDO PAR]',
];

/**
 * Quién puede haber creado una tarea para que el ejecutor la mande solo.
 * 'Sistema (Pasivo)' son las que nacen de la conversación con el cliente;
 * 'Sistema (Retención)' las que nacen de un cron sobre la base instalada.
 * Lista blanca, igual que los prefijos: lo que no está previsto no sale.
 */
const AUTO_SENDABLE_TASK_CREATORS = ['Sistema (Pasivo)', 'Sistema (Retención)'];

// ──────────────────────────────────────────────
// Generación de mensajes
// ──────────────────────────────────────────────
// gemini-2.5-flash gasta tokens de RAZONAMIENTO que se descuentan de este mismo
// presupuesto: con 300 el mensaje llegaba cortado a la mitad ("...los multif") y
// el validador lo rechazaba por corto o por no terminar limpio. Reproducido el
// 4/8/2026 sobre un presupuesto real: los 3 intentos fallaron en los 4 tipos de
// seguimiento. Es el mismo bug que tenía el extractor de fichas, y el que hacía
// que no saliera ni un seguimiento aunque el resto estuviera bien.
// conversation-gate.js:67-70 ya lo había diagnosticado. 2048 y no 1024: el
// DIA_15 (el prompt más largo, con cupón) seguía cortándose con 1024.
const MAX_OUTPUT_TOKENS = 2048;
const TEMPERATURE = 0.7;
const MODEL_NAME = 'gemini-2.5-flash';
const GENERATION_TIMEOUT_MS = 30000;
const MAX_RETRIES = 2;                              // Reintentos si falla validación (la validación de contenido de venta es estricta)

// ──────────────────────────────────────────────
// Cupón del seguimiento final (Día 15)
// ──────────────────────────────────────────────
// Descuento ADICIONAL que se le ofrece al cliente en el último seguimiento
// para cerrar la venta. Ajustar acá el porcentaje y la vigencia.
const DIA_15_COUPON = {
    enabled: true,
    percent: 10,        // % adicional sobre el presupuesto ya cotizado
    validityDays: 7,    // vigencia que se le comunica al cliente
};

// ──────────────────────────────────────────────
// Compuerta de conversación (conversation-gate.js)
// ──────────────────────────────────────────────
/** Timeout del juicio con LLM. Si vence, fail-closed: no se manda este ciclo. */
const GATE_TIMEOUT_MS = 15000;
/** Cuántos mensajes recientes lee la compuerta para decidir. */
const GATE_LOOKBACK_MESSAGES = 15;

// ──────────────────────────────────────────────
// Validación de mensajes
// ──────────────────────────────────────────────
const MIN_MESSAGE_LENGTH = 50;                      // Un saludo pelado ("Hola! cómo andás?") no alcanza
const MAX_MESSAGE_LENGTH = 250;                     // ~40 palabras máximo
const MAX_WORD_COUNT = 45;                          // Límite duro por palabras

// ──────────────────────────────────────────────
// Tipeo simulado
// ──────────────────────────────────────────────
const TYPING_MS_PER_CHAR = 40;
const TYPING_MIN_MS = 2000;
const TYPING_MAX_MS = 6000;

module.exports = {
    TEST_MODE,
    TEST_PHONE,
    FOLLOWUP_TIERS,
    ALL_FOLLOWUP_LABELS,
    DIA_15_COUPON,
    COOLDOWN_HOURS,
    ACTIVITY_WINDOW_HOURS,
    PRE_SEND_ACTIVITY_WINDOW_HOURS,
    QUOTE_LOOKBACK_DAYS,
    SEND_DELAY_MIN_MINUTES,
    SEND_DELAY_MAX_MINUTES,
    MAX_TASKS_PER_CYCLE,
    MAX_NEW_TASKS_PER_DAY,
    TIER_GRACE_HOURS,
    STALE_CLAIM_MINUTES,
    AUTO_SENDABLE_TASK_PREFIXES,
    AUTO_SENDABLE_TASK_CREATORS,
    GATE_TIMEOUT_MS,
    GATE_LOOKBACK_MESSAGES,
    MAX_OUTPUT_TOKENS,
    TEMPERATURE,
    MODEL_NAME,
    GENERATION_TIMEOUT_MS,
    MAX_RETRIES,
    MIN_MESSAGE_LENGTH,
    MAX_MESSAGE_LENGTH,
    MAX_WORD_COUNT,
    TYPING_MS_PER_CHAR,
    TYPING_MIN_MS,
    TYPING_MAX_MS,
};
