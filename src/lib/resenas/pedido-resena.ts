// ────────────────────────────────────────────────────────────────────────────
// PEDIDO DE RESEÑA EN GOOGLE — reglas puras (sin base, sin red).
//
// Lo usan el CRM (tres pantallas arman el mismo mensaje), el robot del 2º
// pedido (`review-request.service.ts`) y `npm run check:resena-segundo-pedido`.
//
// REGLA DE FONDO (Ishtar, 10/8/2026): el pedido de reseña NUNCA lo manda un
// bot ni un cron. Lo pide una persona, porque el sistema no sabe si el
// cliente está enojado (demora, post-venta) y una reseña mala no se borra.
// El robot del 2º pedido (Ishtar, 16/10/2026) solo VUELVE A PONER LA TAREA
// delante del vendedor; el mensaje lo manda el vendedor desde el CRM.
// ────────────────────────────────────────────────────────────────────────────

export const LINK_RESENA_GOOGLE = 'https://g.page/r/CcVls8v7ic_NEBM/review';

export const TIPO_TAREA_RESENA = 'REVIEW_REQUEST';

/** Descripción del 1º pedido (la arma order.service al ENTREGAR). */
export const PREFIJO_PRIMER_PEDIDO = 'Solicitar comentario a';
/** Descripción del 2º pedido. La UI reconoce la tarea por este prefijo. */
export const PREFIJO_SEGUNDO_PEDIDO = '2º pedido de comentario a';

/** Días desde que el vendedor cerró el 1º pedido hasta volver a mostrarlo. */
export const DIAS_PARA_SEGUNDO_PEDIDO = 7;
/**
 * Hasta cuántos días hacia atrás mira el robot. Sin techo, la primera corrida
 * le tiraría al vendedor los ~450 pedidos cerrados desde abril; y volver a
 * pedirle una reseña a alguien que retiró hace tres meses ya no suma.
 */
export const DIAS_MAXIMOS_SEGUNDO_PEDIDO = 30;
/**
 * Tope de 2º pedidos que el robot crea por día. El dry-run contra producción
 * del 16/10/2026 daba 84 el primer día (todo el atraso de un mes junto): eso
 * tapa el panel del vendedor. Se crean primero los más recientes (los que la
 * venta tiene más fresca); los que quedan esperan al día siguiente o vencen a
 * los 30 días.
 */
export const MAX_SEGUNDOS_PEDIDOS_POR_DIA = 15;
/** Ventana en la que un reclamo en la ficha frena el 2º pedido. */
export const DIAS_SIN_RECLAMOS = 30;

/** Creador de la tarea: el mismo que el 1º pedido. NO está en la lista blanca
 *  de envío automático de wa-service (AUTO_SENDABLE_TASK_CREATORS). */
export const CREADOR_SEGUNDO_PEDIDO = 'Sistema';

export const descripcionSegundoPedido = (nombre: string) =>
    `${PREFIJO_SEGUNDO_PEDIDO} ${String(nombre || 'cliente').trim()}`;

export const esSegundoPedido = (descripcion?: string | null) =>
    String(descripcion || '').startsWith(PREFIJO_SEGUNDO_PEDIDO);

export const esTareaDeResena = (t: { type?: string | null; description?: string | null }) =>
    t.type === TIPO_TAREA_RESENA
    || String(t.description || '').startsWith(PREFIJO_PRIMER_PEDIDO)
    || esSegundoPedido(t.description);

/**
 * Texto de una nota que indica un cliente disconforme. Conservador: ante la
 * duda, NO se le vuelve a pedir la reseña (el costo de un falso positivo es
 * una reseña menos; el de un falso negativo, una estrella).
 */
const PATRON_RECLAMO = /(reclam|queja|enojad|disconform|insatisfech|mala atenci|mal servicio|devoluci|reintegr|post-?venta|no (?:me )?(?:veo|ve bien|sirve|anda)|dolor de cabeza|mare[oa]|roto|rotura|defectuos)/i;

