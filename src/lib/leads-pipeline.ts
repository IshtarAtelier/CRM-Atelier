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
/**
 * Ventana del embudo activo, en días. Más viejo que esto ya no es un lead a
 * seguir: es alguien a cerrar (ganado/perdido) o a reactivar con una campaña.
 * Es la misma regla de Oportunidades de Cierre ("no compró aún + ≤30 días").
 */
export const VENTANA_EMBUDO_DIAS = 30;

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
  /**
   * Último mensaje que una PERSONA del equipo le mandó por WhatsApp (no el bot).
   *
   * Por qué existe: hasta el 9/9/2026 la única prueba de contacto era la
   * etiqueta que deja el envío de una PLANTILLA aprobada. Pero dentro de la
   * ventana de 24 h el equipo contesta con texto libre —que es lo normal y lo
   * humano— y eso no dejaba rastro. Medido contra producción: de 339 leads con
   * presupuesto, 194 figuraban "Sin contactar" cuando una persona les había
   * escrito. El tablero le mentía al equipo sobre su propio trabajo, que es
   * justo lo que el rótulo "Sin contactar" existe para no hacer.
   */
  ultimoMensajeHumano?: Date | null;
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
   * ¿Alguien le habló a esta persona después del presupuesto?
   *
   * Es lo que muestra la tarjeta ("Sin contactar") y responde la pregunta de
   * quien la mira: ¿lo dejamos plantado? Cuenta el envío de una plantilla (deja
   * etiqueta) Y el mensaje escrito a mano por alguien del equipo — que dentro
   * de la ventana de 24 h es lo normal y antes no dejaba ningún rastro.
   */
  contactado: boolean;
  /**
   * ¿El escalón que le toca HOY ya está hecho?
   *
   * Lo mira el playbook para decidir si hay que mandar algo. No es lo mismo que
   * `contactado`: se le puede haber escrito el martes y deberle igual el toque
   * de esta semana. Mezclar las dos preguntas hacía que el tablero dijera "Sin
   * contactar" a 194 de 339 leads a los que sí les habían escrito.
   */
  escalonCubierto: boolean;
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
 * - Presupuesto de hace 6 días, una PERSONA le escribió al 4º día → seguimiento2, true (el mensaje humano cubre su escalón)
 */
export function classifyLead(input: ClassifyInput): ClassifyResult {
  const { quoteCreatedAt, hasPrescription, chatLabels, tagNames, now, ultimoMensajeHumano } = input;

  if (!quoteCreatedAt) {
    return { stage: hasPrescription ? 'nuevaReceta' : 'primerContacto', contactado: true, escalonCubierto: true };
  }

  // Un mensaje humano cuenta como haber cubierto el escalón que estaba vigente
  // el día que se mandó: si le escribieron al cuarto día, el escalón de las 48h
  // está hecho. Se integra con el max() de abajo como una etiqueta más, en vez
  // de ser una regla aparte que después divergiría.
  const contactoStage = ultimoMensajeHumano && ultimoMensajeHumano.getTime() > quoteCreatedAt.getTime()
    ? stageByQuoteAge(quoteCreatedAt, ultimoMensajeHumano.getTime())
    : null;
  const porEtiquetas = stageByLabels(chatLabels, tagNames);
  const labelStage = contactoStage && STAGE_ORDER[contactoStage] > STAGE_ORDER[porEtiquetas]
    ? contactoStage
    : porEtiquetas;
  const timeStage = stageByQuoteAge(quoteCreatedAt, now);

  // max(etapa por etiqueta, etapa por tiempo)
  // ¿Le habló ALGUIEN después del presupuesto? (plantilla enviada o mensaje
  // escrito a mano). Es la pregunta de la TARJETA.
  const huboContacto = porEtiquetas !== 'cotizacionEnviada' || contactoStage !== null;

  if (STAGE_ORDER[timeStage] > STAGE_ORDER[labelStage]) {
    // El tiempo lo empujó más allá de lo cubierto: el toque de hoy se debe.
    // Pero si le escribieron, la tarjeta NO puede decir "Sin contactar".
    return { stage: timeStage, contactado: huboContacto, escalonCubierto: false };
  }
  return { stage: labelStage, contactado: true, escalonCubierto: true };
}
