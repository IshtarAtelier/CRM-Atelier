// ────────────────────────────────────────────────────────────────────────────
// AUDITOR DE AVISOS AUTOMÁTICOS
//
// Por qué existe: el 16/9/2026 aparecieron 5 ventas de septiembre con
// "WhatsApp ✅ enviado" en la ficha y ni un mensaje en la conversación. El ✅
// salía de un HTTP 200 del wa-service, no de que el mensaje existiera. O sea:
// el sistema no solo fallaba, además informaba que no había fallado.
//
// La lección es que un aviso no se da por entregado porque el que lo mandó diga
// que sí: se da por entregado cuando el mensaje ESTÁ en la conversación. Este
// auditor mira eso —y solo eso— para los tres avisos que el cliente espera:
//
//   1. la confirmación de compra,
//   2. el aviso de procesado con la fecha estimada de confección,
//   3. el aviso de que el pedido está listo para retirar.
//
// Lo que encuentra sin entregar lo REDISPARA, llamando al mismo emisor de
// siempre (no hay una segunda copia del mensaje que pueda divergir).
//
// 🔴 Por defecto NO manda nada. El modo vive en SystemSetting
// `auditor_avisos_modo`: 'seco' (default, solo informa) o 'real' (redispara).
// Es la misma llave que usan los seguimientos, y por el mismo motivo: un
// proceso que le escribe solo a los clientes se prende a mano, mirando lo que
// iba a mandar.
// ────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { avisarAlEquipo } from '@/lib/avisos/aviso-al-equipo';
import { MARCA_NOTA } from '@/lib/sale-confirmation';
import { MARCA_AVISO_PROCESADO } from '@/lib/avisos/aviso-procesado';

export type TipoAviso = 'confirmacion_compra' | 'procesado' | 'listo_para_retirar';

export interface AvisoFaltante {
    orderId: string;
    nro: string;
    clientId: string;
    clientName: string;
    phone: string | null;
    tipo: TipoAviso;
    /** Desde cuándo se le debía: el hito que lo dispara. */
    desde: Date;
    /** Qué pasó al redispararlo (vacío en modo seco). */
    reenvio?: { ok: boolean; detalle: string };
    /** El hito es de hace más de MAX_HORAS_PARA_REENVIAR: no se reenvía solo. */
    viejo?: boolean;
}

export interface ResultadoAuditoria {
    modo: 'seco' | 'real';
    ventasRevisadas: number;
    faltantes: AvisoFaltante[];
    reenviados: number;
    fallidos: number;
    /** Faltantes que NO se tocaron por el tope de la corrida. */
    postergados: number;
    /** Faltantes viejos: se informan, nunca se reenvían solos. */
    viejos: number;
}

/**
 * Margen antes de considerar que un aviso no salió. El envío es
 * fire-and-forget: generar el PDF, subirlo y hablar con Meta lleva su tiempo, y
 * un pedido que se acaba de confirmar todavía puede estar en camino.
 */
const GRACIA_MINUTOS = 90;

/**
 * Tope de reenvíos por corrida. WhatsApp cobra por conversación iniciada y el
 * número está en TIER_250 (250 por día, compartidas con campañas y
 * seguimientos): un auditor que se despierta con 60 faltantes y los dispara
 * todos juntos se come el cupo del día. Lo que sobra espera a la próxima.
 */
const TOPE_POR_CORRIDA = 15;

/**
 * 🔴 NADA VIEJO. Un aviso solo se redispara si el hito que lo dispara es de las
 * últimas 24 h. Regla de Ishtar (16/9/2026), y tiene todo el sentido: mandarle
 * hoy la "confirmación de compra" de un pedido de hace tres semanas —que el
 * cliente ya retiró— no lo informa, lo confunde, y encima gasta una conversación
 * paga. Lo viejo se informa y se arregla a mano si hace falta, nunca solo.
 */
const MAX_HORAS_PARA_REENVIAR = 24;

/**
 * 🔴 EL AUDITOR ARRANCA HOY. Nada anterior a esta fecha se audita ni se informa:
 * el atraso acumulado —53 avisos al 16/9/2026— se revisa a mano con
 * `scripts/checks/avisos-sin-entregar.mjs`, no lo toca un proceso automático.
 * Decisión de Ishtar (16/9/2026): "todo a partir de HOY".
 *
 * El día que se quiera reprocesar algo viejo, se corre el check y se decide caso
 * por caso. Esta fecha NO se mueve hacia atrás.
 */
const AUDITA_DESDE = new Date('2026-09-16T00:00:00-03:00');

