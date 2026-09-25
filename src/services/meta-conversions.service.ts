import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import {
  AdsService,
  type ActionSource,
  type MatchData,
  type PurchaseOrderData,
} from './ads.service';

/**
 * Outbox de compras hacia Meta (Conversions API).
 *
 * REGLA (Ishtar, 25/9/2026): "el sistema tiene que informar SÍ O SÍ a Meta de
 * cada compra". Hasta ese día el envío era un fetch fire-and-forget: sin
 * registro, sin reintento, y la venta del local viajaba sin `event_id` y con la
 * fecha del PRESUPUESTO. Una caída de Meta, un token vencido (pasó el 10/9) o
 * un reinicio del contenedor a mitad del request perdían la compra sin que
 * nadie se enterara.
 *
 * Cómo funciona ahora:
 *  1. Toda compra se ANOTA primero en `MetaConversion` (PENDING) con el payload
 *     exacto, y recién después se intenta mandar. Si la base falla, se manda
 *     igual sin registro: mejor un envío sin rastro que ninguno.
 *  2. Si Meta no la acepta, queda FAILED con `nextAttemptAt` (backoff 10 min →
 *     6 h) y el cron `/api/cron/meta-conversiones` insiste cada 10 minutos
 *     hasta que entre o venza la ventana de 7 días que impone Meta (EXPIRED).
 *  3. `event_id = order.id` en TODOS los casos: reintentar nunca duplica, Meta
 *     descarta el repetido. Es lo que hace seguro insistir.
 *  4. Lo que no llegó AVISA por mail una sola vez por fila (EXPIRED, REJECTED,
 *     o FAILED con 3 intentos): los crons avisan, no autocorrigen.
 *
 * Dos instancias corren el cron a la vez (ver crons-duplicados): el reclamo por
 * fila es un UPDATE condicional atómico, así que una compra la manda una sola.
 *
 * El almacén es intercambiable (`usarAlmacen`) SOLO para que `check:capi`
 * verifique estas garantías sin base ni red.
 */

export type EstadoConversion = 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | 'REJECTED' | 'EXPIRED';