/** Tipos de Interaction que son ruido propio (lo que escribimos nosotros o el
 *  sistema), no la voz del cliente: no se leen para buscar reclamos. */
export const TIPOS_INTERACCION_SIN_RECLAMO = ['SISTEMA', 'ERROR', 'BUDGET_SENT', 'FOLLOWUP', 'FOLLOW_UP', 'TASK_COMPLETED', 'INVOICE', 'SUMMARY'];

export const esTextoDeReclamo = (texto?: string | null) => PATRON_RECLAMO.test(String(texto || ''));

/** Estados de PostSaleCase que ya están cerrados (no frenan el 2º pedido). */
export const ESTADOS_POSVENTA_CERRADOS = ['DELIVERED', 'CANCELLED', 'CLOSED']; // hoy en prod: SENT · IN_PROGRESS · READY · DELIVERED

export interface CandidatoSegundoPedido {
    /** El 1º pedido ya cerrado. */
    tarea: { id: string; status: string; completedAt: Date | null; completedBy: string | null; description: string; reminderOfTaskId?: string | null };
    ahora: Date;
    /** Client.googleReviewAt: ya dejó la reseña. */
    yaComento: boolean;
    /** Ya existe un 2º pedido para esta tarea (o cualquier pedido abierto del cliente). */
    yaTieneSegundoPedido: boolean;
    tienePedidoDeResenaAbierto: boolean;
    tienePosventaAbierta: boolean;
    tieneSaldo: boolean;
    /** Última venta del cliente: ENTREGADA y no borrada. */
    ultimaVentaEntregada: boolean;
    /** Otra venta del cliente sigue en curso (en el lab / lista para retirar). */
    tieneVentaEnCurso: boolean;
    tieneReclamoReciente: boolean;
    tieneTelefono: boolean;
}

export type DecisionSegundoPedido = { crear: true } | { crear: false; motivo: string };

const DIA_MS = 24 * 3600 * 1000;

/**
 * Decide si a ESTE 1º pedido le corresponde un 2º. Todas las exclusiones
 * viven acá para que el check las fije sin base.
 */
export function decidirSegundoPedido(c: CandidatoSegundoPedido): DecisionSegundoPedido {
    const t = c.tarea;
    if (t.reminderOfTaskId || esSegundoPedido(t.description)) return { crear: false, motivo: 'ya es un 2º pedido (nunca hay 3º)' };
    if (t.status !== 'COMPLETED') return { crear: false, motivo: 'el 1º pedido no se cerró' };
    // El 1º pedido lo tiene que haber cerrado una PERSONA: si lo cerró un
    // proceso (o es de antes de que se firmara), nadie sabe si se le pidió, y
    // un "te escribí hace unos días" sería mentira.
    if (!t.completedAt || !t.completedBy || /^(sistema|bot)\b/i.test(t.completedBy.trim())) {
        return { crear: false, motivo: 'el 1º pedido no lo cerró una persona' };
    }
    const dias = (c.ahora.getTime() - t.completedAt.getTime()) / DIA_MS;
    if (dias < DIAS_PARA_SEGUNDO_PEDIDO) return { crear: false, motivo: `faltan días (${Math.floor(dias)} de ${DIAS_PARA_SEGUNDO_PEDIDO})` };
    if (dias > DIAS_MAXIMOS_SEGUNDO_PEDIDO) return { crear: false, motivo: `muy viejo (${Math.floor(dias)} días)` };
    if (c.yaComento) return { crear: false, motivo: 'ya comentó' };
    if (c.yaTieneSegundoPedido) return { crear: false, motivo: 'ya tuvo su 2º pedido' };
    if (c.tienePedidoDeResenaAbierto) return { crear: false, motivo: 'ya tiene un pedido de reseña abierto' };
    if (!c.tieneTelefono) return { crear: false, motivo: 'sin teléfono' };
    if (c.tienePosventaAbierta) return { crear: false, motivo: 'post-venta abierta' };
    if (c.tieneSaldo) return { crear: false, motivo: 'tiene saldo pendiente' };
    if (!c.ultimaVentaEntregada) return { crear: false, motivo: 'su última venta no está entregada' };
    if (c.tieneVentaEnCurso) return { crear: false, motivo: 'tiene otra venta en curso' };
    if (c.tieneReclamoReciente) return { crear: false, motivo: `reclamo en los últimos ${DIAS_SIN_RECLAMOS} días` };
    return { crear: true };
}

