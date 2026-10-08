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
 * El embudo es 100 % automático y NO tiene pasos para una persona (decisión
 * de Ishtar, 8/10/2026: "en embudo no debe haber nada para humano"). Antes el
 * recorrido terminaba en "Definir: ganado o perdido" y la charla sin
 * presupuesto en "Falta cotizar": 250 tareas vencidas acumuladas, 11 cerradas
 * en un mes. Hoy cada paso es una plantilla que manda el motor, un `esperar`
 * entre plantilla y plantilla, o un `cerrar` que el motor ejecuta solo
 * (`lib/seguimientos/cierre.ts`). `cotizar` sigue existiendo como INFORMACIÓN
 * en la tarjeta (nunca es "para hoy"): cotizar es trabajo de venta, no del embudo.
 *
 * El envío de una plantilla —del motor o de una persona desde el buzón— deja
 * la etiqueta del escalón en el chat (ver registrar-seguimiento.ts), y eso es
 * lo que mueve la tarjeta. Antes avanzaban solo por el reloj y todas decían
 * "Sin contactar".
 *
 * Los plazos son los de siempre (48h / 4 días / 15 días), definidos en
 * leads-pipeline.ts; acá solo se les asigna la plantilla y la etiqueta. La
 * MISMA cadencia vale con presupuesto (reloj desde el presupuesto) y sin
 * presupuesto (reloj desde el alta): antes la charla frenada recibía un solo
 * toque y después quedaba para una persona.
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
    // El último intento antes de cerrar (8/10/2026). No es un escalón del
    // clasificador: no mueve de columna, solo marca que ya se intentó.
    retomar_conversacion: 'SEGUIMIENTO_RETOME',
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
    retomar_conversacion: 'Retomar la conversación (último intento)',
};

export type TipoDeAccion =
    /** Todavía no hay presupuesto. Solo informa en la tarjeta: nunca es "para hoy". */
    | 'cotizar'
    /** Hay una plantilla aprobada para mandar hoy. */
    | 'plantilla'
    /** Se hizo todo el recorrido (o se venció la ventana) sin venta: el motor lo cierra como perdido. */
    | 'cerrar'
    /** Está al día; el próximo toque vence más adelante. */
    | 'esperar';

/**
 * Después del último toque (el del descuento), cuántos días de silencio antes
 * de cerrar como perdido. Es la "ventana de respuesta" al último mensaje.
 */
export const CIERRE_TRAS_ULTIMO_TOQUE_DIAS = 7;

/**
 * Más viejo que esto no se cierra solo: ya es otra época y marcar perdidos
 * cientos de presupuestos de hace meses en un tick cambiaría los números del
 * historial sin que nadie lo haya pedido. Esos quedan como estaban (listados
 * en Frío, sin acción). Es el mismo horizonte que la campaña de reflote.
 */
export const DIAS_MAX_CIERRE_AUTOMATICO = 120;

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
    /**
     * De classifyLead: hasta qué toque está cubierto (null = ninguno). Decide
     * CUÁL plantilla toca: la del primer escalón sin cubrir, no la de la
     * antigüedad. Un lead de 20 días sin ningún toque recibe el primero.
     */
    cubiertoHasta?: 'seguimiento1' | 'seguimiento2' | 'seguimiento10dias' | null;
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
    /** Cuándo salió el último seguimiento (`WhatsAppChat.lastFollowUpAt`). Decide cuándo cerrar tras el último toque. */
    ultimoToqueAt?: Date | null;
    now: number;
}

type Escalon = keyof typeof PLANTILLA_POR_ESCALON;
const ORDEN: Escalon[] = ['seguimiento1', 'seguimiento2', 'seguimiento10dias'];

