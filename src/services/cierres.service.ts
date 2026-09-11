import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import type { Actor } from '@/lib/actor';
import { SOLO_CLIENTES_POSIBLES } from '@/lib/no-cliente';
import { ensureClientForAbandonedCart } from '@/services/cart-recovery.service';
import {
    DIAS_PARA_ENFRIARSE, DIAS_TICKET_ALTO, DIAS_PRESUPUESTO_COMUN, DIAS_SIN_PRESUPUESTO,
    DIAS_CARRITO, DIAS_ESCONDIDA_TRAS_ESCRIBIRLE, REMITENTES_AUTOMATICOS,
} from '@/lib/constants/cierres';
import {
    type Oportunidad, type TipoCierre, type YaEscrito,
    esLenteEspecial, esGraduacionAlta, esMontoAlto,
    llaveTelefono, llaveEmail, llaveNombre, agruparPorPersona, armarPanel,
} from '@/lib/cierres/armado';

/**
 * OPORTUNIDADES DE CIERRE — las consultas y las mutaciones del panel.
 *
 * Antes todo esto vivía adentro de `/api/sales-opportunities` (≈700 líneas de
 * `prisma.` en una ruta, contra la regla de arquitectura del proyecto). Ahora:
 *   · las DECISIONES (ticket alto, misma persona, "ya le escribí") son puras y
 *     viven en `src/lib/cierres/armado.ts`, probadas por `npm run check:cierres`;
 *   · las CONSULTAS y las MUTACIONES viven acá;
 *   · las rutas validan, llaman y responden.
 *
 * `oportunidades()` SOLO LEE. Antes el GET creaba fichas para los carritos
 * (`ensureClientForAbandonedCart`, que además carga todas las fichas con
 * teléfono para buscar coincidencias) — en una ruta que cada vendedor consulta
 * cada 60 segundos. Ahora la ficha del carrito la crea el cron del recupero
 * (`/api/cron/abandoned-carts`) o, a más tardar, el primer seguimiento.
 */

export const CACHE_CIERRES = 'sales-opportunities';

export const TIPOS_CIERRE: readonly TipoCierre[] = ['STALLED_FAVORITE', 'PENDING_QUOTE', 'ABANDONED_CART', 'SIN_PRESUPUESTO'];

export function esTipoCierre(x: unknown): x is TipoCierre {
    return typeof x === 'string' && (TIPOS_CIERRE as readonly string[]).includes(x);
}

const DIA_MS = 24 * 60 * 60 * 1000;
const haceDias = (d: number) => new Date(Date.now() - d * DIA_MS);
const diasDesde = (d: Date) => Math.floor((Date.now() - d.getTime()) / DIA_MS);
const plata = (n: number) => `$${n.toLocaleString('es-AR')}`;

/** Estados del checkout que siguen siendo un carrito sin pagar. EMAIL_SENT incluido: ver `carritos()`. */
const CARRITO_ABIERTO = ['PENDING', 'ABANDONED', 'EMAIL_SENT'];