export interface FilaConversion {
  id: string;
  orderId: string;
  actionSource: ActionSource;
  eventTime: Date;
  value: number;
  status: EstadoConversion;
  attempts: number;
  lastError: string | null;
  sentAt: Date | null;
  nextAttemptAt: Date | null;
  alertedAt: Date | null;
  payload: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlmacenConversiones {
  /** Crea la fila PENDING. Si ya existe (misma orden y fuente) devuelve la existente sin tocarla. */
  registrar(input: {
    orderId: string;
    actionSource: ActionSource;
    eventTime: Date;
    value: number;
    payload: Record<string, unknown>;
  }): Promise<FilaConversion>;
  /**
   * Pasa la fila a SENDING de forma ATÓMICA solo si sigue en uno de `desde`
   * (y, si se pide, si no fue tocada desde `noTocadaDesde`). `null` = otra
   * corrida ya la tomó.
   */
  reclamar(id: string, desde: EstadoConversion[], noTocadaDesde?: Date): Promise<FilaConversion | null>;
  resolver(
    id: string,
    data: Partial<Pick<FilaConversion, 'status' | 'attempts' | 'lastError' | 'sentAt' | 'nextAttemptAt' | 'alertedAt'>>,
  ): Promise<void>;
  /** Filas que toca intentar ahora: PENDING, FAILED con turno vencido y SENDING colgadas. */
  pendientes(ahora: Date, limit: number): Promise<FilaConversion[]>;
  /** Filas que merecen aviso y todavía no se avisaron. */
  paraAvisar(): Promise<FilaConversion[]>;
}

/** Meta rechaza `event_time` con más de 7 días; se deja 1 h de margen. */
export const VENTANA_META_MS = 7 * 24 * 3600_000 - 3600_000;
/** Una fila en SENDING más de esto se considera colgada (el request dura segundos). */
export const SENDING_COLGADA_MS = 10 * 60_000;
/** A partir de este intento fallido se avisa por mail (≈ 30-40 min sin entrar). */
export const INTENTOS_ANTES_DE_AVISAR = 3;

/** Backoff: 10 min, 20, 40, 80 … con tope de 6 h. */
export function backoffMs(attempts: number): number {
  return Math.min(10 * 60_000 * 2 ** Math.max(0, attempts - 1), 6 * 3600_000);
}

const SELECT_FILA = {
  id: true,
  orderId: true,
  actionSource: true,
  eventTime: true,
  value: true,
  status: true,
  attempts: true,
  lastError: true,
  sentAt: true,
  nextAttemptAt: true,
  alertedAt: true,
  payload: true,
  createdAt: true,
  updatedAt: true,
} as const;

const almacenPrisma: AlmacenConversiones = {
  async registrar(input) {
    try {
      return (await prisma.metaConversion.create({
        data: {
          orderId: input.orderId,
          actionSource: input.actionSource,
          eventTime: input.eventTime,
          value: input.value,
          payload: input.payload as Prisma.InputJsonValue,
        },
        select: SELECT_FILA,
      })) as FilaConversion;
    } catch (err: any) {
      // P2002 = ya estaba anotada (doble clic, reintento del webhook): se devuelve tal cual.
      if (err?.code === 'P2002') {
        const existente = await prisma.metaConversion.findUnique({
          where: { orderId_actionSource: { orderId: input.orderId, actionSource: input.actionSource } },
          select: SELECT_FILA,
        });
        if (existente) return existente as FilaConversion;
      }
      throw err;
    }
  },

  async reclamar(id, desde, noTocadaDesde) {
    const r = await prisma.metaConversion.updateMany({
      where: {
        id,
        status: { in: desde },
        ...(noTocadaDesde ? { updatedAt: { lt: noTocadaDesde } } : {}),
      },
      data: { status: 'SENDING' },
    });
    if (r.count !== 1) return null;
    return (await prisma.metaConversion.findUnique({ where: { id }, select: SELECT_FILA })) as FilaConversion | null;
  },

  async resolver(id, data) {
    await prisma.metaConversion.update({ where: { id }, data, select: { id: true } });
  },

  async pendientes(ahora, limit) {
    return (await prisma.metaConversion.findMany({
      where: {
        OR: [
          { status: 'PENDING' },
          { status: 'FAILED', OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: ahora } }] },
          { status: 'SENDING', updatedAt: { lt: new Date(ahora.getTime() - SENDING_COLGADA_MS) } },
        ],
      },
      orderBy: { eventTime: 'asc' },
      take: limit,
      select: SELECT_FILA,
    })) as FilaConversion[];
  },

  async paraAvisar() {
    return (await prisma.metaConversion.findMany({
      where: {
        alertedAt: null,
        OR: [
          { status: 'EXPIRED' },
          { status: 'REJECTED' },
          { status: 'FAILED', attempts: { gte: INTENTOS_ANTES_DE_AVISAR } },
        ],
      },
      orderBy: { eventTime: 'asc' },
      take: 50,
      select: SELECT_FILA,
    })) as FilaConversion[];
  },
};

/**
 * Almacén en memoria con las MISMAS garantías, para los checks (sin base).
 * Expone `filas` para inspeccionar el estado.
 */
export function crearAlmacenEnMemoria(): AlmacenConversiones & { filas: FilaConversion[] } {
  const filas: FilaConversion[] = [];
  let seq = 0;
  const clon = (f: FilaConversion) => ({ ...f, payload: { ...f.payload } });
  return {
    filas,
    async registrar(input) {
      const existente = filas.find((f) => f.orderId === input.orderId && f.actionSource === input.actionSource);
      if (existente) return clon(existente);
      const ahora = new Date();
      const fila: FilaConversion = {
        id: `mem-${++seq}`,
        orderId: input.orderId,
        actionSource: input.actionSource,
        eventTime: input.eventTime,
        value: input.value,
        status: 'PENDING',
        attempts: 0,
        lastError: null,
        sentAt: null,
        nextAttemptAt: null,
        alertedAt: null,
        payload: { ...input.payload },
        createdAt: ahora,
        updatedAt: ahora,
      };
      filas.push(fila);
      return clon(fila);
    },
    async reclamar(id, desde, noTocadaDesde) {
      const f = filas.find((x) => x.id === id);
      if (!f || !desde.includes(f.status)) return null;
      if (noTocadaDesde && !(f.updatedAt < noTocadaDesde)) return null;
      f.status = 'SENDING';
      f.updatedAt = new Date();
      return clon(f);
    },
    async resolver(id, data) {
      const f = filas.find((x) => x.id === id);
      if (!f) return;
      Object.assign(f, data, { updatedAt: new Date() });
    },
    async pendientes(ahora, limit) {
      return filas
        .filter(
          (f) =>
            f.status === 'PENDING' ||
            (f.status === 'FAILED' && (!f.nextAttemptAt || f.nextAttemptAt <= ahora)) ||
            (f.status === 'SENDING' && f.updatedAt < new Date(ahora.getTime() - SENDING_COLGADA_MS)),
        )
        .sort((a, b) => a.eventTime.getTime() - b.eventTime.getTime())
        .slice(0, limit)
        .map(clon);
    },
    async paraAvisar() {
      return filas
        .filter(
          (f) =>
            !f.alertedAt &&
            (f.status === 'EXPIRED' ||
              f.status === 'REJECTED' ||
              (f.status === 'FAILED' && f.attempts >= INTENTOS_ANTES_DE_AVISAR)),
        )
        .map(clon);
    },
  };
}