/** Los estados que prueban que el pedido YA pasó por cada hito. */
const ESTADOS_PROCESADO = ['IN_PROGRESS', 'FINISHED', 'READY', 'DELIVERED'];
const ESTADOS_LISTO = ['READY', 'DELIVERED'];

/**
 * Huellas por las que se reconoce cada aviso dentro de la conversación.
 *
 * Un aviso cuenta como entregado si aparece CUALQUIERA: el texto libre (por su
 * frase) o la plantilla (por su nombre). Las frases son las que escriben los
 * emisores; si alguna cambia, se cambia también acá — por eso las dos que se
 * pueden tocar viven exportadas en su propio módulo.
 */
const HUELLAS: Record<TipoAviso, { frases: string[]; plantillas: string[] }> = {
    confirmacion_compra: {
        frases: ['Confirmación de compra — Pedido'],
        plantillas: ['venta_confirmada'],
    },
    procesado: {
        frases: [MARCA_AVISO_PROCESADO, 'Fecha aproximada de entrega'],
        plantillas: ['estado_pedido'],
    },
    listo_para_retirar: {
        frases: ['listos esperándote', 'listo para retirar', 'ya están listos'],
        plantillas: ['pedido_listo', 'pedido_listo_saldo'],
    },
};

const nroDe = (id: string) => `#${String(id).slice(-4).toUpperCase()}`;

/** ¿Este mensaje saliente es el aviso que buscamos? */
function esElAviso(msg: { content: string; templateName: string | null }, tipo: TipoAviso): boolean {
    const h = HUELLAS[tipo];
    if (msg.templateName && h.plantillas.some(p => msg.templateName!.startsWith(p))) return true;
    const texto = msg.content || '';
    return h.frases.some(f => texto.includes(f));
}

/** El modo de trabajo, leído de la base en cada corrida. */
async function leerModo(): Promise<'seco' | 'real'> {
    const row = await prisma.systemSetting
        .findUnique({ where: { key: 'auditor_avisos_modo' }, select: { value: true } })
        .catch(() => null);
    return row?.value === 'real' ? 'real' : 'seco';
}

/**
 * Revisa los avisos de los últimos `dias` y devuelve los que no llegaron.
 * En modo 'real' además los redispara.
 */