const PRODUCTOS_GENERICOS = 'anteojos o cristales (por ejemplo: multifocales, lentes de sol, cristales Crizal, etc.)';

/**
 * El mensaje prearmado que el VENDEDOR manda desde el CRM. Una sola
 * redacción: antes estaba copiada en tres pantallas.
 */
export function mensajePedidoResena(opts: { nombre?: string | null; productos?: string | null; segundo?: boolean }): string {
    const nombre = String(opts.nombre || '').trim().split(' ')[0] || 'Hola';
    const productos = (opts.productos || '').trim() || PRODUCTOS_GENERICOS;
    if (opts.segundo) {
        return `Hola ${nombre}! ¿Cómo te estás llevando con tus ${productos}? 😊\n\nHace unos días te pedí si nos podías dejar una reseña en Google. Si todavía no tuviste un ratito, te dejo el link de nuevo, sin apuro 🙏\n\n👉 ${LINK_RESENA_GOOGLE}\n\nY si ya la dejaste, ¡mil gracias! 🤍`;
    }
    return `Hola ${nombre}, Te escribo para pedirte un favor enorme 🙏\n\nMe dejarias una reseña en Google? me ayuda muchísimo, si podés compartir cómo fue tu experiencia y qué fue lo que más te gustó de nuestra atención.\n\nSi podés, contá en la reseña qué te parecieron tus ${productos}, ¡nos ayuda un montón! 🙌\n\n👉 ${LINK_RESENA_GOOGLE}\n\n\nMe suma muchísimo para seguir creciendo! Espero tu comentario 🤍✨🫶`;
}

/** Nombres de la última venta, para el mensaje (cliente: datos de /api/contacts/:id). */
export function productosDeUltimaVenta(clientData: any): string | null {
    const venta = clientData?.orders?.find((o: any) => o.orderType === 'SALE' && !o.isDeleted);
    const nombres = (venta?.items || []).map((it: any) => it.product?.name || it.productNameSnapshot).filter(Boolean);
    return nombres.length ? nombres.join(', ') : null;
}

// ── Cruce best-effort con las reseñas que devuelve Google Places ─────────────
// Places devuelve solo 5 reseñas, así que esto NUNCA dice "no comentó": solo
// marca a quien aparece. El nombre en Google es el que la persona eligió; se
// exige nombre Y apellido completos (tokens de ≥3 letras) y que el cliente sea
// el ÚNICO candidato que matchea, para no marcar a un homónimo.

const normalizar = (s: string) => s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(t => t.length >= 3);

export function nombreCoincide(nombreGoogle: string, nombreCliente: string): boolean {
    const g = normalizar(nombreGoogle);
    const c = new Set(normalizar(nombreCliente));
    if (g.length < 2) return false;
    return g.every(t => c.has(t));
}

/** Devuelve, por cada reseña, el ÚNICO cliente que matchea (o nada). */
export function cruzarResenasConClientes(
    autores: string[],
    clientes: { id: string; name: string }[],
): { autor: string; clientId: string }[] {
    const out: { autor: string; clientId: string }[] = [];
    for (const autor of autores) {
        const m = clientes.filter(c => nombreCoincide(autor, c.name));
        if (m.length === 1) out.push({ autor, clientId: m[0].id });
    }
    return out;
}