/** Hasta qué escalón cubren las etiquetas del chat (sin mirar mensajes humanos: es para el camino SIN presupuesto). */
function cubiertoPorEtiquetas(chatLabels: string[]): Escalon | null {
    const l = chatLabels.map(x => x.toUpperCase());
    if (l.includes('SEGUIMIENTO_DIA_15')) return 'seguimiento10dias';
    if (l.includes('SEGUIMIENTO_DIA_4')) return 'seguimiento2';
    if (l.includes('SEGUIMIENTO_DIA_1')) return 'seguimiento1';
    return null;
}

function diasDesde(fecha: Date, now: number): number {
    return Math.floor((now - fecha.getTime()) / (24 * HORA_MS));
}

/**
 * El siguiente paso para un lead. Determinista: misma entrada, misma salida,
 * así el tablero, el motor y el resumen diario cuentan lo mismo.
 *
 * Casos (entrada → acción):
 * - Sin presupuesto, alta hace 1 día                         → cotizar (informa, no vence)
 * - Sin presupuesto, con chat, 3 días, sin DIA_1, sin receta → plantilla seguimiento_lentes_sin_receta (vencida)
 * - Sin presupuesto, con chat, 3 días, sin DIA_1, con receta → plantilla seguimiento_lentes_con_receta (vencida)
 * - Sin presupuesto, con chat, 3 días, ya con DIA_1          → esperar (vence a los 4 días)
 * - Sin presupuesto, con chat, 6 días, solo DIA_1            → plantilla invitacion_local_v4 (vencida)
 * - Sin presupuesto, con chat, 20 días, DIA_4                → plantilla ultimo_seguimiento (vencida)
 * - Sin presupuesto, DIA_15 hace 8 días                      → cerrar (vencida)
 * - Sin presupuesto, sin chat, 40 días                       → cerrar (vencida)
 * - Presupuesto de hace 10h                                  → esperar (vence a las 48h)
 * - Presupuesto de hace 3 días, nadie escribió               → plantilla seguimiento_presupuesto (vencida)
 * - Presupuesto de hace 3 días, DIA_1 enviado                → esperar (vence a los 4 días)
 * - Presupuesto de hace 6 días, solo DIA_1                   → plantilla invitacion_local_v4 (vencida)
 * - Presupuesto de hace 6 días, solo DIA_1, YA VINO          → esperar al día 15 (no se lo invita al local)
 * - Presupuesto de hace 20 días, DIA_4 enviado               → plantilla ultimo_seguimiento (vencida)
 * - Presupuesto de hace 20 días, DIA_15 hace 2 días          → esperar (cierra a los 7 días del último toque)
 * - Presupuesto de hace 20 días, DIA_15 hace 8 días          → cerrar (vencida)
 * - Presupuesto de hace 45 días, sin retome                  → plantilla retomar_conversacion (último intento)
 * - Presupuesto de hace 45 días, retome hace 2 días          → esperar
 * - Presupuesto de hace 45 días, retome hace 8 días          → cerrar (vencida)
 * - Presupuesto de hace 200 días                             → esperar "fuera del embudo" (no se toca)
 */
