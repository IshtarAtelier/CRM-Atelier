import type { PipelineStageKey } from '@/types/leads';

// ─────────────────────────────────────────────────────────────
// leads-pipeline — clasificación de leads en el embudo de ventas
//
// Única fuente de verdad para decidir en qué columna cae un lead.
// La usa GET /api/leads/pipeline (clasificación) y
// PATCH /api/leads/pipeline/move (validación de destino y dirección).
//
// Regla central (pedido de la dueña): un lead CON presupuesto se ubica
// por el MÁXIMO entre:
//   a) la etapa según etiquetas de seguimiento ENVIADAS (mensaje real), y
//   b) la etapa según la ANTIGÜEDAD del presupuesto (tiempo real).
// Si la etapa final vino solo por tiempo, el lead figura "sin contactar".
// ─────────────────────────────────────────────────────────────

/** Orden de las columnas del embudo (menor = más temprano). */
export const STAGE_ORDER: Record<PipelineStageKey, number> = {
  primerContacto: 0,
  nuevaReceta: 1,
  cotizacionEnviada: 2,
  seguimiento1: 3,
  seguimiento2: 4,
  seguimiento10dias: 5,
};

/** Columnas que representan un escalón de seguimiento. */
export const FOLLOWUP_STAGES: PipelineStageKey[] = [
  'seguimiento1',
  'seguimiento2',
  'seguimiento10dias',
];

export function isFollowupStage(stage: PipelineStageKey): boolean {
  return FOLLOWUP_STAGES.includes(stage);
}

// Umbrales de antigüedad del presupuesto, coherentes con los tiers
// DIA_1 / DIA_4 / DIA_15 del wa-service (la columna "Seguimiento 2"
// dice 2-10 días, pero el motor manda el escalón 2 al día 4 y el de
// frío al día 15 — usamos esos cortes para no desalinear).
const HOUR = 3_600_000;
export const SEG1_HOURS = 48; // >48h  → Seguimiento 1
export const SEG2_HOURS = 96; // >96h  (4 días)  → Seguimiento 2
export const FRIO_HOURS = 360; // >360h (15 días) → Frío

/** Etapa que corresponde por pura antigüedad del presupuesto. */
export function stageByQuoteAge(quoteCreatedAt: Date, now: number): PipelineStageKey {
  const ageHours = (now - quoteCreatedAt.getTime()) / HOUR;
  if (ageHours > FRIO_HOURS) return 'seguimiento10dias';
  if (ageHours > SEG2_HOURS) return 'seguimiento2';
  if (ageHours > SEG1_HOURS) return 'seguimiento1';
  return 'cotizacionEnviada';
}

/** Etapa que corresponde por etiquetas/tags de seguimiento ya enviados. */
export function stageByLabels(chatLabels: string[], tagNames: string[]): PipelineStageKey {
  const searchPool = [
    ...chatLabels.map(l => l.toLowerCase()),
    ...tagNames.map(t => t.toLowerCase()),
  ];
  if (searchPool.some(x => x.includes('seguimiento_dia_15') || x.includes('seguimiento 15') || x.includes('frío') || x.includes('frio'))) {
    return 'seguimiento10dias';
  }
  if (searchPool.some(x => x.includes('seguimiento_dia_4') || x.includes('seguimiento 4') || x.includes('seguimiento 2'))) {
    return 'seguimiento2';
  }
  if (searchPool.some(x => x.includes('seguimiento_dia_1') || x.includes('seguimiento 1'))) {
    return 'seguimiento1';
  }
  return 'cotizacionEnviada';
}

export interface ClassifyInput {
  /** Presupuesto más reciente (QUOTE), o null si no tiene. */
  quoteCreatedAt: Date | null;
  /** ¿Tiene al menos una receta cargada? */
  hasPrescription: boolean;
  /** chatLabels del chat de WhatsApp más reciente. */
  chatLabels: string[];
  /** Nombres de tags del cliente. */
  tagNames: string[];
  /** Reloj inyectable (Date.now()). */
  now: number;
}

export interface ClassifyResult {
  stage: PipelineStageKey;
  /**
   * true  → la etapa vino por etiqueta (hubo mensaje de seguimiento enviado).
   * false → la etapa vino SOLO por el paso del tiempo: nadie contactó al lead.
   * Solo es significativo en columnas de seguimiento.
   */
  contactado: boolean;
}

/**
 * Clasifica un lead calificado en su columna del embudo.
 *
 * Tests mentales (entrada → columna, contactado):
 * - Sin receta, sin presupuesto                     → primerContacto,    true
 * - Con receta, sin presupuesto                     → nuevaReceta,       true
 * - Presupuesto de hace 3h, sin etiquetas           → cotizacionEnviada, true
 * - Presupuesto de hace 3 días, sin etiquetas       → seguimiento1,      false (⚠️ sin contactar)
 * - Presupuesto de hace 3 días, DIA_1 enviado       → seguimiento1,      true  (✅)
 * - Presupuesto de hace 6 días, solo DIA_1 enviado  → seguimiento2,      false (el tiempo ya lo pasó)
 * - Presupuesto de hace 6 días, DIA_4 enviado       → seguimiento2,      true
 * - Presupuesto de hace 20 días, DIA_4 enviado      → seguimiento10dias, false
 * - Presupuesto de hace 20 días, DIA_15 enviado     → seguimiento10dias, true
 * - Presupuesto de hace 3h, DIA_1 enviado (manual)  → seguimiento1,      true  (la etiqueta manda si es mayor)
 */
export function classifyLead(input: ClassifyInput): ClassifyResult {
  const { quoteCreatedAt, hasPrescription, chatLabels, tagNames, now } = input;

  if (!quoteCreatedAt) {
    return { stage: hasPrescription ? 'nuevaReceta' : 'primerContacto', contactado: true };
  }

  const labelStage = stageByLabels(chatLabels, tagNames);
  const timeStage = stageByQuoteAge(quoteCreatedAt, now);

  // max(etapa por etiqueta, etapa por tiempo)
  if (STAGE_ORDER[timeStage] > STAGE_ORDER[labelStage]) {
    // El tiempo lo empujó más allá de lo que se le envió → sin contactar.
    return { stage: timeStage, contactado: false };
  }
  return { stage: labelStage, contactado: true };
}
