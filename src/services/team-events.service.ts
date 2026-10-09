/**
 * NOVEDADES DEL EQUIPO: faltas, llegadas tarde, francos, vacaciones, cambios de
 * turno y pedidos especiales. Alimenta el calendario compartido.
 *
 * Toda la lógica vive acá; las rutas de /api/equipo/novedades validan, llaman y
 * responden. Las reglas de permiso, en pocas líneas:
 *  - TODOS (ADMIN y STAFF) ven TODO el calendario: es compartido a propósito,
 *    para que cada uno sepa quién está y quién no.
 *  - Un STAFF solo anota cosas PROPIAS y de los tipos que se piden (franco,
 *    vacaciones, cambio de turno, pedido especial): nacen PENDIENTE hasta que
 *    un ADMIN las aprueba o rechaza. Puede borrar las suyas mientras siguen
 *    pendientes.
 *  - Faltas y llegadas tarde las anota solo un ADMIN (son observaciones sobre
 *    el vendedor) y nacen REGISTRADO. Lo que anota un ADMIN para otro, nace
 *    APROBADO: no tiene sentido que se apruebe a sí mismo.
 *  - Editar, decidir y borrar lo ajeno: solo ADMIN.
 *
 * Las fechas son DÍAS, no instantes: se guardan a medianoche de Córdoba y la
 * hora puntual ("llega 11:30") va escrita en `horario`.
 */

import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import type { Actor } from '@/lib/actor';
import {
    TIPOS_NOVEDAD, TIPOS_QUE_SE_PIDEN, TIPOS_SOLO_ADMIN,
    type TipoNovedad, type EstadoNovedad,
} from '@/lib/constants/novedades-equipo';

const ROLES_INTERNOS = ['ADMIN', 'STAFF'];
const TZ_OFFSET = '-03:00'; // Córdoba no tiene horario de verano.

export class TeamEventsError extends Error {
    constructor(message: string, public status = 400) { super(message); }
}

/** "2026-10-08" → Date a medianoche de Córdoba. Rechaza cualquier otra cosa. */
function diaAFecha(dia: unknown, campo: string): Date {
    if (typeof dia !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) {
        throw new TeamEventsError(`${campo}: fecha inválida (se espera AAAA-MM-DD)`);
    }
    const d = new Date(`${dia}T00:00:00${TZ_OFFSET}`);
    if (isNaN(d.getTime())) throw new TeamEventsError(`${campo}: fecha inválida`);
    return d;
}

function esAdmin(actor: Actor) { return actor.role === 'ADMIN'; }

export interface NovedadInput {
    userId: string;
    type: TipoNovedad;
    desde: string;          // AAAA-MM-DD
    hasta?: string | null;  // AAAA-MM-DD, inclusive; default = desde
    horario?: string | null;
    justificada?: boolean | null;
    swapWithUserId?: string | null;
    notes?: string | null;
}

const SELECT = {
    id: true, userId: true, type: true, startsAt: true, endsAt: true, horario: true,
    status: true, justificada: true, swapWithUserId: true, notes: true,
    createdByName: true, decidedByName: true, decidedAt: true, createdAt: true,
    user: { select: { id: true, name: true } },
    swapWith: { select: { id: true, name: true } },
} as const;

export class TeamEventsService {

    /**
     * La planta del local: quienes figuran en feriados y calendario. Se marca
     * en Configuración → usuarios ("Planta del local"). Ishtar y Yani no
     * están porque no son planta permanente (8/10/2026).
     */
    static listarEquipo() {
        return prisma.user.findMany({
            where: { role: { in: ROLES_INTERNOS }, plantaLocal: true },
            select: { id: true, name: true, role: true },
            orderBy: { name: 'asc' },
        });
    }

