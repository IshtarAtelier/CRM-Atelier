import { uploadFile } from '../../../lib/storage';
import { conTurno } from '../portal/turno';

/**
 * LO QUE TODO ROBOT DE CARGA REPITE (19/10/2026): el turno obligatorio del
 * portal, las capturas en el storage y la cola de errores al confirmar.
 * Hasta acá vivía copiado en grupo-optico/borrador-portal.ts y
 * optovision/borrador-portal.ts; el texto de "qué le digo a la persona cuando
 * el confirmar falla" es la parte delicada (un "no se pudo cargar" invitaba a
 * cargar a mano = duplicado), así que va puro y con check.
 */

/** La aprobación ya no vale y en el portal NO hay pedido: se invalida sin mandar nada. */
export class AprobacionInvalidaError extends Error { constructor(motivo: string) { super(motivo); this.name = 'AprobacionInvalidaError'; } }
/** Ya estaba CARGADO cuando el robot entró (otro intento lo terminó): no se hace nada. */
export class YaCargadoError extends Error { constructor() { super('ya cargado'); this.name = 'YaCargadoError'; } }
/** Un nº adoptado (de la venta o del portal) no se pudo comprobar en el portal: no se crea otro. */
export class AdopcionNoVerificadaError extends Error { constructor(m: string) { super(m); this.name = 'AdopcionNoVerificadaError'; } }

export const ESPERA_TURNO_MS = 4 * 60_000;
/** Tras un envío sin respuesta, cuánto esperar antes de volver a crear (el portal puede guardarlo tarde). */
export const ESPERA_TRAS_ENVIO_INCIERTO_MS = 15 * 60_000;

/**
 * Corre la tarea con el turno del portal como pasada 'robot', esperando a
 * cualquier pasada en curso. Obligatorio: lo que crea o confirma en un portal
 * no corre sin turno (dos robots a la vez serían dos trabajos).
 */
export async function enElPortal<T>(lab: string, nombreLab: string, tarea: () => Promise<T>): Promise<T> {
    const r = await conTurno(lab, 'robot', tarea, { esperar: true, esperaMaxMs: ESPERA_TURNO_MS, obligatorio: true });
    if (r && typeof r === 'object' && 'skipped' in (r as any) && (r as any).skipped) {
        throw new Error(`El portal de ${nombreLab} está ocupado por otra pasada; volvé a intentar en unos minutos.`);
    }
    return r as T;
}

/** Captura o PDF del portal en el storage, bajo una clave que /api/storage/view trata como sensible (receta y datos del cliente: exige sesión). */
export async function guardarArchivoDelPortal(carpeta: string, borradorId: string, sufijo: string, bytes: Buffer, contentType: 'image/png' | 'application/pdf'): Promise<string> {
    const ext = contentType === 'application/pdf' ? 'pdf' : 'png';
    const key = await uploadFile(bytes, `lab-modulos/${carpeta}/${borradorId}-${sufijo}-${Date.now()}.${ext}`, contentType);
    return `/api/storage/view?key=${encodeURIComponent(key)}`;
}

/**
 * Qué le dice el borrador a la persona cuando confirmar falló y el borrador
 * sigue APROBADO. Si el pedido YA existe (falló lo de después), hay que
 * decirlo con todas las letras: "no se pudo cargar" invitaba a cargarlo a mano
 * = duplicado (auditoría de GO del 3/10/2026). Puro.
 */
export function textoDeFallaDeConfirmacion(o: { motivo: string; numeroCreado?: string | null; envioIncierto: boolean; adopcionNoVerificada: boolean; nombrePortal: string }): string {
    const motivo = o.motivo.replace(/\.+$/, '');
    if (o.adopcionNoVerificada) return `${motivo}.`;
    if (o.numeroCreado) return `El pedido YA está creado en el laboratorio con el nº ${o.numeroCreado}; falta anotarlo en la venta (${motivo}). Reintentar desde la ficha: NO se crea otro, solo se termina de anotar. No lo cargues a mano.`;
    if (o.envioIncierto) return `El envío a ${o.nombrePortal} quedó sin respuesta (${motivo}). Reintentar desde la ficha en unos minutos: el robot busca el pedido en el portal antes de crear otro. No lo cargues a mano.`;
    return `No se pudo cargar en ${o.nombrePortal}: ${motivo}. Reintentar desde la ficha (nunca se duplica: el robot busca el pedido antes de crearlo).`;
}