async function favoritos(): Promise<Oportunidad[]> {
    const hace7 = haceDias(7);
    const clientes = await prisma.client.findMany({
        where: {
            isFavorite: true,
            isDeleted: false,
            status: { notIn: ['CLIENT', 'active'] },
            opportunityDismissedAt: null,
            // Un proveedor marcado como favorito no es una oportunidad de venta.
            ...SOLO_CLIENTES_POSIBLES,
            orders: {
                none: {
                    OR: [{ orderType: 'SALE' }, { status: 'CONFIRMED', updatedAt: { gte: hace7 } }],
                    isDeleted: false,
                },
            },
        },
        select: {
            id: true, name: true, phone: true, email: true, interest: true, updatedAt: true, createdAt: true,
            interactions: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
            orders: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true, total: true } },
            tasks: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
            whatsappChats: { orderBy: { lastMessageAt: 'desc' }, take: 1, select: { lastMessageAt: true } },
            prescriptions: {
                orderBy: { date: 'desc' }, take: 1,
                select: { sphereOD: true, cylinderOD: true, additionOD: true, sphereOI: true, cylinderOI: true, additionOI: true },
            },
        },
    });

    const enfriado = haceDias(DIAS_PARA_ENFRIARSE);
    const tope = haceDias(DIAS_TICKET_ALTO);
    const out: Oportunidad[] = [];
    for (const c of clientes) {
        const fechas = [c.updatedAt, c.interactions[0]?.createdAt, c.orders[0]?.createdAt, c.tasks[0]?.createdAt, c.whatsappChats[0]?.lastMessageAt]
            .filter((d): d is Date => !!d);
        const ultimaActividad = fechas.length ? new Date(Math.max(...fechas.map(d => d.getTime()))) : c.createdAt;
        if (!(ultimaActividad < enfriado && ultimaActividad > tope)) continue;

        const rx = c.prescriptions[0];
        const especial =
            (!!rx && esGraduacionAlta([rx.sphereOD, rx.sphereOI], [rx.cylinderOD, rx.cylinderOI])) ||
            (!!rx && (rx.additionOD != null || rx.additionOI != null)) ||
            esLenteEspecial(c.interest);
        const ultimaOrden = c.orders[0];
        // Un favorito solo entra si es ticket alto: todos son "importantes del mes".
        if (!esMontoAlto(ultimaOrden?.total) && !especial) continue;

        const dias = diasDesde(ultimaActividad);
        out.push({
            id: c.id, type: 'STALLED_FAVORITE', title: 'Favorito sin actividad',
            clientName: c.name, clientId: c.id, phone: c.phone, email: c.email,
            isPriority: especial, importante: true,
            detail: `Sin actividad por ${dias} días`,
            amount: ultimaOrden?.total || null, daysElapsed: dias, lastActivity: ultimaActividad.toISOString(),
        });
    }
    return out;
}

async function presupuestos(): Promise<Oportunidad[]> {
    const hace7 = haceDias(7);
    const quotes = await prisma.order.findMany({
        where: {
            orderType: 'QUOTE',
            status: { in: ['PENDING', 'CONFIRMED'] },
            isDeleted: false,
            // La ventana larga; la corta de los comunes se aplica abajo, cuando ya
            // se sabe si es ticket alto.
            createdAt: { lt: haceDias(DIAS_PARA_ENFRIARSE), gt: haceDias(Math.max(DIAS_TICKET_ALTO, DIAS_PRESUPUESTO_COMUN)) },
            // `status notIn CLIENT/active` verificado contra datos reales (12/8/2026):
            // una venta cerrada muchas veces NO deja Order SALE ni Payment — lo único
            // que cambia es que la ficha pasa a CLIENT. Sin este filtro el panel se
            // llenaba de clientes que ya compraron.
            client: { isDeleted: false, status: { notIn: ['CLIENT', 'active'] }, ...SOLO_CLIENTES_POSIBLES },
        },
        select: {
            id: true, total: true, createdAt: true, status: true,
            client: {
                select: {
                    id: true, name: true, phone: true, email: true, opportunityDismissedAt: true,
                    orders: {
                        where: { isDeleted: false, OR: [{ orderType: 'SALE' }, { status: 'CONFIRMED', updatedAt: { gte: hace7 } }] },
                        select: { id: true, orderType: true, status: true, createdAt: true, updatedAt: true },
                    },
                },
            },
            items: {
                select: {
                    sphereVal: true, cylinderVal: true, additionVal: true,
                    productNameSnapshot: true, productBrandSnapshot: true, productCategorySnapshot: true,
                },
            },
        },
    });

    const out: Oportunidad[] = [];
    for (const q of quotes) {
        // Descartado DESPUÉS de este presupuesto: afuera. Uno nuevo posterior al
        // descarte sí entra — es una oportunidad genuinamente nueva.
        if (q.client.opportunityDismissedAt && q.createdAt < q.client.opportunityDismissedAt) continue;
        // "No compró aún": una VENTA posterior cierra este presupuesto. Una
        // anterior no: el cliente que vuelve es oportunidad de nuevo.
        if (q.client.orders.some(o => o.orderType === 'SALE' && o.createdAt > q.createdAt)) continue;
        // Venta en curso: otra orden CONFIRMED en los últimos 7 días — un vendedor ya está encima.
        if (q.client.orders.some(o => o.id !== q.id && o.status === 'CONFIRMED' && o.updatedAt >= hace7)) continue;

        const graduacionAlta = q.items.some(i => esGraduacionAlta([i.sphereVal], [i.cylinderVal]));
        const lenteEspecial = q.items.some(i =>
            i.additionVal != null ||
            esLenteEspecial(`${i.productBrandSnapshot || ''} ${i.productNameSnapshot || ''} ${i.productCategorySnapshot || ''}`));
        const importante = esMontoAlto(q.total) || graduacionAlta || lenteEspecial;

        const dias = diasDesde(q.createdAt);
        if (dias > (importante ? DIAS_TICKET_ALTO : DIAS_PRESUPUESTO_COMUN)) continue;

        out.push({
            id: q.id, type: 'PENDING_QUOTE',
            title: q.status === 'CONFIRMED' ? 'Presupuesto confirmado sin avance' : 'Presupuesto frío',
            clientName: q.client.name, clientId: q.client.id, phone: q.client.phone, email: q.client.email,
            isPriority: graduacionAlta || lenteEspecial, importante,
            detail: `Presupuesto de ${plata(q.total)} hace ${dias} días`,
            amount: q.total, daysElapsed: dias, lastActivity: q.createdAt.toISOString(),
        });
    }
    return out;
}

