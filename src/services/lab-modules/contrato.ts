import type { InvoiceRef } from '../lab-recon/types';

/**
 * MÓDULOS DE LABORATORIO: un módulo por laboratorio, todos con la misma forma.
 *
 * Nació el 30/9/2026 con Vitolen (Hoya + Pentax). Optovisión y Grupo Óptico
 * siguen con sus integraciones de siempre (lab-recon/imap.ts, smartlab.service,
 * lab-providers/grupo-optico.provider.ts) y se migran acá cuando convenga: el
 * marco no las toca.
 *
 * Qué sabe hacer un módulo (cada capacidad es opcional y se declara):
 *   · seguimiento: leer los pedidos del portal, reflejarlos en LabPortalOrder y
 *     mover el estado de la venta (IN_PROGRESS / FINISHED) — UNA sola entrada
 *     al portal por corrida, nada de buscar pedido por pedido.
 *   · costos: leer comprobantes y registrarlos en el cruce (upsertEntry).
 *   · carga: armar el pedido desde la venta y cargarlo en el portal. El OK
 *     final lo da SIEMPRE una persona (regla de Ishtar, 30/9/2026): el robot
 *     llena, saca la captura y frena; la persona aprueba; el robot confirma.
 */

export type EstadoEnPortal =
    | 'INGRESADO'    // el portal lo recibió, todavía sin avance
    | 'EN_PROCESO'   // en fabricación
    | 'TERMINADO'    // listo en el laboratorio
    | 'DESPACHADO'   // salió hacia la óptica
    | 'ANULADO'
    | 'DESCONOCIDO'; // el portal mostró un estado que el módulo no conoce

/** Un pedido tal como lo ve el portal, ya normalizado por el módulo. */
export interface PedidoEnPortal {
    portalNumber: string;
    /** "Nro de Caso Interno" u equivalente: el nº de venta del CRM si el vendedor lo cargó. */
    internalRef?: string | null;
    /** 1 o 2 en una promo de segundo par; null si el portal no lo distingue. */
    pair?: number | null;
    statusRaw: string;
    status: EstadoEnPortal;
    cliente?: string | null;
    enteredAt?: Date | null;
    estimatedAt?: Date | null;
    finishedAt?: Date | null;
    dispatchedAt?: Date | null;
    invoices?: InvoiceRef[];
    raw?: unknown;
}

export interface ResultadoSeguimiento {
    vistos: number;
    nuevos: number;
    cambiados: number;
    vinculados: number;
    avanzados: number;
    terminados: number;
    /** Ventas SENT del lab sin pedido en el portal tras el plazo de gracia. */
    sinPedidoEnPortal: { orderId: string; cliente: string; enviadaHace: number }[];
    /** Pedidos con fecha estimada vencida y sin terminar. */
    atrasados: { portalNumber: string; cliente: string | null; estimatedAt: Date; diasDeAtraso: number }[];
    skipped?: boolean;
    reason?: string;
}

export interface OpcionesCorrida {
    /** Ventana corta (pase rápido) en días; sin valor = pasada completa. */
    sinceDays?: number;
    /** Esperar el turno del portal si lo tiene un pase corto (la diaria). */
    esperarTurno?: boolean;
}

export interface LabModule {
    /** Clave del cruce y de las claves de SystemSetting: 'VITOLEN'. */
    clave: string;
    /** Nombre legible para pantallas y avisos. */
    nombre: string;
    /** Reconoce el `Product.laboratory` de sus cristales (igual que LAB_ITEM_PATTERNS). */
    patronProducto: RegExp;
    capacidades: { seguimiento: boolean; costos: boolean; carga: boolean };
    /**
     * Mínimo de minutos entre dos pases rápidos. El tick llama cada 10 min; un
     * portal con pocos pedidos no necesita 70 logins por día. Sin valor = cada tick.
     */
    cadenciaRapidaMin?: number;
    seguirPedidos(opts?: OpcionesCorrida): Promise<ResultadoSeguimiento>;
    recolectarCostos(opts?: OpcionesCorrida): Promise<Record<string, unknown>>;
}

/** Claves de SystemSetting del marco, todas con el mismo prefijo. */
export const claveDeModulo = (lab: string, sufijo: string) => `lab-modulo:${lab}:${sufijo}`;