export function proximaAccion(e: EntradaProximaAccion): ProximaAccion {
    const ref = e.quoteCreatedAt ?? e.createdAt;
    const dias = diasDesde(ref, e.now);
    const vence = (h: number) => new Date(ref.getTime() + h * HORA_MS).toISOString();
    const queEs = e.quoteCreatedAt ? 'Frío' : 'Sin presupuesto';

    // Más viejo que el horizonte: no se le manda nada ni se lo cierra solo.
    if (dias > DIAS_MAX_CIERRE_AUTOMATICO) {
        return { tipo: 'esperar', etiqueta: `${queEs} hace ${dias} días: fuera del embudo`, venceEn: null, vencida: false };
    }

    // Fuera de la ventana sin venta. Antes de darlo por perdido se intenta UNA
    // vez más (Ishtar, 8/10/2026: "obvio que quiero intentar cerrarlos"): el
    // mensaje de retome con botones; si en 7 días no contesta, se cierra.
    if (dias > VENTANA_EMBUDO_DIAS) {
        const yaIntentado = e.chatLabels.some(l => l.toUpperCase() === ETIQUETA_POR_PLANTILLA.retomar_conversacion);
        if (!yaIntentado && e.tieneChat) {
            return { tipo: 'plantilla', plantilla: 'retomar_conversacion', etiqueta: `Hoy: ${NOMBRE_CORTO_PLANTILLA.retomar_conversacion} (${queEs.toLowerCase()} hace ${dias} días)`, venceEn: vence(VENTANA_EMBUDO_DIAS * 24), vencida: true };
        }
        const desde = e.ultimoToqueAt ? e.ultimoToqueAt.getTime() : ref.getTime() + VENTANA_EMBUDO_DIAS * 24 * HORA_MS;
        const cierraEn = desde + CIERRE_TRAS_ULTIMO_TOQUE_DIAS * 24 * HORA_MS;
        if (e.now < cierraEn) {
            const faltan = Math.max(1, Math.ceil((cierraEn - e.now) / (24 * HORA_MS)));
            return { tipo: 'esperar', etiqueta: `Último intento hecho · se cierra en ${faltan} día${faltan === 1 ? '' : 's'} si no responde`, venceEn: new Date(cierraEn).toISOString(), vencida: false };
        }
        return { tipo: 'cerrar', etiqueta: `${queEs} hace ${dias} días sin respuesta: se cierra como perdido`, venceEn: new Date(cierraEn).toISOString(), vencida: true };
    }

    // ¿Hasta qué toque está cubierto? Con presupuesto lo dice classifyLead
    // (etiquetas + mensajes humanos); sin presupuesto, las etiquetas del chat.
    const cubierto: Escalon | null = e.quoteCreatedAt ? (e.cubiertoHasta ?? null) : cubiertoPorEtiquetas(e.chatLabels);

    // Último toque hecho: se espera la respuesta unos días y se cierra.
    if (cubierto === 'seguimiento10dias') {
        const desde = e.ultimoToqueAt ? e.ultimoToqueAt.getTime() : ref.getTime() + FRIO_HOURS * HORA_MS;
        const cierraEn = desde + CIERRE_TRAS_ULTIMO_TOQUE_DIAS * 24 * HORA_MS;
        if (e.now >= cierraEn) {
            return { tipo: 'cerrar', etiqueta: `Sin respuesta al último toque: se cierra como perdido`, venceEn: new Date(cierraEn).toISOString(), vencida: true };
        }
        const faltan = Math.max(1, Math.ceil((cierraEn - e.now) / (24 * HORA_MS)));
        return { tipo: 'esperar', etiqueta: `Último toque hecho · se cierra en ${faltan} día${faltan === 1 ? '' : 's'} si no responde`, venceEn: new Date(cierraEn).toISOString(), vencida: false };
    }

    // El primer escalón sin cubrir, en orden (¿viste el presupuesto? → vení al
    // local → último), aunque el lead llegue atrasado. Entre uno y otro, la
    // compuerta de 48 h del motor pone la distancia.
    const siguiente: Escalon = ORDEN[(cubierto ? ORDEN.indexOf(cubierto) : -1) + 1];
    const horas = VENCE_A_LAS_HORAS[siguiente];
    const faltanDias = Math.max(0, Math.ceil((ref.getTime() + horas * HORA_MS - e.now) / (24 * HORA_MS)));

    if (e.now - ref.getTime() <= horas * HORA_MS) {
        // Todavía no vence el próximo toque.
        if (!e.quoteCreatedAt && !cubierto) {
            // Recién llegó y nadie cotizó: la tarjeta lo dice, pero no es una tarea del embudo.
            if (e.borradorSinEnviar) {
                const d = e.borradorSinEnviar;
                const fecha = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
                return { tipo: 'cotizar', etiqueta: `Presupuesto armado el ${fecha} y nunca enviado`, venceEn: vence(horas), vencida: false };
            }
            return { tipo: 'cotizar', etiqueta: 'Falta cotizar', venceEn: vence(horas), vencida: false };
        }
        return {
            tipo: 'esperar',
            etiqueta: faltanDias === 0 ? 'Próximo toque: hoy' : `Próximo toque en ${faltanDias} día${faltanDias === 1 ? '' : 's'}`,
            venceEn: vence(horas),
            vencida: false,
        };
    }

    // Sin chat no hay a dónde mandar: espera a cerrarse al día 30.
    if (!e.tieneChat) {
        return { tipo: 'esperar', etiqueta: `Sin chat de WhatsApp · se cierra al día ${VENTANA_EMBUDO_DIAS}`, venceEn: vence(VENTANA_EMBUDO_DIAS * 24), vencida: false };
    }

    // Ya vino al local: la invitación no tiene sentido y se lee como que nadie
    // está mirando. Se saltea ese toque — no se reemplaza por otro mensaje:
    // espera al último seguimiento, que sigue aplicando.
    if (siguiente === 'seguimiento2' && e.visitoElLocal) {
        const faltan = Math.max(0, Math.ceil((ref.getTime() + FRIO_HOURS * HORA_MS - e.now) / (24 * HORA_MS)));
        if (faltan > 0) {
            return { tipo: 'esperar', etiqueta: `Ya vino al local · próximo toque en ${faltan} día${faltan === 1 ? '' : 's'}`, venceEn: vence(FRIO_HOURS), vencida: false };
        }
        const plantilla = PLANTILLA_POR_ESCALON.seguimiento10dias;
        return { tipo: 'plantilla', plantilla, etiqueta: `Hoy: ${NOMBRE_CORTO_PLANTILLA[plantilla]}`, venceEn: vence(FRIO_HOURS), vencida: true };
    }

    // Primer toque sin presupuesto: dos plantillas para la misma etapa. A quien
    // ya mandó la receta no tiene sentido pedirle que la mande (7/9/2026).
    const plantilla: TemplateName = !e.quoteCreatedAt && siguiente === 'seguimiento1'
        ? (e.hasPrescription ? 'seguimiento_lentes_con_receta' : 'seguimiento_lentes_sin_receta')
        : PLANTILLA_POR_ESCALON[siguiente];
    const sufijo = e.quoteCreatedAt ? '' : ` (${dias} días sin presupuesto)`;
    return { tipo: 'plantilla', plantilla, etiqueta: `Hoy: ${NOMBRE_CORTO_PLANTILLA[plantilla]}${sufijo}`, venceEn: vence(horas), vencida: true };
}

