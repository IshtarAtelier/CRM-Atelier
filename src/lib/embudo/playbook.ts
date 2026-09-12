import type { PipelineStageKey } from '@/types/leads';
import type { TemplateName } from '@/lib/whatsapp/templates';
import { SEG1_HOURS, SEG2_HOURS, FRIO_HOURS, STAGE_ORDER, VENTANA_EMBUDO_DIAS } from '@/lib/leads-pipeline';

/**
 * PLAYBOOK DEL EMBUDO — qué toca hacer con cada lead, y cuándo.
 *
 * Es la única definición de "el siguiente paso". La leen el tablero
 * (/admin/leads), el resumen diario del equipo y el registro de envíos: si
 * se cambia un plazo o una plantilla, se cambia acá y en ningún otro lado.
 *
 * Con la API oficial de WhatsApp NADA sale solo hacia el cliente (decisión del
 * 18/8/2026). El motor no manda: dice qué plantilla aprobada corresponde hoy,
 * una persona la confirma desde el buzón, y ESE envío es lo que mueve la
 * tarjeta de columna (ver registrar-seguimiento.ts). Antes las tarjetas
 * avanzaban solo por el paso del tiempo y todas decían "Sin contactar", porque
 * mandar una plantilla no dejaba ningún rastro.
 *
 * Los plazos son los de siempre (48h / 4 días / 15 días), definidos en
 * leads-pipeline.ts; acá solo se les asigna la plantilla y la etiqueta.
 */

const HORA_MS = 3_600_000;

/**
 * Plantilla → etiqueta de chat que deja al mandarse. Es lo que hace que el
 * clasificador (stageByLabels) vea "seguimiento enviado" y mueva la tarjeta.
 * Las tres de primer toque (presupuesto / charla frenada / carrito) marcan el
 * mismo escalón: distintas puertas de entrada, mismo primer seguimiento.
 */
export const ETIQUETA_POR_PLANTILLA: Partial<Record<TemplateName, string>> = {
    seguimiento_presupuesto: 'SEGUIMIENTO_DIA_1',
    seguimiento_lentes_sin_receta: 'SEGUIMIENTO_DIA_1',
    seguimiento_lentes_con_receta: 'SEGUIMIENTO_DIA_1',
    seguimiento_carrito: 'SEGUIMIENTO_DIA_1',
    invitacion_local_v4: 'SEGUIMIENTO_DIA_4',
    ultimo_seguimiento: 'SEGUIMIENTO_DIA_15',
};

/** Las plantillas que cuentan como "seguimiento" (las demás son transaccionales). */
export const PLANTILLAS_DE_SEGUIMIENTO = Object.keys(ETIQUETA_POR_PLANTILLA) as TemplateName[];

export function esPlantillaDeSeguimiento(nombre: string): nombre is TemplateName {
    return nombre in ETIQUETA_POR_PLANTILLA;
}

/** Escalón de seguimiento → plantilla que le corresponde. */
const PLANTILLA_POR_ESCALON: Record<'seguimiento1' | 'seguimiento2' | 'seguimiento10dias', TemplateName> = {
    seguimiento1: 'seguimiento_presupuesto',
    seguimiento2: 'invitacion_local_v4',
    seguimiento10dias: 'ultimo_seguimiento',
};

/** Escalón → cuántas horas después del presupuesto vence. */
const VENCE_A_LAS_HORAS: Record<'seguimiento1' | 'seguimiento2' | 'seguimiento10dias', number> = {
    seguimiento1: SEG1_HOURS,
    seguimiento2: SEG2_HOURS,
    seguimiento10dias: FRIO_HOURS,
};

/** Nombres cortos para mostrar en la tarjeta y en el resumen. */
export const NOMBRE_CORTO_PLANTILLA: Partial<Record<TemplateName, string>> = {
    seguimiento_presupuesto: 'Seguimiento del presupuesto',
    seguimiento_lentes_sin_receta: 'Retomar la charla (sin receta)',
    seguimiento_lentes_con_receta: 'Retomar la charla (con receta)',
    seguimiento_carrito: 'Seguimiento del carrito',
    invitacion_local_v4: 'Invitar al local',
    ultimo_seguimiento: 'Último seguimiento',
};

export type TipoDeAccion =
    /** Todavía no hay presupuesto: hay que cotizar (o pedir la receta). */
    | 'cotizar'
    /** Hay una plantilla aprobada para mandar hoy. */
    | 'plantilla'
    /** Ya se hizo todo el recorrido: decidir ganado o perdido. */
    | 'decidir'
    /** Está al día; el próximo toque vence más adelante. */
    | 'esperar';

export interface ProximaAccion {
    tipo: TipoDeAccion;
    /** Solo con tipo 'plantilla'. */
    plantilla?: TemplateName;
    /** Texto corto para la tarjeta ("Hoy: Invitar al local", "Falta cotizar"). */
    etiqueta: string;
    /** Cuándo vence (o venció) este paso. null cuando no depende de un reloj. */
    venceEn: string | null;
    /** true = hay que hacerlo hoy (ya venció). */
    vencida: boolean;
}

