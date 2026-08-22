/**
 * MENSAJERÍA INTERNA entre colaboradores.
 *
 * TODA la lógica vive acá: las rutas de `/api/mensajes` validan, llaman a este
 * service y responden. Ninguna ruta habla con `prisma` por su cuenta — es la
 * regla de arquitectura del proyecto, y acá importa más que en otros lados
 * porque este service es el ÚNICO lugar donde se decide quién puede leer qué.
 *
 * LA REGLA DE PRIVACIDAD, en una línea: se ve una conversación si y solo si sos
 * participante de ella. No hay excepción por rol — un ADMIN tampoco lee los
 * mensajes ajenos. Esa decisión se toma en `assertParticipante()` y todas las
 * lecturas pasan por ahí; si algún día alguien agrega una función que consulta
 * mensajes sin llamarla, se rompe la privacidad de todo el sistema.
 *
 * Lo que reemplaza: `TeamMessage`, un muro global de dos personas con los
 * teléfonos escritos en el código y un `sender` que era un string suelto.
 */

import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import type { Actor } from '@/lib/actor';

/** Tipos de conversación. */
export const THREAD_KINDS = ['DIRECT', 'GROUP', 'ANNOUNCEMENT'] as const;
export type ThreadKind = (typeof THREAD_KINDS)[number];

/** Rol dentro de una conversación. CC = está en copia, ve todo pero no es destinatario. */
export const PARTICIPANT_ROLES = ['MEMBER', 'CC'] as const;
export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];

/**
 * Los roles que participan de la mensajería interna.
 *
 * `OPTICA` queda AFUERA a propósito: son cuentas de ópticas mayoristas —
 * clientes, no colaboradores. Sin este filtro, el selector de destinatarios
 * mostraría clientes junto al equipo y bastaría un clic mal dado para mandarle
 * una conversación interna a un cliente.
 */
const ROLES_INTERNOS = ['ADMIN', 'STAFF'];

/** Tope de mensajes por página. Evita que una conversación larga traiga todo. */
const PAGINA = 50;

/**
 * Cuánto vale una señal de vida antes de considerar que la persona se fue.
 *
 * El latido llega cada 20 s: 90 s tolera dos latidos perdidos (una pestaña en
 * segundo plano que el navegador frenó, un pico de red) sin apagar el puntito
 * verde de alguien que sigue trabajando. Más corto parpadea; mucho más largo
 * muestra "en línea" a quien ya cerró todo.
 */
const VENTANA_EN_LINEA_MS = 90 * 1000;

export class InternalMessagingService {

    /** Los colaboradores a los que se les puede escribir. */
    static async listarColaboradores(excluirUserId?: string | null) {
        return prisma.user.findMany({
            where: {
                role: { in: ROLES_INTERNOS },
                ...(excluirUserId ? { id: { not: excluirUserId } } : {}),
            },
            select: { id: true, name: true, role: true },
            orderBy: { name: 'asc' },
        });
    }

    /**
     * Verifica que el usuario participe de la conversación y devuelve su fila de
     * participante. Lanza si no. Es la única puerta de entrada a una conversación:
     * toda lectura y toda escritura pasan por acá.
     */
    private static async assertParticipante(threadId: string, userId: string) {
        const p = await prisma.internalThreadParticipant.findUnique({
            where: { threadId_userId: { threadId, userId } },
        });
        // Mismo error para "no existe" y "no sos participante": si dijéramos
        // "esa conversación no es tuya" estaríamos confirmando que existe, y
        // con eso se puede mapear con quién habla el resto probando ids.
        if (!p || p.leftAt) throw new Error('Conversación no encontrada');
        return p;
    }