export async function auditarAvisos(opts: { dias?: number; modo?: 'seco' | 'real' } = {}): Promise<ResultadoAuditoria> {
    const dias = opts.dias ?? 30;
    const modo = opts.modo ?? (await leerModo());
    // La ventana nunca empieza antes del día en que el auditor entró en servicio.
    const ventana = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
    const desde = ventana > AUDITA_DESDE ? ventana : AUDITA_DESDE;
    const corte = new Date(Date.now() - GRACIA_MINUTOS * 60 * 1000);

    // Contra producción el select va explícito (el schema local va adelantado).
    const ventas = await prisma.order.findMany({
        where: {
            orderType: { in: ['SALE', 'MAYORISTA'] },
            OR: [{ createdAt: { gte: desde } }, { labSentAt: { gte: desde } }, { updatedAt: { gte: desde } }],
        },
        select: {
            id: true, createdAt: true, updatedAt: true, labSentAt: true, labStatus: true,
            clientId: true,
            client: { select: { id: true, name: true, phone: true, email: true } },
        },
        orderBy: { createdAt: 'asc' },
    });

    // ── La evidencia: los mensajes SALIENTES ────────────────────────────────
    // Un aviso está entregado si el mensaje existe en la conversación. Es lo
    // único verificable después y lo único que el cliente recibió de verdad.
    //
    // Se indexan por TRES llaves, porque con una sola se pierden mensajes que sí
    // salieron: 821 de los 2.395 chats no tienen ficha vinculada, el teléfono de
    // la ficha y el waId del chat no siempre están escritos igual, y un chat
    // @lid no tiene teléfono. La tercera —el número de pedido que el propio
    // mensaje menciona— no depende de ninguna de esas ataduras.
    const salientes = await prisma.whatsAppMessage.findMany({
        where: { direction: 'OUTBOUND', createdAt: { gte: desde } },
        select: {
            content: true, templateName: true, createdAt: true,
            chat: { select: { clientId: true, waId: true, realPhone: true } },
        },
    });

    type Saliente = (typeof salientes)[number];
    const sufijo = (t: string | null | undefined) => {
        const d = String(t || '').replace(/\D/g, '');
        return d.length >= 8 ? d.slice(-8) : null;
    };
    const porLlave = new Map<string, Saliente[]>();
    const guardar = (k: string | null | undefined, m: Saliente) => {
        if (!k) return;
        if (!porLlave.has(k)) porLlave.set(k, []);
        porLlave.get(k)!.push(m);
    };
    for (const m of salientes) {
        guardar(m.chat?.clientId, m);
        guardar(sufijo(m.chat?.waId), m);
        guardar(sufijo(m.chat?.realPhone), m);
        for (const x of (m.content || '').matchAll(/#([0-9A-Z]{4})\b/g)) guardar(`nro:${x[1]}`, m);
    }

    // ── Cuándo pasó cada pedido por cada estado ─────────────────────────────
    // No hay columna con esa fecha y `updatedAt` es la última modificación de
    // cualquier cosa: usarlo daba 83 falsos "no llegó" en pedidos ya entregados,
    // porque el aviso había salido días ANTES de ese updatedAt. La fecha real
    // está en la nota que el propio cambio de estado deja en la ficha.
    const cambios = await prisma.interaction.findMany({
        where: { createdAt: { gte: desde }, type: 'SISTEMA', content: { startsWith: '📦 ' } },
        select: { content: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
    });
    const hitoProcesado = new Map<string, Date>();
    const hitoListo = new Map<string, Date>();
    for (const c of cambios) {
        const m = c.content.match(/pedido #([0-9A-Z]{4}):.*→ (.+)$/);
        if (!m) continue;
        const [, nro, destino] = m;
        if (destino.startsWith('Procesado') && !hitoProcesado.has(nro)) hitoProcesado.set(nro, c.createdAt);
        if (destino.startsWith('Listo para retirar') && !hitoListo.has(nro)) hitoListo.set(nro, c.createdAt);
    }

    const faltantes: AvisoFaltante[] = [];

    for (const v of ventas) {
        const nro = nroDe(v.id).slice(1);
        const mensajes = [
            ...(porLlave.get(v.clientId || '') || []),
            ...(porLlave.get(sufijo(v.client?.phone) || '') || []),
            ...(porLlave.get(`nro:${nro}`) || []),
        ];

        // Qué avisos le correspondían a este pedido, y desde cuándo. Sin fecha
        // del cambio de estado NO se audita: no se puede saber si el aviso salió
        // antes o después, y en la duda no se le vuelve a escribir al cliente.
        const esperados: { tipo: TipoAviso; desde: Date }[] = [];
        if (v.labSentAt) esperados.push({ tipo: 'confirmacion_compra', desde: v.labSentAt });
        const procesadoEl = hitoProcesado.get(nro) || (v.labStatus && ESTADOS_PROCESADO.includes(v.labStatus) ? v.labSentAt : null);
        if (v.labStatus && ESTADOS_PROCESADO.includes(v.labStatus) && procesadoEl) {
            esperados.push({ tipo: 'procesado', desde: procesadoEl });
        }
        const listoEl = hitoListo.get(nro);
        if (v.labStatus && ESTADOS_LISTO.includes(v.labStatus) && listoEl) {
            esperados.push({ tipo: 'listo_para_retirar', desde: listoEl });
        }

        for (const e of esperados) {
            // Todavía puede estar en camino: no se toca.
            if (e.desde > corte) continue;
            // El hito tiene que caer DENTRO de la ventana. Los salientes se leen
            // de los últimos `dias`: un pedido viejo que se tocó ayer parecería
            // no haber recibido nunca su aviso, cuando el mensaje existe y quedó
            // fuera de la ventana. Redispararlo sería escribirle de nuevo a un
            // cliente que ya fue avisado hace meses.
            if (e.desde < desde) continue;
            // El mensaje vale si es de este aviso y no es anterior al hito.
            const hay = mensajes.some(m => m.createdAt >= e.desde && esElAviso(m, e.tipo));
            if (hay) continue;

            faltantes.push({
                viejo: e.desde.getTime() < Date.now() - MAX_HORAS_PARA_REENVIAR * 3600000,
                orderId: v.id,
                nro: nroDe(v.id),
                clientId: v.clientId || '',
                clientName: v.client?.name || 'sin nombre',
                phone: v.client?.phone || null,
                tipo: e.tipo,
                desde: e.desde,
            });
        }
    }

    const resultado: ResultadoAuditoria = {
        modo, ventasRevisadas: ventas.length, faltantes, reenviados: 0, fallidos: 0, postergados: 0,
        viejos: faltantes.filter(f => f.viejo).length,
    };

    if (modo === 'seco') return resultado;

    // ── Redisparo ───────────────────────────────────────────────────────────
    // Solo lo fresco, y dentro de eso lo más viejo primero: es el cliente que
    // hace más rato que espera.
    const cola = faltantes
        .filter(f => !f.viejo)
        .sort((a, b) => a.desde.getTime() - b.desde.getTime());
    resultado.postergados = Math.max(0, cola.length - TOPE_POR_CORRIDA);

    for (const f of cola.slice(0, TOPE_POR_CORRIDA)) {
        const r = await redisparar(f);
        f.reenvio = r;
        if (r.ok) resultado.reenviados++; else resultado.fallidos++;

        await prisma.interaction.create({
            data: {
                clientId: f.clientId,
                type: 'NOTE',
                content: `🔁 El auditor de avisos detectó que el aviso "${etiqueta(f.tipo)}" del pedido ${f.nro} nunca llegó a la conversación y lo volvió a enviar: ${r.ok ? '✅ salió' : `❌ no salió — ${r.detalle}`}`,
                userId: null,
                userName: 'Sistema',
            },
        }).catch(err => console.error('[Auditor de avisos] No se pudo registrar la nota:', err));

        await logAudit({
            userId: null,
            userName: 'Sistema',
            action: 'NOTIFY',
            entityType: 'ORDER',
            entityId: f.orderId,
            details: { tipo: 'auditor_avisos', aviso: f.tipo, reenviado: r.ok, detalle: r.detalle },
        }).catch(err => console.error('[Auditor de avisos] audit:', err));
    }

    // El equipo se entera UNA vez por corrida, no una por pedido.
    if (resultado.fallidos > 0) {
        const lista = faltantes
            .filter(f => f.reenvio && !f.reenvio.ok)
            .map(f => `• ${f.nro} ${f.clientName} — ${etiqueta(f.tipo)}: ${f.reenvio!.detalle}`)
            .join('\n');
        await avisarAlEquipo({
            asunto: `⚠️ ${resultado.fallidos} aviso(s) automático(s) que no se pudieron reenviar`,
            cuerpo: `El auditor encontró avisos que nunca llegaron y tampoco pudo reenviarlos. Hay que mandarlos a mano:\n\n${lista}`,
        }).catch(err => console.error('[Auditor de avisos] No se pudo avisar al equipo:', err));
    }

    return resultado;
}

export function etiqueta(tipo: TipoAviso): string {
    switch (tipo) {
        case 'confirmacion_compra': return 'confirmación de compra';
        case 'procesado': return 'pedido procesado (con fecha estimada)';
        case 'listo_para_retirar': return 'listo para retirar';
    }
}

/**
 * Vuelve a disparar el aviso, llamando SIEMPRE al emisor original: no hay una
 * segunda redacción del mensaje que pueda quedar desactualizada.
 */
async function redisparar(f: AvisoFaltante): Promise<{ ok: boolean; detalle: string }> {
    try {
        if (f.tipo === 'confirmacion_compra') {
            const { sendSaleConfirmation } = await import('@/lib/sale-confirmation');
            // `reenviar`: la nota de la ficha ya existe (el intento se registró),
            // así que sin esto el candado de idempotencia lo bloquearía justo en
            // el caso que hay que arreglar.
            const r = await sendSaleConfirmation(f.orderId, { reenviar: true });
            if (r.whatsapp) return { ok: true, detalle: 'reenviada por WhatsApp' };
            if (r.email) return { ok: true, detalle: 'reenviada solo por email (WhatsApp no salió)' };
            return { ok: false, detalle: 'no salió por ningún canal' };
        }

        const order = await prisma.order.findUnique({
            where: { id: f.orderId },
            include: { client: true, items: { include: { product: true } }, payments: true },
        });
        if (!order) return { ok: false, detalle: 'el pedido ya no existe' };

        if (f.tipo === 'procesado') {
            const { enviarAvisoProcesado } = await import('@/lib/avisos/aviso-procesado');
            const r = await enviarAvisoProcesado(order);
            return { ok: r.ok && !r.motivo, detalle: r.motivo || 'reenviado por WhatsApp' };
        }

        const { BotService } = await import('@/services/bot.service');
        await BotService.notifyOrderReady(order);
        return { ok: true, detalle: 'reenviado por WhatsApp/email' };
    } catch (err: any) {
        return { ok: false, detalle: err?.message || 'error inesperado' };
    }
}

/** Sello de la nota de confirmación, para quien quiera cruzar intentos. */
export { MARCA_NOTA };