export interface ResumenReintentos {
  revisadas: number;
  enviadas: number;
  fallidas: number;
  vencidas: number;
  rechazadas: number;
  /** Otra instancia las estaba mandando: no se tocaron. */
  tomadasPorOtra: number;
}

export class MetaConversionService {
  private static almacen: AlmacenConversiones = almacenPrisma;

  /** SOLO para checks: reemplaza la base por un almacén en memoria. Devuelve el anterior. */
  public static usarAlmacen(almacen: AlmacenConversiones): AlmacenConversiones {
    const previo = this.almacen;
    this.almacen = almacen;
    return previo;
  }

  /**
   * Compra de la tienda online (checkout). `eventTime` = cuándo se creó la
   * orden, que en la web ES el momento de la compra. Las señales del navegador
   * (fbp/fbc/IP/user-agent) valen oro para la atribución: mandarlas siempre
   * que se tengan.
   */
  public static registrarCompraWeb(
    order: PurchaseOrderData,
    opts: { eventSourceUrl?: string; matchData?: MatchData } = {},
  ): Promise<FilaConversion | null> {
    return this.registrar('website', order, {
      eventTime: order.createdAt ?? new Date(),
      eventSourceUrl: opts.eventSourceUrl,
      matchData: opts.matchData,
    });
  }

  /**
   * Venta del local (presupuesto convertido en venta en el CRM). `eventTime` =
   * `labSentAt`, el momento en que se envió a fábrica, que es la definición de
   * venta del negocio. NUNCA `createdAt`: esa es la fecha del presupuesto.
   */
  public static registrarCompraLocal(
    order: PurchaseOrderData & { labSentAt?: Date | null },
  ): Promise<FilaConversion | null> {
    return this.registrar('physical_store', order, { eventTime: order.labSentAt ?? new Date() });
  }

  private static async registrar(
    actionSource: ActionSource,
    order: PurchaseOrderData,
    opts: { eventTime: Date; eventSourceUrl?: string; matchData?: MatchData },
  ): Promise<FilaConversion | null> {
    try {
      // Un reloj adelantado o un labSentAt del futuro no pueden mandar un
      // evento posterior al momento del envío: se recorta a "ahora".
      const ahora = new Date();
      const eventTime = opts.eventTime.getTime() > ahora.getTime() ? ahora : opts.eventTime;
      const payload = AdsService.buildPurchaseEvent(order, actionSource, {
        eventTime,
        eventSourceUrl: opts.eventSourceUrl,
        matchData: opts.matchData,
      });

      let fila: FilaConversion;
      try {
        fila = await this.almacen.registrar({
          orderId: order.id,
          actionSource,
          eventTime,
          value: order.total,
          payload,
        });
      } catch (err) {
        // La base no puede frenar el aviso a Meta: se manda igual, sin rastro,
        // y se deja escrito por qué.
        console.error('[MetaConversion] No se pudo anotar la compra; se manda sin registro:', err);
        void AdsService.postEvent(payload).then((r) => {
          if (r.ok) console.log(`[MetaConversion] Compra ${order.id} (${actionSource}) enviada SIN registro. Eventos: ${r.eventsReceived}`);
          else console.error(`[MetaConversion] Compra ${order.id} (${actionSource}) NO llegó y no quedó anotada (${r.tipo}): ${r.error}`);
        });
        return null;
      }

      // Fire-and-forget: medir no puede frenar ni romper la venta. El cron
      // recoge lo que no entre.
      void this.enviar(fila).catch((err) =>
        console.error(`[MetaConversion] Error enviando la compra ${order.id}:`, err),
      );
      return fila;
    } catch (err) {
      console.error('[MetaConversion] Error preparando la compra para Meta:', err);
      return null;
    }
  }

