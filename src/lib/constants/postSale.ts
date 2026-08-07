// Tipos de caso de post-venta (para clasificar y hacer reportes).
// Editar esta lista para agregar / sacar / renombrar tipos.
export const POST_SALE_CASE_TYPES = [
    'Cambio de receta',
    'Error de medición y centrado',
    'Garantía',
    'Falla de laboratorio',
    'Error de armado / montaje',
    'Rayado / tratamiento',
    'Error administrativo / carga',
    'Reclamo / insatisfacción',
    'Otro',
] as const;

export type PostSaleCaseType = typeof POST_SALE_CASE_TYPES[number];

// Atribución de responsabilidad: ¿de quién fue el error?
// Es el dato que mira el circuito de caja: SOLO 'Óptica' descuenta de la caja de
// una persona; todo lo demás lo absorbe la óptica (caja del administrador).
export const POST_SALE_FAULTS = ['Laboratorio', 'Óptica', 'Cliente', 'Médico'] as const;

// ── Responsable del caso ────────────────────────────────────────────────────
// Un solo campo contesta "¿de quién fue?". Antes eran dos (Atribución +
// Responsable) que en la práctica se contestaban igual y se contradecían.
// Las opciones son: cada persona de la óptica (salen solas de los usuarios del
// sistema, no hay lista escrita a mano) más las causas que no son de nadie del
// equipo. La atribución (`fault`) se deriva de lo elegido, no se carga aparte.
export const POST_SALE_RESPONSIBLE_CAUSES = ['Error en receta', 'Error de laboratorio'] as const;

/** A qué atribución equivale cada causa que no es una persona de la óptica. */
const CAUSE_TO_FAULT: Record<string, string> = {
    'Error en receta': 'Médico',
    'Error de laboratorio': 'Laboratorio',
};

/** Prefijo del value del select cuando el responsable es una persona del equipo. */
const USER_PREFIX = 'user:';

export interface PostSaleUser { id: string; name: string; role?: string }

/** Los tres campos que define el select de responsable. */
export interface PostSaleResponsibility {
    responsible: string | null;
    fault: string | null;
    faultUserId: string | null;
}

/** Value del <option> para una persona del equipo. */
export function responsibleUserValue(userId: string): string {
    return `${USER_PREFIX}${userId}`;
}

/**
 * Traduce lo elegido en el select a los tres campos que guarda el caso.
 * Una persona del equipo ⇒ culpa de la óptica y caja de esa persona; una causa
 * externa ⇒ su atribución y sin caja personal (lo absorbe la óptica).
 */
export function parseResponsibleOption(value: string, users: PostSaleUser[]): PostSaleResponsibility {
    if (!value) return { responsible: null, fault: null, faultUserId: null };
    if (value.startsWith(USER_PREFIX)) {
        const id = value.slice(USER_PREFIX.length);
        const user = users.find(u => u.id === id);
        return { responsible: user?.name || null, fault: 'Óptica', faultUserId: id };
    }
    return { responsible: value, fault: CAUSE_TO_FAULT[value] || null, faultUserId: null };
}

/**
 * El camino inverso: qué opción del select representa a un caso ya guardado.
 * Devuelve '' cuando lo guardado no es ninguna de las opciones actuales — los
 * casos viejos traen texto libre ("Laboratorio", "Grupo Óptico"), que el
 * formulario ofrece aparte para no borrarlo sin querer.
 */
export function responsibleOptionOf(r: Partial<PostSaleResponsibility>, users: PostSaleUser[]): string {
    if (r.fault === 'Óptica' && r.faultUserId && users.some(u => u.id === r.faultUserId)) {
        return responsibleUserValue(r.faultUserId);
    }
    const responsible = r.responsible || '';
    if ((POST_SALE_RESPONSIBLE_CAUSES as readonly string[]).includes(responsible)) return responsible;
    const byName = users.find(u => u.name === responsible);
    if (byName) return responsibleUserValue(byName.id);
    return '';
}

/**
 * A qué caja impacta el costo del caso, con el mismo criterio que aplica
 * `/api/post-sale/[id]/cost` al imputar: solo un error de la óptica con persona
 * cargada descuenta de esa caja; todo lo demás cae en la caja del administrador.
 * Se muestra ANTES de imputar para que no haya sorpresas al cerrar el caso.
 */
export function cajaDestino(
    r: Partial<PostSaleResponsibility>,
    users: PostSaleUser[],
    adminName?: string | null
): { label: string; loCubreLaOptica: boolean } {
    if (r.fault === 'Óptica' && r.faultUserId) {
        const user = users.find(u => u.id === r.faultUserId);
        if (user) return { label: `Caja de ${user.name}`, loCubreLaOptica: false };
    }
    return {
        label: adminName ? `Caja de ${adminName}` : 'Caja de la administración',
        loCubreLaOptica: true,
    };
}

// Cobertura del caso: ¿lo cubre la óptica o va con cargo al cliente?
export const POST_SALE_COVERAGE = ['Sin cargo', 'Con cargo'] as const;

// Color de badge por tipo (clases Tailwind). Fallback para tipos no listados.
export const POST_SALE_CASE_TYPE_STYLES: Record<string, string> = {
    'Cambio de receta': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/40',
    'Error de medición y centrado': 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/40',
    'Garantía': 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/40',
    'Falla de laboratorio': 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-900/40',
    'Error de armado / montaje': 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950/30 dark:text-fuchsia-400 dark:border-fuchsia-900/40',
    'Rayado / tratamiento': 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-900/40',
    'Error administrativo / carga': 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700',
    'Reclamo / insatisfacción': 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/30 dark:text-pink-400 dark:border-pink-900/40',
    'Otro': 'bg-stone-100 text-stone-600 border-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700',
};

