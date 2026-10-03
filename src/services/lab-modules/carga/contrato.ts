import type { Actor } from '../../../lib/actor';

/**
 * LA CARGA ASISTIDA DE UN LABORATORIO, con la misma forma para todos.
 *
 * Las rutas (/api/lab-modulos/borradores) y la ficha no saben de Vitolen ni de
 * Grupo Óptico: le piden al registro la carga del laboratorio y llaman acá.
 * Sumar un laboratorio = implementar esto y registrarlo (carga/registro.ts).
 *
 * La regla de Ishtar vale para todos (30/9/2026): el robot prepara, una
 * persona revisa y aprueba, recién ahí el robot carga.
 */
export interface ResultadoPreparar {
    ok: boolean;
    /** El borrador (PREPARADO/EN_REVISION/ERROR) cuando se llegó a crear. */
    borrador?: unknown;
    borradorId?: string;
    error?: string;
    faltantes?: string[];
    avisos?: string[];
    /** HTTP sugerido para la ruta. */
    status: number;
}

export interface CargaAsistida {
    lab: string;
    nombre: string;
    robot: Actor;
    /** Qué pares de la venta se cargan en este lab y qué le falta a cada uno (para la ficha). */
    analizar(orderId: string): Promise<Record<string, unknown> | null>;
    /** Arma el pedido desde la venta, crea el borrador y hace que el robot lo deje para revisar. */
    preparar(orderId: string, pair: number, body: Record<string, unknown>, actor: Actor): Promise<ResultadoPreparar>;
    /** Después del OK humano: el robot carga en el portal. Reintentable. */
    confirmar(borradorId: string): Promise<unknown>;
    /** Después de un rechazo: lo que haya que deshacer en el portal (Vitolen cancela su borrador; Grupo Óptico, nada). */
    despuesDeRechazar(borradorId: string): Promise<unknown>;
    /** Cancelar en el portal un borrador que quedó colgado (solo los portales que tienen borrador). */
    cancelarEnPortal?(borradorId: string): Promise<{ cancelado: boolean; motivo?: string }>;
}