export interface EntradaProximaAccion {
    stage: PipelineStageKey;
    /**
     * De classifyLead: ¿el escalón que toca hoy ya está hecho? NO es lo mismo
     * que "lo contactaron": a alguien se le puede haber escrito el martes y
     * deberle igual el toque de esta semana. Lo que decide si hay que mandar
     * algo es esto, no el saludo del martes.
     */
    escalonCubierto: boolean;
    /** Presupuesto que LLEGÓ al cliente (ver presupuesto-enviado.ts); null si no hay o nunca se mandó. */
    quoteCreatedAt: Date | null;
    /** Hay un presupuesto armado en el CRM que nunca se envió: la tarjeta pide mandarlo. */
    borradorSinEnviar?: Date | null;
    /** Alta del lead: para la charla frenada sin presupuesto. */
    createdAt: Date;
    /** ¿Ya mandó la receta? Decide cuál de las dos plantillas de charla frenada le toca. */
    hasPrescription: boolean;
    /** ¿Ya vino al local? Si vino, la invitación al local no se manda (ver visito-local.ts). */
    visitoElLocal: boolean;
    /** ¿Tiene chat de WhatsApp donde mandarle algo? */
    tieneChat: boolean;
    chatLabels: string[];
    now: number;
}

function diasDesde(fecha: Date, now: number): number {
    return Math.floor((now - fecha.getTime()) / (24 * HORA_MS));
}

/**
 * El siguiente paso para un lead. Determinista: misma entrada, misma salida,
 * así el tablero y el resumen diario cuentan lo mismo.
 *
 * Casos (entrada → acción):
 * - Sin presupuesto, alta hace 1 día                     → cotizar
 * - Sin presupuesto, alta hace 40 días                   → decidir (fuera de ventana, NO cuenta para hoy)
 * - Sin presupuesto, con chat, 3 días, sin DIA_1, sin receta → plantilla seguimiento_lentes_sin_receta (vencida)
 * - Sin presupuesto, con chat, 3 días, sin DIA_1, con receta → plantilla seguimiento_lentes_con_receta (vencida)
 * - Sin presupuesto, con chat, 3 días, ya con DIA_1      → cotizar
 * - Presupuesto de hace 10h                              → esperar (vence a las 48h)
 * - Presupuesto de hace 3 días, nadie escribió           → plantilla seguimiento_presupuesto (vencida)
 * - Presupuesto de hace 3 días, DIA_1 enviado            → esperar (vence a los 4 días)
 * - Presupuesto de hace 6 días, solo DIA_1               → plantilla invitacion_local_v4 (vencida)
 * - Presupuesto de hace 6 días, solo DIA_1, YA VINO      → esperar al día 15 (no se lo invita al local)
 * - Presupuesto de hace 20 días, DIA_4 enviado           → plantilla ultimo_seguimiento (vencida)
 * - Presupuesto de hace 20 días, DIA_15 enviado          → decidir
 * - Presupuesto de hace 45 días, lo que sea             → decidir (fuera de ventana, NO cuenta para hoy)
 */