    /**
     * La bandeja de entrada de una persona: sus conversaciones, la última línea
     * de cada una y cuántos mensajes tiene sin leer.
     */
    static async bandeja(userId: string) {
        const participaciones = await prisma.internalThreadParticipant.findMany({
            where: { userId, leftAt: null },
            select: {
                role: true,
                lastReadAt: true,
                thread: {
                    select: {
                        id: true, kind: true, subject: true, lastMessageAt: true,
                        participants: {
                            where: { leftAt: null },
                            select: { role: true, user: { select: { id: true, name: true } } },
                        },
                        messages: {
                            orderBy: { createdAt: 'desc' },
                            take: 1,
                            select: { body: true, createdAt: true, sender: { select: { id: true, name: true } } },
                        },
                    },
                },
            },
        });

        // Los no leídos se CUENTAN contra la marca de lectura, no se llevan en un
        // contador incrementado a mano: un contador que se desincroniza miente
        // para siempre y no hay forma de que se arregle solo. Esto se recalcula
        // en cada carga y por definición no puede quedar mal.
        const conNoLeidos = await Promise.all(participaciones.map(async (p) => {
            const noLeidos = await prisma.internalMessage.count({
                where: {
                    threadId: p.thread.id,
                    // Los propios nunca cuentan como no leídos.
                    senderId: { not: userId },
                    ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {}),
                },
            });
            const ultimo = p.thread.messages[0] || null;
            return {
                id: p.thread.id,
                kind: p.thread.kind,
                subject: p.thread.subject,
                lastMessageAt: p.thread.lastMessageAt,
                miRol: p.role,
                noLeidos,
                participantes: p.thread.participants.map(x => ({
                    id: x.user.id, name: x.user.name, role: x.role,
                })),
                ultimoMensaje: ultimo && {
                    body: ultimo.body,
                    createdAt: ultimo.createdAt,
                    senderId: ultimo.sender.id,
                    senderName: ultimo.sender.name,
                },
            };
        }));