    /** Todo lo que toca el rango [desde, hasta] (días inclusive). */
    static listar(desde: string, hasta: string, userId?: string | null) {
        const d = diaAFecha(desde, 'desde');
        const h = diaAFecha(hasta, 'hasta');
        if (h < d) throw new TeamEventsError('"hasta" es anterior a "desde"');
        return prisma.teamEvent.findMany({
            where: {
                startsAt: { lte: h },
                endsAt: { gte: d },
                ...(userId ? { userId } : {}),
            },
            select: SELECT,
            orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }],
        });
    }

    /** Lo que espera un OK (para el aviso del admin). */
    static pendientes() {
        return prisma.teamEvent.findMany({
            where: { status: 'PENDIENTE' },
            select: SELECT,
            orderBy: { startsAt: 'asc' },
        });
    }

    static async crear(input: NovedadInput, actor: Actor) {
        if (!actor.id) throw new TeamEventsError('Sin sesión', 401);
        if (!TIPOS_NOVEDAD.includes(input.type)) throw new TeamEventsError('Tipo inválido');
        if (!input.userId) throw new TeamEventsError('Falta la persona');

        const admin = esAdmin(actor);
        const propio = input.userId === actor.id;
        if (!admin && !propio) throw new TeamEventsError('Solo podés anotar novedades propias', 403);
        if (!admin && TIPOS_SOLO_ADMIN.includes(input.type)) {
            throw new TeamEventsError('Las faltas y llegadas tarde las anota un administrador', 403);
        }

        const persona = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true, name: true, role: true } });
        if (!persona || !ROLES_INTERNOS.includes(persona.role)) throw new TeamEventsError('Esa persona no es del equipo', 404);

        const startsAt = diaAFecha(input.desde, 'desde');
        const endsAt = input.hasta ? diaAFecha(input.hasta, 'hasta') : startsAt;
        if (endsAt < startsAt) throw new TeamEventsError('"hasta" es anterior a "desde"');

        let swapWithUserId: string | null = null;
        if (input.type === 'CAMBIO_TURNO' && input.swapWithUserId) {
            if (input.swapWithUserId === input.userId) throw new TeamEventsError('No se puede cambiar el turno con uno mismo');
            const otro = await prisma.user.findUnique({ where: { id: input.swapWithUserId }, select: { id: true, role: true } });
            if (!otro || !ROLES_INTERNOS.includes(otro.role)) throw new TeamEventsError('La otra persona no es del equipo', 404);
            swapWithUserId = otro.id;
        }

        // Un hecho (falta) queda REGISTRADO. Un pedido queda PENDIENTE si lo
        // hace el interesado, y APROBADO si lo carga un admin para otro.
        let status: EstadoNovedad = 'REGISTRADO';
        if (TIPOS_QUE_SE_PIDEN.includes(input.type)) status = admin && !propio ? 'APROBADO' : 'PENDIENTE';
        if (admin && propio && TIPOS_QUE_SE_PIDEN.includes(input.type)) status = 'APROBADO';

        const ev = await prisma.teamEvent.create({
            data: {
                userId: persona.id,
                type: input.type,
                startsAt, endsAt,
                horario: input.horario?.trim() || null,
                status,
                justificada: TIPOS_SOLO_ADMIN.includes(input.type) ? (input.justificada ?? null) : null,
                swapWithUserId,
                notes: input.notes?.trim() || null,
                createdById: actor.id,
                createdByName: actor.name,
                ...(status === 'APROBADO' ? { decidedById: actor.id, decidedByName: actor.name, decidedAt: new Date() } : {}),
            },
            select: SELECT,
        });

        logAudit({
            userId: actor.id, userName: actor.name, action: 'CREATE', entityType: 'TEAM_EVENT', entityId: ev.id,
            details: { persona: persona.name, type: ev.type, desde: input.desde, hasta: input.hasta || input.desde, status },
        }).catch(console.error);

        return ev;
    }

    /** Edición de campos (no del estado): solo ADMIN, o el dueño mientras está PENDIENTE. */
    static async editar(id: string, cambios: Partial<NovedadInput>, actor: Actor) {
        if (!actor.id) throw new TeamEventsError('Sin sesión', 401);
        const ev = await prisma.teamEvent.findUnique({ where: { id }, select: { id: true, userId: true, status: true, type: true, startsAt: true, endsAt: true } });
        if (!ev) throw new TeamEventsError('No existe', 404);
        const admin = esAdmin(actor);
        if (!admin && !(ev.userId === actor.id && ev.status === 'PENDIENTE')) throw new TeamEventsError('No podés editar esta novedad', 403);

        const data: Record<string, unknown> = {};
        if (cambios.desde !== undefined) data.startsAt = diaAFecha(cambios.desde, 'desde');
        if (cambios.hasta !== undefined && cambios.hasta !== null) data.endsAt = diaAFecha(cambios.hasta, 'hasta');
        const s = (data.startsAt as Date) ?? ev.startsAt;
        const e = (data.endsAt as Date) ?? ev.endsAt;
        if (e < s) throw new TeamEventsError('"hasta" es anterior a "desde"');
        if (cambios.horario !== undefined) data.horario = cambios.horario?.trim() || null;
        if (cambios.notes !== undefined) data.notes = cambios.notes?.trim() || null;
        if (cambios.justificada !== undefined && admin && TIPOS_SOLO_ADMIN.includes(ev.type as TipoNovedad)) data.justificada = cambios.justificada;
        if (cambios.type !== undefined) {
            if (!TIPOS_NOVEDAD.includes(cambios.type)) throw new TeamEventsError('Tipo inválido');
            if (!admin && TIPOS_SOLO_ADMIN.includes(cambios.type)) throw new TeamEventsError('Ese tipo lo anota un administrador', 403);
            data.type = cambios.type;
        }
        if (cambios.swapWithUserId !== undefined) data.swapWithUserId = cambios.swapWithUserId || null;

        const out = await prisma.teamEvent.update({ where: { id }, data, select: SELECT });
        logAudit({ userId: actor.id, userName: actor.name, action: 'UPDATE', entityType: 'TEAM_EVENT', entityId: id, details: cambios }).catch(console.error);
        return out;
    }

    /** Aprobar o rechazar un pedido: solo ADMIN. */
    static async decidir(id: string, status: 'APROBADO' | 'RECHAZADO', actor: Actor) {
        if (!actor.id) throw new TeamEventsError('Sin sesión', 401);
        if (!esAdmin(actor)) throw new TeamEventsError('Solo un administrador aprueba o rechaza', 403);
        if (status !== 'APROBADO' && status !== 'RECHAZADO') throw new TeamEventsError('Estado inválido');
        const ev = await prisma.teamEvent.findUnique({ where: { id }, select: { id: true, user: { select: { name: true } } } });
        if (!ev) throw new TeamEventsError('No existe', 404);
        const out = await prisma.teamEvent.update({
            where: { id },
            data: { status, decidedById: actor.id, decidedByName: actor.name, decidedAt: new Date() },
            select: SELECT,
        });
        logAudit({ userId: actor.id, userName: actor.name, action: 'STATUS_CHANGE', entityType: 'TEAM_EVENT', entityId: id, details: { persona: ev.user.name, status } }).catch(console.error);
        return out;
    }

    static async borrar(id: string, actor: Actor) {
        if (!actor.id) throw new TeamEventsError('Sin sesión', 401);
        const ev = await prisma.teamEvent.findUnique({ where: { id }, select: SELECT });
        if (!ev) throw new TeamEventsError('No existe', 404);
        const admin = esAdmin(actor);
        if (!admin && !(ev.userId === actor.id && ev.status === 'PENDIENTE')) throw new TeamEventsError('No podés borrar esta novedad', 403);
        await prisma.teamEvent.delete({ where: { id } });
        // Borrado: se espera el audit para que quede commiteado antes de responder.
        await logAudit({
            userId: actor.id, userName: actor.name, action: 'DELETE', entityType: 'TEAM_EVENT', entityId: id,
            details: { persona: ev.user.name, type: ev.type, startsAt: ev.startsAt, endsAt: ev.endsAt, status: ev.status, notes: ev.notes },
        });
    }
}