/**
 * Orden para listar "lo de hoy": primero lo más atrasado. Excepción: los
 * últimos intentos (`retomar_conversacion`) van DESPUÉS de los toques de la
 * cadencia y, entre ellos, el más NUEVO primero: un lead de 35 días convierte
 * más que uno de 110, y con 573 atrasados el primer día (8/10/2026) el cupo
 * decide quién recibe el mensaje hoy y quién la semana que viene.
 */
export function ordenarPorUrgencia<T extends { proximaAccion: ProximaAccion; stage?: PipelineStageKey }>(items: T[]): T[] {
    const esRetome = (x: T) => x.proximaAccion.tipo === 'plantilla' && x.proximaAccion.plantilla === 'retomar_conversacion';
    return [...items].sort((a, b) => {
        if (a.proximaAccion.vencida !== b.proximaAccion.vencida) return a.proximaAccion.vencida ? -1 : 1;
        if (esRetome(a) !== esRetome(b)) return esRetome(a) ? 1 : -1;
        if (esRetome(a)) return (b.proximaAccion.venceEn || '').localeCompare(a.proximaAccion.venceEn || '');
        const sa = a.stage ? STAGE_ORDER[a.stage] : 0;
        const sb = b.stage ? STAGE_ORDER[b.stage] : 0;
        if (sa !== sb) return sb - sa;
        return (a.proximaAccion.venceEn || '').localeCompare(b.proximaAccion.venceEn || '');
    });
}