export function caseTypeStyle(type?: string | null): string {
    if (!type) return POST_SALE_CASE_TYPE_STYLES['Otro'];
    return POST_SALE_CASE_TYPE_STYLES[type] || POST_SALE_CASE_TYPE_STYLES['Otro'];
}

// ── Pipeline del caso ───────────────────────────────────────────────────────
//
// El tablero mezcla a propósito DOS recorridos: dónde está el anteojo (físico) y
// dónde está la plata (económico). Se pueden mezclar porque el caso no se cierra
// hasta que las dos cosas terminaron.
//
// La parte económica NO es un estado que alguien arrastra: ya está en los datos.
// `costSource === 'LAB'` significa que el laboratorio facturó y cerró el costo
// real; `cashEntryId` significa que ya se descontó de una caja
// (ver /api/post-sale/[id]/cost). Si esas dos columnas fueran manuales, se
// desincronizarían de la caja el primer día. Por eso se DERIVAN: la última
// columna no se puede equivocar.
//
// Dos transiciones también son automáticas:
//  · cargar el nº de operación ⇒ el caso pasa a "En laboratorio" (si tiene número,
//    el laboratorio lo tomó: no tiene sentido pedir que además lo arrastren).
//  · descontar el costo de caja ⇒ el caso pasa a "Cerrado".

/** Estados que se guardan en la base y que una persona puede mover. */
export const POST_SALE_MOVABLE_STATUSES = ['SENT', 'IN_PROGRESS', 'READY', 'DELIVERED'] as const;

/** Columnas del tablero, en orden. La última es terminal y automática. */
export const POST_SALE_PIPELINE = [
    {
        key: 'SENT',
        label: 'Reportado',
        hint: 'El caso se abrió. Todavía no hay nº de operación.',
        borde: 'border-amber-400 dark:border-amber-700',
        fondo: 'bg-amber-500/10',
        texto: 'text-amber-800 dark:text-amber-400',
    },
    {
        key: 'IN_PROGRESS',
        label: 'En laboratorio',
        hint: 'Tiene nº de operación: el laboratorio lo tomó. Entra solo al cargar el número.',
        borde: 'border-blue-400 dark:border-blue-700',
        fondo: 'bg-blue-500/10',
        texto: 'text-blue-800 dark:text-blue-400',
    },
    {
        key: 'READY',
        label: 'Listo para retirar',
        hint: 'El laboratorio terminó. Antes esto eran dos columnas ("Finalizado" y "Listo") que en la práctica se usaban igual.',
        borde: 'border-emerald-400 dark:border-emerald-700',
        fondo: 'bg-emerald-500/10',
        texto: 'text-emerald-800 dark:text-emerald-400',
    },
    {
        key: 'DELIVERED',
        label: 'Entregado · a cobrar',
        hint: 'El cliente ya lo tiene y queda plata por descontar de una caja.',
        borde: 'border-orange-400 dark:border-orange-700',
        fondo: 'bg-orange-500/10',
        texto: 'text-orange-800 dark:text-orange-400',
    },
    {
        key: 'CLOSED',
        label: 'Cerrado',
        hint: 'Se descontó de caja, o no había nada que cobrar. Entra solo.',
        borde: 'border-stone-400 dark:border-stone-600',
        fondo: 'bg-stone-500/10',
        texto: 'text-stone-700 dark:text-stone-300',
    },
] as const;

export type PostSaleColumnKey = typeof POST_SALE_PIPELINE[number]['key'];

/** Lo mínimo que hace falta para ubicar un caso en el tablero. */
export interface PostSaleColumnInput {
    status?: string | null;
    cost?: number | null;
    cashEntryId?: string | null;
}

/**
 * En qué columna va el caso. Derivado, nunca almacenado:
 * - Ya descontado de caja ⇒ Cerrado.
 * - Entregado sin nada que cobrar ⇒ Cerrado (si no, un caso sin cargo se quedaba
 *   para siempre en "a cobrar" esperando algo que no iba a pasar).
 * - 'FINISHED' es un estado viejo: cae en "Listo para retirar" junto con 'READY'.
 */
export function postSaleColumn(c: PostSaleColumnInput): PostSaleColumnKey {
    if (c.cashEntryId) return 'CLOSED';
    const status = c.status || 'SENT';
    if (status === 'DELIVERED') return (c.cost ?? 0) > 0 ? 'DELIVERED' : 'CLOSED';
    if (status === 'READY' || status === 'FINISHED') return 'READY';
    if (status === 'IN_PROGRESS') return 'IN_PROGRESS';
    return 'SENT';
}

/** El caso terminó: no hay nada más que hacerle. */
export function postSaleCerrado(c: PostSaleColumnInput): boolean {
    return postSaleColumn(c) === 'CLOSED';
}

// Etiqueta legible del estado. 'FINISHED' se muestra ya fusionado con 'READY'.
export const POST_SALE_STATUS_LABELS: Record<string, string> = {
    'PENDING': 'Reportado',
    'SENT': 'Reportado',
    'IN_PROGRESS': 'En laboratorio',
    'FINISHED': 'Listo para retirar',
    'READY': 'Listo para retirar',
    'DELIVERED': 'Entregado · a cobrar',
    'CLOSED': 'Cerrado',
};

export function postSaleStatusLabel(status?: string | null): string {
    if (!status) return POST_SALE_STATUS_LABELS['SENT'];
    return POST_SALE_STATUS_LABELS[status] || status;
}

/** La etiqueta que corresponde mostrar en la ficha: la de la columna derivada. */
export function postSaleColumnLabel(c: PostSaleColumnInput): string {
    const key = postSaleColumn(c);
    return POST_SALE_PIPELINE.find(p => p.key === key)?.label || POST_SALE_STATUS_LABELS[key] || key;
}