// ---------------------------------------------------------------------------
// COBERTURA DE FERIADOS: por feriado y persona, si vino y en qué horario.
// Solo la carga un ADMIN; todos la ven.
// ---------------------------------------------------------------------------

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface CoberturaInput {
    fecha: string;          // AAAA-MM-DD
    userId: string;
    worked: boolean;
    startTime?: string | null;
    endTime?: string | null;
    notes?: string | null;
}

const SELECT_COBERTURA = {
    id: true, fecha: true, userId: true, worked: true, startTime: true, endTime: true, notes: true,
    createdByName: true, updatedAt: true, user: { select: { id: true, name: true } },
} as const;

export class HolidayShiftsService {
    static listar(desde: string, hasta: string) {
        return prisma.holidayShift.findMany({
            where: { fecha: { gte: diaAFecha(desde, 'desde'), lte: diaAFecha(hasta, 'hasta') } },
            select: SELECT_COBERTURA,
            orderBy: [{ fecha: 'asc' }, { user: { name: 'asc' } }],
        });
    }

    /** Crea o pisa la cobertura de esa persona en ese día (una sola fila por par). */
    static async guardar(input: CoberturaInput, actor: Actor) {
        if (!actor.id) throw new TeamEventsError('Sin sesión', 401);
        if (!esAdmin(actor)) throw new TeamEventsError('Solo un administrador carga la cobertura de feriados', 403);
        const fecha = diaAFecha(input.fecha, 'fecha');
        if (typeof input.worked !== 'boolean') throw new TeamEventsError('Falta si cubrió o no');
        const persona = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true, name: true, role: true } });
        if (!persona || !ROLES_INTERNOS.includes(persona.role)) throw new TeamEventsError('Esa persona no es del equipo', 404);

        let startTime: string | null = null, endTime: string | null = null;
        if (input.worked) {
            startTime = input.startTime?.trim() || null;
            endTime = input.endTime?.trim() || null;
            for (const h of [startTime, endTime]) if (h && !HORA_RE.test(h)) throw new TeamEventsError(`Hora inválida: ${h} (usar HH:MM)`);
            if (startTime && endTime && endTime <= startTime) throw new TeamEventsError('La hora de salida tiene que ser después de la de entrada');
        }
        const data = { worked: input.worked, startTime, endTime, notes: input.notes?.trim() || null, createdById: actor.id, createdByName: actor.name };
        const fila = await prisma.holidayShift.upsert({
            where: { fecha_userId: { fecha, userId: persona.id } },
            create: { fecha, userId: persona.id, ...data },
            update: data,
            select: SELECT_COBERTURA,
        });
        logAudit({ userId: actor.id, userName: actor.name, action: 'UPDATE', entityType: 'HOLIDAY_SHIFT', entityId: fila.id, details: { persona: persona.name, fecha: input.fecha, ...data } }).catch(console.error);
        return fila;
    }

    /** Vuelve a "sin cargar". */
    static async borrar(fecha: string, userId: string, actor: Actor) {
        if (!actor.id) throw new TeamEventsError('Sin sesión', 401);
        if (!esAdmin(actor)) throw new TeamEventsError('Solo un administrador', 403);
        const f = diaAFecha(fecha, 'fecha');
        const fila = await prisma.holidayShift.findUnique({ where: { fecha_userId: { fecha: f, userId } }, select: SELECT_COBERTURA });
        if (!fila) return;
        await prisma.holidayShift.delete({ where: { id: fila.id } });
        await logAudit({ userId: actor.id, userName: actor.name, action: 'DELETE', entityType: 'HOLIDAY_SHIFT', entityId: fila.id, details: { persona: fila.user.name, fecha, worked: fila.worked, startTime: fila.startTime, endTime: fila.endTime } });
    }
}
