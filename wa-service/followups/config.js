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
    { type: 'DIA_1',  label: 'SEGUIMIENTO_DIA_1',  hoursAfterQuote: 24,  requiresPrevious: null },
    { type: 'DIA_4',  label: 'SEGUIMIENTO_DIA_4',  hoursAfterQuote: 96,  requiresPrevious: 'SEGUIMIENTO_DIA_1' },
    { type: 'DIA_15', label: 'SEGUIMIENTO_DIA_15', hoursAfterQuote: 360, requiresPrevious: 'SEGUIMIENTO_DIA_4' },
];

// Todas las labels de seguimiento (para exclusión mutua con inactividad)
const ALL_FOLLOWUP_LABELS = FOLLOWUP_TIERS.map(t => t.label);

// ──────────────────────────────────────────────
// Cooldowns y ventanas
// ──────────────────────────────────────────────
const COOLDOWN_HOURS = 24;                          // Mínimo entre follow-ups
const ACTIVITY_WINDOW_HOURS = 24;                   // Chat debe estar inactivo este tiempo
const PRE_SEND_ACTIVITY_WINDOW_HOURS = 2;           // Re-check antes de enviar
const QUOTE_LOOKBACK_DAYS = 20;                     // Buscar presupuestos de los últimos N días

// ──────────────────────────────────────────────
// Delays entre envíos (minutos)
// ──────────────────────────────────────────────
const SEND_DELAY_MIN_MINUTES = 3;
const SEND_DELAY_MAX_MINUTES = 7;

// ──────────────────────────────────────────────
// Generación de mensajes
// ──────────────────────────────────────────────
const MAX_OUTPUT_TOKENS = 300;
const TEMPERATURE = 0.7;
const MODEL_NAME = 'gemini-2.5-flash';
const GENERATION_TIMEOUT_MS = 30000;
const MAX_RETRIES = 1;                              // Reintentos si falla validación

// ──────────────────────────────────────────────
// Validación de mensajes
// ──────────────────────────────────────────────
const MIN_MESSAGE_LENGTH = 20;
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
    COOLDOWN_HOURS,
    ACTIVITY_WINDOW_HOURS,
    PRE_SEND_ACTIVITY_WINDOW_HOURS,
    QUOTE_LOOKBACK_DAYS,
    SEND_DELAY_MIN_MINUTES,
    SEND_DELAY_MAX_MINUTES,
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