  /**
   * Intenta mandar UNA fila. Devuelve el estado en que quedó. Idempotente y
   * seguro entre instancias: reclama la fila antes de tocar la red.
   */
  public static async enviar(fila: FilaConversion, ahora: Date = new Date()): Promise<EstadoConversion> {
    if (fila.status === 'SENT' || fila.status === 'REJECTED' || fila.status === 'EXPIRED') return fila.status;

    const desde: EstadoConversion[] = fila.status === 'SENDING' ? ['SENDING'] : ['PENDING', 'FAILED'];
    const colgadaDesde = fila.status === 'SENDING' ? new Date(ahora.getTime() - SENDING_COLGADA_MS) : undefined;

    // Vencida: no se manda, se cierra. Se reclama igual para que una sola
    // instancia la marque (y avise).
    if (ahora.getTime() - fila.eventTime.getTime() > VENTANA_META_MS) {
      const tomada = await this.almacen.reclamar(fila.id, desde, colgadaDesde);
      if (!tomada) return fila.status;
      await this.almacen.resolver(fila.id, {
        status: 'EXPIRED',
        lastError: 'Venció la ventana de 7 días de Meta sin que la compra entrara',
        nextAttemptAt: null,
      });
      console.error(`[MetaConversion] Compra ${fila.orderId} (${fila.actionSource}) VENCIDA sin llegar a Meta.`);
      return 'EXPIRED';
    }

    const tomada = await this.almacen.reclamar(fila.id, desde, colgadaDesde);
    if (!tomada) return fila.status;

    const r = await AdsService.postEvent(tomada.payload);
    const attempts = tomada.attempts + 1;

    if (r.ok) {
      await this.almacen.resolver(fila.id, { status: 'SENT', attempts, sentAt: ahora, lastError: null, nextAttemptAt: null });
      console.log(`[MetaConversion] Compra ${fila.orderId} (${fila.actionSource}) enviada a Meta. Eventos: ${r.eventsReceived}${attempts > 1 ? ` (intento ${attempts})` : ''}`);
      return 'SENT';
    }

    if (r.tipo === 'vencido') {
      await this.almacen.resolver(fila.id, { status: 'EXPIRED', attempts, lastError: r.error, nextAttemptAt: null });
      console.error(`[MetaConversion] Compra ${fila.orderId} (${fila.actionSource}) rechazada por antigüedad: ${r.error}`);
      return 'EXPIRED';
    }
    if (r.tipo === 'rechazo') {
      await this.almacen.resolver(fila.id, { status: 'REJECTED', attempts, lastError: r.error, nextAttemptAt: null });
      console.error(`[MetaConversion] Compra ${fila.orderId} (${fila.actionSource}) RECHAZADA por Meta: ${r.error}`);
      return 'REJECTED';
    }

    // transitorio o sin credenciales: se reintenta con backoff.
    const nextAttemptAt = new Date(ahora.getTime() + backoffMs(attempts));
    await this.almacen.resolver(fila.id, { status: 'FAILED', attempts, lastError: r.error, nextAttemptAt });
    console.error(`[MetaConversion] Compra ${fila.orderId} (${fila.actionSource}) no entró (intento ${attempts}, ${r.tipo}): ${r.error}. Próximo intento ${nextAttemptAt.toISOString()}`);
    return 'FAILED';
  }

  /** Lo que corre el cron: insiste con todo lo que quedó sin entrar. */
  public static async reintentarPendientes(ahora: Date = new Date(), limit = 200): Promise<ResumenReintentos> {
    const resumen: ResumenReintentos = { revisadas: 0, enviadas: 0, fallidas: 0, vencidas: 0, rechazadas: 0, tomadasPorOtra: 0 };
    const filas = await this.almacen.pendientes(ahora, limit);
    for (const fila of filas) {
      resumen.revisadas++;
      const estadoPrevio = fila.status;
      const estado = await this.enviar(fila, ahora);
      if (estado === 'SENT') resumen.enviadas++;
      else if (estado === 'EXPIRED') resumen.vencidas++;
      else if (estado === 'REJECTED') resumen.rechazadas++;
      else if (estado === 'FAILED') resumen.fallidas++;
      else if (estado === estadoPrevio) resumen.tomadasPorOtra++;
    }
    return resumen;
  }

  /** Filas que hay que avisar por mail (una sola vez cada una). */
  public static paraAvisar(): Promise<FilaConversion[]> {
    return this.almacen.paraAvisar();
  }

  /** Marca las filas como avisadas para que el próximo mail no las repita. */
  public static async marcarAvisadas(ids: string[], cuando: Date = new Date()): Promise<void> {
    for (const id of ids) await this.almacen.resolver(id, { alertedAt: cuando });
  }
}
