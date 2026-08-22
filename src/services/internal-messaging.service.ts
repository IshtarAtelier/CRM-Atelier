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
     * La llave del par para una conversación uno-a-uno: los dos ids ordenados.
     * Determinística — A,B y B,A dan lo mismo — que es lo que hace que el
     * constraint único de la base sirva de algo.
     */
    private static llaveDirecta(a: string, b: string): string {
        return [a, b].sort().join(':');
    }

    /**
     * Abre (o reusa) la conversación uno-a-uno entre dos personas y deja un
     * mensaje. Estaba escrito dos veces —para humanos y para la IA— con la
     * diferencia de que la copia de la IA creaba el hilo FUERA de transacción:
     * si fallaba el mensaje, quedaba un hilo vacío en la bandeja de alguien.
     *
     * La carrera se resuelve en la base: si dos peticiones simultáneas intentan
     * crear el mismo par, la segunda choca contra el índice único y cae al
     * `catch`, que reintenta como respuesta en el hilo que acaba de ganar.
     */
    private static async escribirEnDirecto(params: {
        deId: string; paraId: string; cuerpo: string; asunto?: string | null; urgent?: boolean;
    }) {
        const key = this.llaveDirecta(params.deId, params.paraId);
        const existente = await prisma.internalThread.findUnique({
            where: { directKey: key }, select: { id: true },
        });
        if (existente) {
            await this.responder({
                threadId: existente.id, senderId: params.deId,
                body: params.cuerpo, urgent: params.urgent,
            });
            return { id: existente.id, nuevo: false };
        }

        const ahora = new Date();
        try {
            return await prisma.$transaction(async (tx) => {
                const t = await tx.internalThread.create({
                    data: {
                        kind: 'DIRECT', directKey: key,
                        subject: params.asunto?.trim() || null,
                        createdById: params.deId, lastMessageAt: ahora,
                        participants: {
                            // `createdAt: ahora` EXPLÍCITO, igual que el del
                            // mensaje. Con el default de la base el participante
                            // nace unos microsegundos después, y el corte de
                            // historial (`gte: participante.createdAt`) dejaba
                            // afuera justo el primer mensaje: el destinatario
                            // abría la conversación vacía.
                            create: [
                                { userId: params.deId, role: 'MEMBER', lastReadAt: ahora, createdAt: ahora },
                                { userId: params.paraId, role: 'MEMBER', createdAt: ahora },
                            ],
                        },
                    },
                    select: { id: true },
                });
                await tx.internalMessage.create({
                    data: {
                        threadId: t.id, senderId: params.deId, body: params.cuerpo,
                        urgent: !!params.urgent, createdAt: ahora,
                    },
                });
                return { id: t.id, nuevo: true };
            });
        } catch (e: any) {
            // P2002 = violación de unicidad: otra petición creó el mismo par en
            // el instante entre nuestro findUnique y el create. Se escribe en el
            // hilo que ganó, en vez de tirarle un error a quien solo quería
            // mandar un mensaje.
            if (e?.code !== 'P2002') throw e;
            const ganador = await prisma.internalThread.findUnique({
                where: { directKey: key }, select: { id: true },
            });
            if (!ganador) throw e;
            await this.responder({
                threadId: ganador.id, senderId: params.deId,
                body: params.cuerpo, urgent: params.urgent,
            });
            return { id: ganador.id, nuevo: false };
        }
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
     * EL FILTRO DE "SIN LEER", en un solo lugar.
     *
     * Antes esta expresión estaba escrita tres veces —`bandeja`,
     * `contarNoLeidos` y `urgentesPendientes`— y las tres tenían que decir lo
     * mismo para que el número del badge, el de la bandeja y la aparición del
     * pop-up no se contradijeran. El encabezado de urgentes afirma que
     * "pendiente" y "sin leer" son el MISMO concepto: acá eso deja de ser una
     * promesa del comentario y pasa a ser un hecho del código.
     *
     * Devuelve null si la persona no participa de ninguna conversación.
     */
    private static async filtroNoLeidos(userId: string) {
        const participaciones = await prisma.internalThreadParticipant.findMany({
            where: { userId, leftAt: null },
            select: { threadId: true, lastReadAt: true },
        });
        if (participaciones.length === 0) return null;
        return {
            participaciones,
            where: {
                // Los propios nunca cuentan como sin leer.
                senderId: { not: userId },
                OR: participaciones.map(p => ({
                    threadId: p.threadId,
                    ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {}),
                })),
            },
        };
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
        //
        // UNA sola consulta agrupada, no una por conversación. Antes era un
        // `count` dentro de un `Promise.all`: con 50 conversaciones eran 51
        // viajes a la base, y la base de producción está en Singapur — a 150 ms
        // de ida y vuelta eso son casi 8 segundos para pintar una bandeja.
        const f = await this.filtroNoLeidos(userId);
        const grupos = f
            ? await prisma.internalMessage.groupBy({
                by: ['threadId'],
                where: f.where,
                _count: { _all: true },
            })
            : [];
        const noLeidosPorHilo = new Map(grupos.map(g => [g.threadId, g._count._all]));

        const conNoLeidos = participaciones.map((p) => {
            const noLeidos = noLeidosPorHilo.get(p.thread.id) ?? 0;
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
        });

        conNoLeidos.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
        return conNoLeidos;
    }

    /** Cuántos mensajes sin leer tiene la persona en total (para la campanita). */
    static async contarNoLeidos(userId: string): Promise<number> {
        const f = await this.filtroNoLeidos(userId);
        if (!f) return 0;
        return prisma.internalMessage.count({ where: f.where });
    }

    /** Los mensajes de una conversación. Marca como leído de paso. */
    static async leerConversacion(threadId: string, userId: string, opts: { antesDe?: Date } = {}) {
        const participante = await this.assertParticipante(threadId, userId);

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

        // QUIEN ENTRA DESPUÉS NO VE LO DE ANTES.
        //
        // Sin este corte, sumar a alguien a una conversación le abría TODO el
        // historial previo de golpe: dos personas hablando de sueldos, se suma
        // a un tercero, y el tercero lee la charla entera desde el primer
        // mensaje. Nadie del hilo se entera, porque el pulso solo avisa de
        // mensajes urgentes, no de cambios de quiénes están.
        //
        // `participante.createdAt` es la fecha de alta en el hilo. Para quien
        // estuvo desde el principio no cambia nada: su alta es anterior a todo.
        const mensajes = await prisma.internalMessage.findMany({
            where: {
                threadId,
                createdAt: {
                    gte: participante.createdAt,
                    ...(opts.antesDe ? { lt: opts.antesDe } : {}),
                },
            },
            orderBy: { createdAt: 'desc' },
            take: PAGINA,
            select: {
                id: true, body: true, createdAt: true, editedAt: true,
                // `urgent` faltaba acá: el mensaje llegaba a la pantalla sin la
                // marca y NINGUNO se veía nunca como urgente dentro del hilo.
                urgent: true,
                sender: { select: { id: true, name: true } },
            },
        });

        // Se marca hasta la fecha del mensaje MÁS NUEVO QUE SE DEVOLVIÓ, no
        // hasta `ahora`. Dos motivos, los dos reales:
        //
        //  1. Con `ahora`, un mensaje que entraba entre el findMany de arriba y
        //     el update quedaba marcado como leído SIN haberse mostrado nunca:
        //     desaparecía del contador y, si era urgente, tampoco abría el globo.
        //     Pasa justo en el caso de más tráfico: dos personas escribiendo a la vez.
        //  2. Pedir una página vieja (`antesDe`) marcaba leído el hilo ENTERO.
        //
        // Y solo se escribe si de verdad avanzó: sin esto era un UPDATE por cada
        // lectura —cuatro por minuto por pestaña— sobre un valor que ya estaba
        // bien. Cada uno genera una fila nueva por MVCC y ensucia dos índices.
        const masNuevo = mensajes[0]?.createdAt; // vienen DESC: [0] es el último
        if (masNuevo && (!participante.lastReadAt || masNuevo > participante.lastReadAt)) {
            await this.marcarLeido(threadId, userId, masNuevo);
        }

        return {
            id: thread.id,
            kind: thread.kind,
            subject: thread.subject,
            participantes: thread.participants.map(p => ({
                id: p.user.id, name: p.user.name, role: p.role,
            })),
            // Se devuelven en orden cronológico, que es como se leen.
            mensajes: mensajes.reverse().map(m => ({
                id: m.id, body: m.body, createdAt: m.createdAt, editedAt: m.editedAt, urgent: m.urgent,
                senderId: m.sender.id, senderName: m.sender.name,
            })),
            hayMas: mensajes.length === PAGINA,
        };
    }

    /**
     * Mueve la marca de lectura. `hasta` es la fecha del último mensaje que la
     * persona EFECTIVAMENTE vio; sin él se usa el momento actual (caso de quien
     * escribe, que por definición ya leyó todo lo suyo).
     *
     * `private`: es segura hoy porque sus dos llamadores validan antes, pero lo
     * es por accidente y no por diseño — el `updateMany` no afecta filas si no
     * sos participante, pero el próximo endpoint que la llame directo no tendría
     * ninguna reja. Cerrarla es más barato que confiar en que nadie la use mal.
     */
    private static async marcarLeido(threadId: string, userId: string, hasta?: Date) {
        await prisma.internalThreadParticipant.updateMany({
            where: { threadId, userId },
            data: { lastReadAt: hasta ?? new Date() },
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

        // Uno a uno: delega en el helper, que es el único que sabe abrir o
        // reusar un directo y el único a prueba de carreras.
        if (kind === 'DIRECT' && paraOk.length === 1 && copiaOk.length === 0) {
            const r = await this.escribirEnDirecto({
                deId: creadorId, paraId: paraOk[0], cuerpo,
                asunto: params.subject, urgent: params.urgent,
            });
            return { id: r.id, reusada: !r.nuevo };
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
                        // Misma marca que el primer mensaje (ver el comentario
                        // de `escribirEnDirecto`).
                        create: [
                            { userId: creadorId, role: 'MEMBER', lastReadAt: ahora, createdAt: ahora },
                            ...paraOk.map(id => ({ userId: id, role: 'MEMBER', createdAt: ahora })),
                            ...copiaOk.map(id => ({ userId: id, role: 'CC', createdAt: ahora })),
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
        const f = await this.filtroNoLeidos(userId);
        if (!f) return [];

        const mensajes = await prisma.internalMessage.findMany({
            where: { urgent: true, ...f.where },
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
            where: { email: this.IA_EMAIL }, select: { id: true, role: true },
        });
        // Se verifica el ROL, no solo el email: si alguien crea una cuenta con
        // esa dirección y su propia contraseña, sin este control el Asistente
        // pasaría a escribir DESDE esa cuenta y le mandaría el consolidado del
        // equipo entero a su bandeja.
        if (existente && existente.role !== 'SISTEMA') {
            throw new Error(`El email ${this.IA_EMAIL} está tomado por una cuenta que no es del sistema`);
        }
        if (existente) return { id: existente.id };
        return prisma.user.create({
            data: {
                email: this.IA_EMAIL,
                name: this.IA_NOMBRE,
                role: 'SISTEMA',
                // Cadena vacía, no un centinela tipo 'NO-LOGIN': el login corta
                // ANTES de comparar cuando no hay contraseña
                // (`if (!user.password) return 401`). Con el centinela dependía
                // de que bcrypt devolviera false ante un hash malformado — cierto
                // hoy, pero es un detalle de la librería, no una regla.
                password: '',
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
        /**
         * Marca de "esto ya lo mandé". Si en las últimas 20 h la IA le escribió
         * a esta persona un mensaje que empieza igual, no repite.
         *
         * Hace falta porque este proyecto dispara sus crons DOS VECES a
         * propósito, con 40 minutos de diferencia: GitHub a veces se come un
         * schedule (pasó el 7/8 y las stories no salieron). Todos los endpoints
         * del proyecto traen dedup para que el segundo disparo no duplique —
         * este no lo tenía, así que habría mandado el resumen dos veces a todo
         * el equipo, todos los días.
         */
        dedupePrefijo?: string;
    }) {
        const ia = await this.usuarioIA();
        if (ia.id === params.paraUserId) return null;

        if (params.dedupePrefijo) {
            const yaFue = await prisma.internalMessage.findFirst({
                where: {
                    senderId: ia.id,
                    body: { startsWith: params.dedupePrefijo },
                    createdAt: { gte: new Date(Date.now() - 20 * 60 * 60 * 1000) },
                    thread: { participants: { some: { userId: params.paraUserId } } },
                },
                select: { id: true },
            });
            if (yaFue) return null;
        }

        return this.escribirEnDirecto({
            deId: ia.id, paraId: params.paraUserId, cuerpo: params.cuerpo,
            asunto: params.asunto || 'Resumen del día', urgent: params.urgent,
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
        const [presupuestos, enviadosAFabrica, tareasCerradas, resenasPedidas, tareasCreadas] = await Promise.all([
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

            // Pedidos que mandó a fábrica. Por `labSentById` (clave real) y no
            // por el nombre: es el criterio que CLAUDE.md fija para "vendedor de
            // una venta". Verificado contra producción: por id y por nombre dan
            // lo mismo, así que la clave alcanza y es la que no se rompe si a
            // alguien le cambian el nombre.
            prisma.order.count({
                where: { labSentById: userId, labSentAt: { gte: desde, lt: hasta } },
            }),

            prisma.clientTask.count({
                where: { completedBy: userName, completedAt: { gte: desde, lt: hasta } },
            }),

            // Comentarios/reseñas que pidió. Nacen como una ClientTask
            // `REVIEW_REQUEST` cuando un pedido pasa a ENTREGADO, y se cierran
            // cuando la persona efectivamente se lo pidió al cliente. Es un
            // SUBCONJUNTO de las tareas cerradas de arriba — el mensaje lo dice,
            // si no parece que los números no cierran.
            prisma.clientTask.count({
                where: {
                    type: 'REVIEW_REQUEST',
                    completedBy: userName,
                    completedAt: { gte: desde, lt: hasta },
                },
            }),

            // OJO: esto da CERO SIEMPRE, para todo el mundo.
            //
            // Se midió contra producción el 22/8/2026: de 334 tareas creadas en
            // siete días, 205 las creó 'Sistema (Pasivo)', 86 el 'Bot', 20
            // 'Sistema', 11 'Sistema (Retención)' y 12 quedaron en null. NINGUNA
            // la creó una persona: en este CRM las tareas las generan los
            // motores de seguimiento, no el equipo.
            //
            // Se deja calculado pero FUERA del mensaje: un renglón que siempre
            // dice cero entrena a la gente a ignorar el reporte entero. Si algún
            // día se agrega "crear tarea" a mano desde el panel, ya está listo.
            prisma.clientTask.count({
                where: { createdBy: userName, createdAt: { gte: desde, lt: hasta } },
            }),
        ]);

        return { presupuestos, enviadosAFabrica, tareasCerradas, resenasPedidas, tareasCreadas };
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
        // El `update` NO toca el rol de quien ya está adentro y activo: agregar
        // "en copia" a alguien que ya era destinatario lo degradaba a CC en
        // silencio. Y a quien vuelve después de irse se le reinicia la fecha de
        // alta, para que no recupere de arriba lo que se dijo mientras no estaba.
        const previo = await prisma.internalThreadParticipant.findUnique({
            where: { threadId_userId: { threadId, userId: nuevoUserId } },
            select: { id: true, leftAt: true },
        });
        if (previo && !previo.leftAt) {
            // Ya participa y está activo: no se hace nada.
        } else if (previo) {
            await prisma.internalThreadParticipant.update({
                where: { id: previo.id },
                data: { leftAt: null, role: params.role || 'MEMBER', createdAt: new Date() },
            });
        } else {
            await prisma.internalThreadParticipant.create({
                data: { threadId, userId: nuevoUserId, role: params.role || 'MEMBER' },
            });
        }

        // Un grupo dejó de ser una conversación de a dos, y suelta su llave de
        // par: si la conservara, un futuro uno-a-uno entre esas dos personas
        // engancharía este grupo de tres y les mostraría la charla ajena.
        await prisma.internalThread.updateMany({
            where: { id: threadId, kind: 'DIRECT' },
            data: { kind: 'GROUP', directKey: null },
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