export function proximaAccion(e: EntradaProximaAccion): ProximaAccion {
    if (!e.quoteCreatedAt) {
        // Misma ventana que abajo: a quien escribió hace meses y nunca se
        // cotizó no se lo "retoma" hoy, se lo cierra o se lo reactiva con una
        // campaña. Sin esto, el primer día con backlog el tablero proponía
        // retomar charlas de 178 días.
        if (diasDesde(e.createdAt, e.now) > VENTANA_EMBUDO_DIAS) {
            return {
                tipo: 'decidir',
                etiqueta: `Sin presupuesto hace ${diasDesde(e.createdAt, e.now)} días: cerrar o archivar`,
                venceEn: new Date(e.createdAt.getTime() + VENTANA_EMBUDO_DIAS * 24 * HORA_MS).toISOString(),
                vencida: false,
            };
        }
        const yaRetomada = e.chatLabels.some(l => l.toUpperCase() === 'SEGUIMIENTO_DIA_1');
        const charlaFrenada = e.tieneChat && !yaRetomada && (e.now - e.createdAt.getTime()) > SEG1_HOURS * HORA_MS;
        if (charlaFrenada) {
            // Misma etapa del embudo, dos plantillas: a quien ya mandó la
            // receta no tiene sentido pedirle que la mande (7/9/2026).
            const plantilla = e.hasPrescription ? 'seguimiento_lentes_con_receta' : 'seguimiento_lentes_sin_receta';
            return {
                tipo: 'plantilla',
                plantilla,
                etiqueta: `Hoy: ${NOMBRE_CORTO_PLANTILLA[plantilla]} (${diasDesde(e.createdAt, e.now)} días sin presupuesto)`,
                venceEn: new Date(e.createdAt.getTime() + SEG1_HOURS * HORA_MS).toISOString(),
                vencida: true,
            };
        }
        if (e.borradorSinEnviar) {
            const d = e.borradorSinEnviar;
            const fecha = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
            return { tipo: 'cotizar', etiqueta: `Presupuesto armado el ${fecha} y NUNCA enviado: mandarlo`, venceEn: null, vencida: true };
        }
        return { tipo: 'cotizar', etiqueta: 'Falta cotizar', venceEn: null, vencida: false };
    }

    const q = e.quoteCreatedAt.getTime();
    const vence = (h: number) => new Date(q + h * HORA_MS).toISOString();

    // Fuera de la ventana del embudo: no se le manda más nada. Queda en Frío
    // para que alguien lo cierre, pero NO cuenta como "para hoy" — si contara,
    // el día que se arranca con un backlog de meses el tablero pide mandar 70
    // plantillas de marketing de golpe, que es exactamente lo que no hay que
    // hacer. Reactivar a los viejos es trabajo de una campaña, no del embudo.
    if (diasDesde(e.quoteCreatedAt, e.now) > VENTANA_EMBUDO_DIAS) {
        return {
            tipo: 'decidir',
            etiqueta: `Frío hace ${diasDesde(e.quoteCreatedAt, e.now)} días: cerrar o archivar`,
            venceEn: vence(VENTANA_EMBUDO_DIAS * 24),
            vencida: false,
        };
    }

    // Al día en la etapa actual: el reloj apunta al próximo escalón.
    if (e.stage === 'cotizacionEnviada' || (e.escalonCubierto && e.stage !== 'seguimiento10dias')) {
        const siguiente = e.stage === 'cotizacionEnviada' ? 'seguimiento1'
            : e.stage === 'seguimiento1' ? 'seguimiento2' : 'seguimiento10dias';
        const horas = VENCE_A_LAS_HORAS[siguiente];
        const faltanDias = Math.max(0, Math.ceil((q + horas * HORA_MS - e.now) / (24 * HORA_MS)));
        return {
            tipo: 'esperar',
            etiqueta: faltanDias === 0 ? `Próximo toque: hoy` : `Próximo toque en ${faltanDias} día${faltanDias === 1 ? '' : 's'}`,
            venceEn: vence(horas),
            vencida: false,
        };
    }

    if (e.stage === 'seguimiento10dias' && e.escalonCubierto) {
        return { tipo: 'decidir', etiqueta: 'Decidir: ganado o perdido', venceEn: vence(FRIO_HOURS), vencida: true };
    }

    // En un escalón de seguimiento sin haber mandado ese escalón: toca hoy.
    if (e.stage in PLANTILLA_POR_ESCALON) {
        const escalon = e.stage as keyof typeof PLANTILLA_POR_ESCALON;

        // Ya vino al local: la invitación no tiene sentido y se lee como que
        // nadie está mirando. Se saltea ese toque — no se reemplaza por otro
        // mensaje: espera al último seguimiento, que sigue aplicando.
        if (escalon === 'seguimiento2' && e.visitoElLocal) {
            const faltanDias = Math.max(0, Math.ceil((q + FRIO_HOURS * HORA_MS - e.now) / (24 * HORA_MS)));
            return {
                tipo: 'esperar',
                etiqueta: faltanDias === 0
                    ? 'Ya vino al local · próximo toque: hoy'
                    : `Ya vino al local · próximo toque en ${faltanDias} día${faltanDias === 1 ? '' : 's'}`,
                venceEn: vence(FRIO_HOURS),
                vencida: false,
            };
        }

        const plantilla = PLANTILLA_POR_ESCALON[escalon];
        return {
            tipo: 'plantilla',
            plantilla,
            etiqueta: `Hoy: ${NOMBRE_CORTO_PLANTILLA[plantilla]}`,
            venceEn: vence(VENCE_A_LAS_HORAS[escalon]),
            vencida: true,
        };
    }

    // primerContacto / nuevaReceta con presupuesto no existe (classifyLead los
    // manda a cotizacionEnviada), pero el tipo lo permite: no inventar nada.
    return { tipo: 'esperar', etiqueta: 'Al día', venceEn: null, vencida: false };
}

/** Orden para listar "lo de hoy": primero lo más atrasado. */
export function ordenarPorUrgencia<T extends { proximaAccion: ProximaAccion; stage?: PipelineStageKey }>(items: T[]): T[] {
    return [...items].sort((a, b) => {
        if (a.proximaAccion.vencida !== b.proximaAccion.vencida) return a.proximaAccion.vencida ? -1 : 1;
        const sa = a.stage ? STAGE_ORDER[a.stage] : 0;
        const sb = b.stage ? STAGE_ORDER[b.stage] : 0;
        if (sa !== sb) return sb - sa;
        return (a.proximaAccion.venceEn || '').localeCompare(b.proximaAccion.venceEn || '');
    });
}