        conNoLeidos.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
        return conNoLeidos;
    }

    /** Cuántos mensajes sin leer tiene la persona en total (para la campanita). */
    static async contarNoLeidos(userId: string): Promise<number> {
        const participaciones = await prisma.internalThreadParticipant.findMany({
            where: { userId, leftAt: null },
            select: { threadId: true, lastReadAt: true },
        });
        if (participaciones.length === 0) return 0;

        // Un OR por conversación en UNA sola consulta: con N conversaciones
        // sería N consultas por cada refresco del badge, en cada pestaña abierta.
        const total = await prisma.internalMessage.count({
            where: {
                senderId: { not: userId },
                OR: participaciones.map(p => ({
                    threadId: p.threadId,
                    ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {}),
                })),
            },
        });
        return total;
    }

    /** Los mensajes de una conversación. Marca como leído de paso. */
    static async leerConversacion(threadId: string, userId: string, opts: { antesDe?: Date } = {}) {
        await this.assertParticipante(threadId, userId);

        const thread = await prisma.internalThread.findUnique({
            where: { id: threadId },
            select: {
                id: true, kind: true, subject: true, createdAt: true,
                participants: {
                    where: { leftAt: null },
                    select: { role: true, lastReadAt: true, user: { select: { id: true, name: true } } },
                },
            },
        });
        if (!thread) throw new Error('Conversación no encontrada');

        const mensajes = await prisma.internalMessage.findMany({
            where: { threadId, ...(opts.antesDe ? { createdAt: { lt: opts.antesDe } } : {}) },
            orderBy: { createdAt: 'desc' },
            take: PAGINA,
            select: {
                id: true, body: true, createdAt: true, editedAt: true,
                sender: { select: { id: true, name: true } },
            },
        });

        // Marcar leído DESPUÉS de traerlos: si se marcara antes y la consulta de
        // mensajes fallara, quedarían dados por leídos sin que nadie los viera.
        await this.marcarLeido(threadId, userId);

        return {
            id: thread.id,
            kind: thread.kind,
            subject: thread.subject,
            participantes: thread.participants.map(p => ({
                id: p.user.id, name: p.user.name, role: p.role,
            })),
            // Se devuelven en orden cronológico, que es como se leen.
            mensajes: mensajes.reverse().map(m => ({
                id: m.id, body: m.body, createdAt: m.createdAt, editedAt: m.editedAt,
                senderId: m.sender.id, senderName: m.sender.name,
            })),
            hayMas: mensajes.length === PAGINA,
        };
    }

    /** Mueve la marca de lectura al momento actual. */
    static async marcarLeido(threadId: string, userId: string) {
        await prisma.internalThreadParticipant.updateMany({
            where: { threadId, userId },
            data: { lastReadAt: new Date() },
        });
    }

    /**
     * Crea una conversación. Si es DIRECT y ya existe una entre esas dos
     * personas, devuelve la que hay: sin esto, cada mensaje a la misma persona
     * abriría una conversación nueva y la bandeja se llenaría de hilos sueltos
     * con un mensaje cada uno.
     */
    static async crearConversacion(params: {
        creadorId: string;
        paraIds: string[];
        copiaIds?: string[];
        subject?: string | null;
        kind?: ThreadKind;
        primerMensaje: string;
        urgent?: boolean;
    }, actor?: Actor) {
        const { creadorId, primerMensaje } = params;
        const cuerpo = (primerMensaje || '').trim();
        if (!cuerpo) throw new Error('El mensaje no puede estar vacío');

        const paraIds = [...new Set((params.paraIds || []).filter(id => id && id !== creadorId))];
        const copiaIds = [...new Set((params.copiaIds || []).filter(id => id && id !== creadorId && !paraIds.includes(id)))];
        if (paraIds.length === 0) throw new Error('Hay que elegir al menos un destinatario');

        // Los destinatarios tienen que ser colaboradores reales y activos. Se
        // valida contra la base y no contra lo que mandó el navegador: si no,
        // bastaría con editar el pedido para meter en la conversación a una
        // cuenta de óptica mayorista (un cliente).
        const validos = await prisma.user.findMany({
            where: { id: { in: [...paraIds, ...copiaIds] }, role: { in: ROLES_INTERNOS } },
            select: { id: true },
        });
        const validosSet = new Set(validos.map(v => v.id));
        const paraOk = paraIds.filter(id => validosSet.has(id));
        const copiaOk = copiaIds.filter(id => validosSet.has(id));
        if (paraOk.length === 0) throw new Error('Ningún destinatario válido');

        const kind: ThreadKind = params.kind
            ?? (paraOk.length + copiaOk.length === 1 ? 'DIRECT' : 'GROUP');

        // Reusar el directo existente (ver el comentario del encabezado).
        if (kind === 'DIRECT' && paraOk.length === 1 && copiaOk.length === 0) {
            const existente = await prisma.internalThread.findFirst({
                where: {
                    kind: 'DIRECT',
                    AND: [
                        { participants: { some: { userId: creadorId, leftAt: null } } },
                        { participants: { some: { userId: paraOk[0], leftAt: null } } },
                    ],
                },
                select: { id: true, participants: { where: { leftAt: null }, select: { id: true } } },
            });
            // `some` + `some` no garantiza que sean SOLO esos dos: un grupo que
            // los incluya a ambos también matchea. Se exige que tenga exactamente 2.
            if (existente && existente.participants.length === 2) {
                await this.responder({ threadId: existente.id, senderId: creadorId, body: cuerpo, urgent: !!params.urgent });
                return { id: existente.id, reusada: true };
            }
        }

        const ahora = new Date();
        const thread = await prisma.$transaction(async (tx) => {
            const t = await tx.internalThread.create({
                data: {
                    kind,
                    subject: params.subject?.trim() || null,
                    createdById: creadorId,
                    lastMessageAt: ahora,
                    participants: {
                        create: [
                            { userId: creadorId, role: 'MEMBER', lastReadAt: ahora },
                            ...paraOk.map(id => ({ userId: id, role: 'MEMBER' })),
                            ...copiaOk.map(id => ({ userId: id, role: 'CC' })),
                        ],
                    },
                },
                select: { id: true },
            });
            await tx.internalMessage.create({
                data: { threadId: t.id, senderId: creadorId, body: cuerpo, urgent: !!params.urgent, createdAt: ahora },
            });
            return t;
        });

        logAudit({
            userId: actor?.id ?? creadorId,
            userName: actor?.name ?? null,
            action: 'CREATE',
            entityType: 'OTHER',
            entityId: thread.id,
            details: { tipo: 'InternalThread', kind, para: paraOk, copia: copiaOk, subject: params.subject || null, urgent: !!params.urgent },
        }).catch(console.error);

        return { id: thread.id, reusada: false };
    }

    /** Responde en una conversación existente. */
    static async responder(params: { threadId: string; senderId: string; body: string; urgent?: boolean }) {
        const { threadId, senderId } = params;
        const cuerpo = (params.body || '').trim();
        if (!cuerpo) throw new Error('El mensaje no puede estar vacío');

        await this.assertParticipante(threadId, senderId);

        const ahora = new Date();
        const mensaje = await prisma.$transaction(async (tx) => {
            const m = await tx.internalMessage.create({
                data: { threadId, senderId, body: cuerpo, urgent: !!params.urgent, createdAt: ahora },
                select: { id: true, body: true, urgent: true, createdAt: true },
            });
            // `lastMessageAt` ordena la bandeja: se mueve en la MISMA transacción
            // que el mensaje, para que no exista un instante en que el mensaje ya
            // esté guardado y la conversación siga apareciendo abajo de todo.
            await tx.internalThread.update({
                where: { id: threadId },
                data: { lastMessageAt: ahora },
            });
            // Quien escribe ya leyó lo suyo.
            await tx.internalThreadParticipant.updateMany({
                where: { threadId, userId: senderId },
                data: { lastReadAt: ahora },
            });
            return m;
        });

        return mensaje;
    }

    // ── URGENTES ────────────────────────────────────────────────────────────
    //
    // Un urgente le tapa la pantalla al destinatario hasta que lo lee. Por eso
    // "pendiente" se define exactamente igual que "sin leer": un urgente deja de
    // gritar cuando se abre la conversación, y no hay un segundo estado de
    // "visto el pop-up" que pueda quedar desincronizado del de lectura. Un solo
    // concepto, imposible de contradecirse.

    /** Los urgentes que esta persona todavía no leyó. Los muestra el pop-up. */
    static async urgentesPendientes(userId: string) {
        const participaciones = await prisma.internalThreadParticipant.findMany({
            where: { userId, leftAt: null },
            select: { threadId: true, lastReadAt: true },
        });
        if (participaciones.length === 0) return [];

        const mensajes = await prisma.internalMessage.findMany({
            where: {
                urgent: true,
                senderId: { not: userId },
                OR: participaciones.map(p => ({
                    threadId: p.threadId,
                    ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {}),
                })),
            },
            orderBy: { createdAt: 'desc' },
            // Si hay una avalancha, se muestran los últimos y no se cuelga la
            // pantalla con cincuenta globos.
            take: 5,
            select: {
                id: true, body: true, createdAt: true, threadId: true,
                sender: { select: { id: true, name: true } },
                thread: { select: { subject: true } },
            },
        });

        return mensajes.map(m => ({
            id: m.id,
            threadId: m.threadId,
            body: m.body,
            createdAt: m.createdAt,
            senderName: m.sender.name,
            subject: m.thread.subject,
        }));
    }

    // ── PRESENCIA ───────────────────────────────────────────────────────────

    /**
     * "Sigo acá". Lo llama el latido de la barra lateral.
     *
     * `updateMany` y no `update`: si el usuario del token ya no existe en la
     * base (borrado con la sesión abierta), `update` lanza y rompería el latido
     * — y con él la campanita y el pop-up de urgentes. `updateMany` sobre cero
     * filas no hace nada y sigue de largo.
     */
    static async latido(userId: string) {
        await prisma.user.updateMany({
            where: { id: userId },
            data: { lastSeenAt: new Date() },
        });
    }

    /** Quiénes están en línea ahora mismo. */
    static async enLinea(): Promise<string[]> {
        const desde = new Date(Date.now() - VENTANA_EN_LINEA_MS);
        const users = await prisma.user.findMany({
            where: { role: { in: ROLES_INTERNOS }, lastSeenAt: { gte: desde } },
            select: { id: true },
        });
        return users.map(u => u.id);
    }

    // ── LA IA QUE ESCRIBE ───────────────────────────────────────────────────
    //
    // Para mandar un mensaje hace falta un remitente, y `senderId` apunta a
    // User. Así que la IA ES un usuario, con rol 'SISTEMA': queda FUERA de
    // `ROLES_INTERNOS`, o sea que puede escribir pero no aparece en el selector
    // de destinatarios — nadie le puede "responder" a un robot por error.

    static readonly IA_EMAIL = 'asistente@atelier.local';
    static readonly IA_NOMBRE = 'Asistente';

    /** Devuelve el usuario-IA, creándolo la primera vez. */
    static async usuarioIA() {
        const existente = await prisma.user.findUnique({
            where: { email: this.IA_EMAIL }, select: { id: true },
        });
        if (existente) return existente;
        return prisma.user.create({
            data: {
                email: this.IA_EMAIL,
                name: this.IA_NOMBRE,
                role: 'SISTEMA',
                // Sin contraseña utilizable: no es una cuenta para entrar. El
                // login compara con bcrypt y este valor no es un hash válido,
                // así que ninguna contraseña puede coincidir.
                password: 'NO-LOGIN',
            },
            select: { id: true },
        });
    }

    /**
     * La IA le escribe a una persona. Reusa SIEMPRE la misma conversación con
     * cada uno: si abriera una nueva por reporte, en un mes la bandeja tendría
     * treinta hilos del asistente y ninguno de sus compañeros a la vista.
     */
    static async mensajeDeIA(params: {
        paraUserId: string; cuerpo: string; asunto?: string; urgent?: boolean;
    }) {
        const ia = await this.usuarioIA();
        if (ia.id === params.paraUserId) return null;

        const existente = await prisma.internalThread.findFirst({
            where: {
                kind: 'DIRECT',
                AND: [
                    { participants: { some: { userId: ia.id, leftAt: null } } },
                    { participants: { some: { userId: params.paraUserId, leftAt: null } } },
                ],
            },
            select: { id: true, participants: { where: { leftAt: null }, select: { id: true } } },
        });

        if (existente && existente.participants.length === 2) {
            return this.responder({
                threadId: existente.id, senderId: ia.id,
                body: params.cuerpo, urgent: params.urgent,
            });
        }

        const ahora = new Date();
        const t = await prisma.internalThread.create({
            data: {
                kind: 'DIRECT',
                subject: params.asunto || 'Resumen del día',
                createdById: ia.id,
                lastMessageAt: ahora,
                participants: {
                    create: [
                        { userId: ia.id, role: 'MEMBER', lastReadAt: ahora },
                        { userId: params.paraUserId, role: 'MEMBER' },
                    ],
                },
            },
            select: { id: true },
        });
        return prisma.internalMessage.create({
            data: { threadId: t.id, senderId: ia.id, body: params.cuerpo, urgent: !!params.urgent },
            select: { id: true },
        });
    }

    // ── RESUMEN DIARIO ──────────────────────────────────────────────────────

    /**
     * Lo que hizo una persona en un rango. Los números que pidió la dueña:
     * a cuántos clientes les armó presupuesto, cuántas tareas cerró y cuántas
     * abrió.
     *
     * OJO con el desparejo del modelo: los presupuestos se atribuyen por
     * `Order.userId` (una clave real), pero las tareas guardan el NOMBRE en
     * `createdBy` / `completedBy` (texto suelto). Por eso hace falta el nombre
     * además del id — y por eso, si a alguien le cambian el nombre, sus tareas
     * viejas dejan de contarle. Es deuda del modelo, no de este cálculo.
     */
    static async actividadDe(userId: string, userName: string, desde: Date, hasta: Date) {
        const [presupuestos, tareasCerradas, tareasCreadas] = await Promise.all([
            // DISTINCT por cliente: dos presupuestos a la misma persona son un
            // cliente presupuestado, no dos. Es lo que se preguntó ("a cuántos
            // clientes le armaron presupuestos").
            prisma.order.findMany({
                where: {
                    userId, orderType: 'QUOTE', isDeleted: false,
                    createdAt: { gte: desde, lt: hasta },
                },
                select: { clientId: true },
                distinct: ['clientId'],
            }).then(r => r.length),

            prisma.clientTask.count({
                where: { completedBy: userName, completedAt: { gte: desde, lt: hasta } },
            }),

            prisma.clientTask.count({
                where: { createdBy: userName, createdAt: { gte: desde, lt: hasta } },
            }),
        ]);

        return { presupuestos, tareasCerradas, tareasCreadas };
    }

    /** Suma a alguien a una conversación en curso (como destinatario o en copia). */
    static async agregarParticipante(params: {
        threadId: string; porUserId: string; nuevoUserId: string; role?: ParticipantRole;
    }, actor?: Actor) {
        const { threadId, porUserId, nuevoUserId } = params;
        await this.assertParticipante(threadId, porUserId);

        const user = await prisma.user.findFirst({
            where: { id: nuevoUserId, role: { in: ROLES_INTERNOS } },
            select: { id: true, name: true },
        });
        if (!user) throw new Error('Ese usuario no puede participar de conversaciones internas');

        // Si estuvo antes y se fue, vuelve a entrar (no se duplica la fila).
        await prisma.internalThreadParticipant.upsert({
            where: { threadId_userId: { threadId, userId: nuevoUserId } },
            create: { threadId, userId: nuevoUserId, role: params.role || 'MEMBER' },
            update: { leftAt: null, role: params.role || 'MEMBER' },
        });

        // Un grupo dejó de ser una conversación de a dos.
        await prisma.internalThread.updateMany({
            where: { id: threadId, kind: 'DIRECT' },
            data: { kind: 'GROUP' },
        });

        logAudit({
            userId: actor?.id ?? porUserId,
            userName: actor?.name ?? null,
            action: 'UPDATE',
            entityType: 'OTHER',
            entityId: threadId,
            details: { tipo: 'InternalThread', agregado: user.name, role: params.role || 'MEMBER' },
        }).catch(console.error);

        return { ok: true };
    }
}