async function carritos(): Promise<Oportunidad[]> {
    const sesiones = await prisma.checkoutSession.findMany({
        where: {
            // EMAIL_SENT TAMBIÉN: el carrito al que el recupero ya le mandó el
            // segundo mail y sigue sin pagar. Como el recupero pasa ahí a todos
            // los que no compran, sin este estado el panel no mostraba NINGÚN
            // carrito (medido el 10/9/2026: 11 en 30 días, cero visibles).
            status: { in: CARRITO_ABIERTO },
            createdAt: { lt: new Date(Date.now() - DIA_MS), gt: haceDias(DIAS_CARRITO) },
        },
        orderBy: { createdAt: 'desc' },
        select: {
            id: true, clientId: true, firstName: true, lastName: true, phone: true, email: true,
            total: true, cartData: true, createdAt: true,
        },
    });

    // Una sola consulta para los descartes (antes era una por carrito).
    const ids = [...new Set(sesiones.map(s => s.clientId).filter((x): x is string => !!x))];
    const descartes = new Map(
        (ids.length ? await prisma.client.findMany({ where: { id: { in: ids } }, select: { id: true, opportunityDismissedAt: true } }) : [])
            .map(c => [c.id, c.opportunityDismissedAt]),
    );

    const out: Oportunidad[] = [];
    for (const s of sesiones) {
        // Descartado después de este carrito: afuera (uno nuevo posterior sí entra).
        const descartado = s.clientId ? descartes.get(s.clientId) : null;
        if (descartado && s.createdAt < descartado) continue;

        const items = Array.isArray(s.cartData) ? (s.cartData as { brand?: string; model?: string; category?: string }[]) : [];
        const especial = items.some(i => esLenteEspecial(`${i.brand || ''} ${i.model || ''} ${i.category || ''}`));
        const horas = Math.floor((Date.now() - s.createdAt.getTime()) / (60 * 60 * 1000));
        const dias = diasDesde(s.createdAt);
        out.push({
            id: s.id, type: 'ABANDONED_CART', title: 'Carrito abandonado',
            clientName: `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Cliente Web',
            clientId: s.clientId, phone: s.phone, email: s.email,
            // Todo carrito entra: el monto decide si es importante, no si aparece.
            isPriority: especial, importante: esMontoAlto(s.total) || especial,
            detail: `Carrito de ${plata(s.total)} hace ${horas >= 48 ? `${dias} días` : `${horas} horas`}`,
            amount: s.total, daysElapsed: dias, lastActivity: s.createdAt.toISOString(),
        });
    }
    return out;
}

async function fichasSinPresupuesto(): Promise<Oportunidad[]> {
    // Ishtar, 10/9/2026: "de los que no recibieron presupuesto dentro de los 30
    // días también". El equipo cotiza a casi todos, así que entran pocas — y
    // casi todas nacieron de un anuncio de Meta.
    const fichas = await prisma.client.findMany({
        where: {
            isDeleted: false,
            status: { notIn: ['CLIENT', 'active'] },
            createdAt: { lt: haceDias(DIAS_PARA_ENFRIARSE), gt: haceDias(DIAS_SIN_PRESUPUESTO) },
            orders: { none: { isDeleted: false } },
            // Descartada con el ✓: no vuelve (no hay presupuesto nuevo que la haga nueva).
            opportunityDismissedAt: null,
            ...SOLO_CLIENTES_POSIBLES,
        },
        select: { id: true, name: true, phone: true, email: true, createdAt: true, contactSource: true },
    });
    return fichas.map(c => {
        const dias = diasDesde(c.createdAt);
        return {
            id: c.id, type: 'SIN_PRESUPUESTO' as const, title: 'Sin presupuesto',
            clientName: c.name, clientId: c.id, phone: c.phone, email: c.email,
            isPriority: false, importante: false,
            detail: `Ficha de hace ${dias} días${c.contactSource ? ` (${c.contactSource})` : ''} — nunca se le pasó presupuesto`,
            amount: null, daysElapsed: dias, lastActivity: c.createdAt.toISOString(),
        };
    });
}

/**
 * Llaves de la gente que YA COMPRÓ, para sacarla del panel aunque la
 * oportunidad venga de otra ficha suya. Verificado (12/8/2026): es lo que tapa
 * las fichas duplicadas de quien ya compró — Viviana Espeche tenía una ficha
 * CONTACT con el presupuesto viejo y otra CLIENT con la compra.
 */
async function llavesDeCompradores() {
    const compradores = await prisma.client.findMany({
        where: {
            isDeleted: false,
            OR: [
                { status: { in: ['CLIENT', 'active'] } },
                { orders: { some: { isDeleted: false, OR: [{ orderType: 'SALE' }, { status: 'CONFIRMED', updatedAt: { gte: haceDias(7) } }] } } },
            ],
        },
        select: { name: true, phone: true, email: true },
    });
    const llaves = new Set<string>();
    for (const c of compradores) {
        const t = llaveTelefono(c.phone); if (t) llaves.add(`t:${t}`);
        const e = llaveEmail(c.email); if (e) llaves.add(`e:${e}`);
        const n = llaveNombre(c.name); if (n) llaves.add(`n:${n}`);
    }
    return llaves;
}

/**
 * Último contacto de una PERSONA con cada ficha, dentro de la ventana de
 * "ya le escribí". Cuenta:
 *   · un seguimiento firmado (Interaction FOLLOWUP con userId): el botón, copiar
 *     el número, el verde del panel, la plantilla del embudo;
 *   · un WhatsApp SALIENTE que no sea de un robot — el celular de la óptica
 *     ("Teléfono", por coexistencia de la API) o el buzón. Es lo que más pasa:
 *     2.129 salientes desde el celular en 5 días contra 147 desde el buzón.
 */
async function ultimosContactos(fichas: string[]): Promise<Map<string, YaEscrito>> {
    const desde = haceDias(DIAS_ESCONDIDA_TRAS_ESCRIBIRLE);
    if (!fichas.length) return new Map();
    const [seguimientos, chats] = await Promise.all([
        prisma.interaction.findMany({
            where: { clientId: { in: fichas }, type: 'FOLLOWUP', userId: { not: null }, createdAt: { gte: desde } },
            select: { clientId: true, createdAt: true, userName: true },
        }),
        prisma.whatsAppChat.findMany({
            where: { clientId: { in: fichas } },
            select: {
                clientId: true,
                messages: {
                    // OJO: `notIn` descarta también los senderName NULL (en SQL
                    // `NULL NOT IN (...)` no es TRUE). Medido: entre los candidatos no
                    // hay salientes sin remitente — no "arreglarlo" sumando null sin mirar.
                    where: { direction: 'OUTBOUND', senderName: { notIn: [...REMITENTES_AUTOMATICOS] }, createdAt: { gte: desde } },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { createdAt: true, senderName: true },
                },
            },
        }),
    ]);

    const contactos = [
        ...seguimientos.map(s => ({ clientId: s.clientId, cuando: s.createdAt, quien: s.userName })),
        ...chats.flatMap(ch => ch.clientId && ch.messages[0] ? [{
            clientId: ch.clientId,
            cuando: ch.messages[0].createdAt,
            // "Teléfono" es el celular de la óptica, no una persona: sin nombre.
            quien: ch.messages[0].senderName === 'Teléfono' ? null : ch.messages[0].senderName,
        }] : []),
    ].sort((a, b) => b.cuando.getTime() - a.cuando.getTime());

    const ultimo = new Map<string, YaEscrito>();
    for (const c of contactos) {
        if (!ultimo.has(c.clientId)) ultimo.set(c.clientId, { cuando: c.cuando.toISOString(), quien: c.quien });
    }
    return ultimo;
}

/** A qué ficha apunta una oportunidad. Null si no hay (carrito sin datos) o si no existe. */
async function fichaDe(id: string, type: TipoCierre): Promise<string | null> {
    if (type === 'STALLED_FAVORITE' || type === 'SIN_PRESUPUESTO') {
        const c = await prisma.client.findUnique({ where: { id }, select: { id: true } });
        return c?.id ?? null;
    }
    if (type === 'PENDING_QUOTE') {
        const o = await prisma.order.findUnique({ where: { id }, select: { clientId: true } });
        return o?.clientId ?? null;
    }
    const s = await prisma.checkoutSession.findUnique({ where: { id } });
    return s ? (s.clientId ?? await ensureClientForAbandonedCart(s)) : null;
}

export const CierresService = {
    /** El panel entero, listo para mostrar. Solo lee. */
    async oportunidades(): Promise<Oportunidad[]> {
        const [a, b, c, d, compradores] = await Promise.all([
            favoritos(), presupuestos(), carritos(), fichasSinPresupuesto(), llavesDeCompradores(),
        ]);
        const candidatos = [...a, ...b, ...c, ...d].filter(o => {
            const t = llaveTelefono(o.phone), e = llaveEmail(o.email), n = llaveNombre(o.clientName);
            return !((t && compradores.has(`t:${t}`)) || (e && compradores.has(`e:${e}`)) || (n && compradores.has(`n:${n}`)));
        });
        const personas = agruparPorPersona(candidatos);
        const contactos = await ultimosContactos([...new Set(personas.flatMap(p => p.fichas))]);
        return armarPanel(personas, contactos);
    },

    /**
     * El ✓ del panel: se deja de perseguir a la PERSONA. Un presupuesto pasa a
     * LOST y un carrito a FINALIZED. Firmado en la ficha y en el AuditLog
     * (antes marcaba presupuestos como perdidos sin dejar AuditLog).
     */
    async finalizar(id: string, type: TipoCierre, actor: Actor): Promise<{ skipped?: string }> {
        let clientId: string | null = null;
        let detalle = '';

        if (type === 'STALLED_FAVORITE' || type === 'SIN_PRESUPUESTO') {
            clientId = await fichaDe(id, type);
            if (!clientId) return { skipped: 'La ficha no existe.' };
        } else if (type === 'PENDING_QUOTE') {
            // Solo un PRESUPUESTO pendiente puede marcarse perdido: un id viejo del
            // panel podía pisar con LOST una orden que ya se convirtió en venta.
            const order = await prisma.order.findUnique({ where: { id }, select: { clientId: true, orderType: true, status: true } });
            if (!order || order.orderType !== 'QUOTE' || !['PENDING', 'CONFIRMED'].includes(order.status)) {
                return { skipped: 'La orden ya no es un presupuesto pendiente; no se modificó.' };
            }
            await prisma.order.update({ where: { id }, data: { status: 'LOST' }, select: { id: true } });
            clientId = order.clientId;
            detalle = ', presupuesto marcado perdido';
        } else {
            const session = await prisma.checkoutSession.update({ where: { id }, data: { status: 'FINALIZED' }, select: { clientId: true } });
            clientId = session.clientId;
            detalle = ', carrito web descartado';
            // Todas las sesiones abiertas de la misma persona: si volvió al
            // checkout y generó otra, esa "reaparecía" lo que se creyó descartado.
            if (clientId) {
                await prisma.checkoutSession.updateMany({
                    where: { clientId, status: { in: CARRITO_ABIERTO } },
                    data: { status: 'FINALIZED' },
                });
            }
        }

        if (clientId) {
            // El descarte es de la PERSONA: sin esto reaparecía al día siguiente
            // como favorito sin actividad (descarte asimétrico).
            await prisma.client.update({ where: { id: clientId }, data: { opportunityDismissedAt: new Date() }, select: { id: true } });
            await prisma.interaction.create({
                data: {
                    clientId, type: 'NOTE',
                    content: `Seguimiento finalizado (Oportunidad de Cierre${detalle}) por ${actor.name}`,
                    userId: actor.id, userName: actor.name,
                },
            });
        }
        // Destructivo (un presupuesto pasa a perdido): se espera la fila.
        await logAudit({
            userId: actor.id, userName: actor.name,
            action: 'STATUS_CHANGE', entityType: type === 'PENDING_QUOTE' ? 'ORDER' : 'CONTACT',
            entityId: type === 'PENDING_QUOTE' ? id : (clientId ?? id),
            details: { origen: 'oportunidades-de-cierre', accion: 'finalizar', tipo: type, oportunidadId: id },
        });
        return {};
    },

    /**
     * "Ya le escribí": deja el seguimiento firmado en la ficha — es lo que
     * esconde la tarjeta 5 días. `via`: 'whatsapp' (el verde, con el texto),
     * 'copia' (copió el número para escribir desde su WhatsApp) o 'manual'.
     * Copiar y después marcar es UN seguimiento: si la misma persona ya lo
     * registró hace menos de 10 minutos, no se repite.
     */
    async registrarEscrito(
        params: { id: string; type: TipoCierre; via?: string; message?: string },
        actor: Actor,
    ): Promise<{ logged: boolean }> {
        const clientId = await fichaDe(params.id, params.type);
        if (!clientId) return { logged: false };

        const reciente = await prisma.interaction.findFirst({
            where: { clientId, type: 'FOLLOWUP', userId: actor.id, createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
            select: { id: true },
        });
        if (reciente) return { logged: false };

        const content =
            params.via === 'copia'
                ? `📋 ${actor.name} copió el número para escribirle por WhatsApp (Oportunidad de Cierre)`
                : params.via === 'manual'
                    ? `✍️ ${actor.name} marcó que ya le escribió (Oportunidad de Cierre)`
                    : `📲 Seguimiento de Oportunidad de Cierre enviado por WhatsApp por ${actor.name}${params.message ? `:\n"${params.message}"` : ''}`;
        await prisma.interaction.create({
            data: { clientId, type: 'FOLLOWUP', content, userId: actor.id, userName: actor.name },
        });
        logAudit({
            userId: actor.id, userName: actor.name, action: 'NOTIFY', entityType: 'CONTACT', entityId: clientId,
            details: { origen: 'oportunidades-de-cierre', via: params.via || 'whatsapp', tipo: params.type, oportunidadId: params.id },
        }).catch(console.error);
        return { logged: true };
    },
};
