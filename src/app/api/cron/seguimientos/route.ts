import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { avisarAdmins } from '@/lib/avisos/aviso-al-equipo';
import { EmbudoService } from '@/services/embudo.service';
import { seleccionar } from '@/lib/seguimientos/seleccion';
import { ejecutar, FALLAS_SEGUIDAS_PARA_FRENAR } from '@/lib/seguimientos/ejecutor';
import { agruparVetos, diaArt, horaArt, registrarCorrida } from '@/lib/seguimientos/registro';
import type { Candidato, EstadoDelChat } from '@/lib/seguimientos/politica';
import { clasificarRespuesta, respuestasAlToque, type Clasificacion } from '@/lib/embudo/respuesta';
import { cerrarComoPerdido, posponerSeguimiento, reservarDescuentoRetome, PLANTILLA_RETOME } from '@/lib/seguimientos/cierre';
import {
    CUPO_DIARIO_POR_DEFECTO, HORA_DESDE, HORA_HASTA, LOTE_POR_TICK, MODO_POR_DEFECTO, PLANTILLAS_AUTOMATICAS,
} from '@/lib/constants/seguimientos';

export const dynamic = 'force-dynamic';

/**
 * EL DISPARADOR del motor de seguimientos. Corre una vez por hora desde
 * `src/instrumentation.ts` (nunca desde un scheduler externo: los que se
 * declararon en `vercel.json` nunca corrieron).
 *
 * Devuelve TODO lo que hizo y lo que no: qué salió, qué se vetó y por qué, y
 * qué quedó en espera por cupo. Y desde el 12/9/2026 lo DEJA ESCRITO en
 * `SeguimientoCorrida` (una fila por tick): sin eso, un motor que no manda
 * nada es indistinguible de uno que anda bien y no tenía a quién escribirle.
 *
 * Idempotente: cada envío reclama una fila única (chat + plantilla + día) antes
 * de mandar (`lib/seguimientos/registro.ts`). Corrió dos veces, dos instancias,
 * un reintento: la segunda choca con la fila y no manda.
 *
 * Freno: tres fallas seguidas al mandar cortan la tanda y paran el motor dos
 * horas (`seguimientos_freno_hasta`), con aviso a los admin por la mensajería interna. Tres rebotes seguidos son la
 * cuenta o la API, no tres clientes.
 *
 * Desde el 8/10/2026 el motor también hace lo que antes quedaba "para una
 * persona" (Ishtar: "en embudo no debe haber nada para humano"): lee la
 * respuesta del cliente al último toque y cierra como perdido o pausa según
 * lo que dijo (`lib/embudo/respuesta.ts`, `lib/seguimientos/cierre.ts`), y
 * ejecuta los `cerrar` del playbook (recorrido completo sin venta, o ventana
 * vencida). Nada de eso manda un mensaje: no consume cupo ni se frena.
 *
 * `?dryRun=1` fuerza el modo seco para este tick.
 */

const FRENO_HORAS = 2;
/** Cuántos cierres como perdido por tick: el primer día puede haber cientos atrasados y el tick no debe durar media hora. */
const CIERRES_POR_TICK = 200;

async function leerSetting(key: string): Promise<string | null> {
    const row = await prisma.systemSetting.findUnique({ where: { key } }).catch(() => null);
    return row?.value ?? null;
}

async function escribirSetting(key: string, value: string): Promise<void> {
    await prisma.systemSetting.upsert({ where: { key }, update: { value }, create: { key, value } }).catch(() => {});
}

export async function GET(request: Request) {
    const t0 = Date.now();
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET no está configurado.' }, { status: 500 });
    if (secret !== cronSecret && token !== cronSecret) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const now = Date.now();
    const dia = diaArt(now);
    const hora = horaArt(now);
    const modo: 'real' | 'seco' = searchParams.get('dryRun') === '1' ? 'seco'
        : ((await leerSetting('seguimientos_auto_modo')) === 'real' ? 'real'
            : ((await leerSetting('seguimientos_auto_modo')) === 'seco' ? 'seco' : MODO_POR_DEFECTO));
    const cupoDiario = Number(await leerSetting('seguimientos_cupo_diario')) || CUPO_DIARIO_POR_DEFECTO;

    // Lo que se registra pase lo que pase (también si la corrida revienta).
    const base = { dia, hora, modo, candidatos: 0, elegidos: 0, enviados: 0, fallidos: 0, enEspera: 0, cupoDiario, usadoHoy: 0, vetados: [] as ReturnType<typeof agruparVetos> };
    const terminar = async (extra: Partial<typeof base> & { detalle?: unknown; error?: string | null }, cuerpo: Record<string, unknown>, status = 200) => {
        await registrarCorrida({ ...base, ...extra, duracionMs: Date.now() - t0 });
        return NextResponse.json(cuerpo, { status });
    };

    try {
        // ── Interruptores ───────────────────────────────────────────────────
        const followups = await leerSetting('followups_enabled');
        if (followups !== null && followups !== 'true') {
            return terminar({ error: 'followups_enabled=false' }, { ok: false, modo, motivo: 'followups_enabled=false — motor pausado' });
        }
        if (hora < HORA_DESDE || hora >= HORA_HASTA) {
            // Fuera de horario no se registra: no es una corrida, es el reloj preguntando.
            return NextResponse.json({ ok: true, modo, motivo: `fuera de horario (${HORA_DESDE}-${HORA_HASTA} ART)`, enviados: [] });
        }
        const frenoHasta = await leerSetting('seguimientos_freno_hasta');
        if (frenoHasta && new Date(frenoHasta).getTime() > now && modo === 'real') {
            return terminar({ error: `freno hasta ${frenoHasta}` }, { ok: false, modo, motivo: `motor frenado hasta ${frenoHasta} (${FALLAS_SEGUIDAS_PARA_FRENAR} fallas seguidas en una corrida anterior)` });
        }

        // ── Cupo del día (día de Córdoba) ───────────────────────────────────
        const usadoHoy = await prisma.seguimientoEnvio.count({
            where: { diaArt: dia, resultado: 'ENVIADO' },
        });
        const cupo = Math.min(Math.max(0, cupoDiario - usadoHoy), LOTE_POR_TICK);
        base.usadoHoy = usadoHoy;

        // ── Candidatos: lo que el tablero dice que toca HOY ─────────────────
        const { paraHoy } = await EmbudoService.tablero(now);

        // ── Cierres del playbook: recorrido completo sin venta, o ventana vencida ──
        const aCerrar = paraHoy.filter(l => l.proximaAccion.tipo === 'cerrar').slice(0, CIERRES_POR_TICK);
        const cierres: { nombre: string; motivo: string }[] = [];
        if (modo === 'real') {
            for (const l of aCerrar) {
                try {
                    await cerrarComoPerdido({ clientId: l.id, motivo: l.proximaAccion.etiqueta });
                    cierres.push({ nombre: l.name, motivo: `cerrado como perdido: ${l.proximaAccion.etiqueta}` });
                } catch (e: any) {
                    console.error(`[Motor seguimientos] No se pudo cerrar a ${l.name}:`, e?.message);
                    cierres.push({ nombre: l.name, motivo: `NO se pudo cerrar: ${e?.message}` });
                }
            }
        }

        const candidatos: Candidato[] = paraHoy
            .filter(l => l.proximaAccion.tipo === 'plantilla')
            .map(l => ({
                leadId: l.id,
                nombre: l.name,
                createdAt: new Date(l.createdAt),
                waChatId: l.waChatId,
                plantilla: l.proximaAccion.plantilla,
            }));
        base.candidatos = candidatos.length;

        const chatIds = candidatos.map(c => c.waChatId).filter((x): x is string => !!x);
        const filas = chatIds.length ? await prisma.whatsAppChat.findMany({
            where: { id: { in: chatIds } },
            select: {
                id: true, clientId: true, lastInboundAt: true, lastFollowUpAt: true, followUpPausedUntil: true,
                // El interruptor por persona: etiqueta del chat o de la ficha (politica.ts).
                chatLabels: true, client: { select: { tags: { select: { name: true } } } },
            },
        }) : [];

        // ── Qué dijo el que contestó al último toque ────────────────────────
        // Se leen los entrantes posteriores al último seguimiento y se clasifican.
        // 'cierre' y 'posponer' se EJECUTAN acá (en modo real); la compuerta
        // después solo los veta con el motivo a la vista.
        const conRespuesta = filas.filter(f => f.lastFollowUpAt && f.lastInboundAt && f.lastInboundAt > f.lastFollowUpAt);
        const respuestas = new Map<string, Clasificacion>();
        const lecturas: { nombre: string; motivo: string }[] = [];
        const ultimaPlantilla = new Map<string, string | null>();
        if (conRespuesta.length) {
            const desde = new Date(Math.min(...conRespuesta.map(f => f.lastFollowUpAt!.getTime())));
            // Cuál fue el último toque de cada chat (para saber si respondió al retome del 10 %).
            const ultimas = await prisma.whatsAppMessage.findMany({
                where: { chatId: { in: conRespuesta.map(f => f.id) }, direction: 'OUTBOUND', templateName: { not: null }, createdAt: { gte: desde } },
                orderBy: { createdAt: 'desc' },
                select: { chatId: true, templateName: true },
            });
            for (const u of ultimas) if (!ultimaPlantilla.has(u.chatId)) ultimaPlantilla.set(u.chatId, u.templateName);
            const entrantes = await prisma.whatsAppMessage.findMany({
                where: { chatId: { in: conRespuesta.map(f => f.id) }, direction: 'INBOUND', createdAt: { gt: desde } },
                orderBy: { createdAt: 'asc' },
                select: { chatId: true, content: true, type: true, createdAt: true },
            });
            for (const f of conRespuesta) {
                const suyos = respuestasAlToque(entrantes.filter(m => m.chatId === f.id), f.lastFollowUpAt!);
                const clase = clasificarRespuesta(suyos);
                respuestas.set(f.id, clase);
                const nombre = candidatos.find(c => c.waChatId === f.id)?.nombre ?? f.id;
                const palabras = suyos.map(m => m.content || '').filter(Boolean).join(' / ') || null;
                if (clase === 'seguir') {
                    // Respondió al retome con el 10 %: el descuento queda reservado en la ficha.
                    if (modo === 'real' && f.clientId && suyos.length && f.chatLabels.includes('SEGUIMIENTO_RETOME') && ultimaPlantilla.get(f.id) === PLANTILLA_RETOME) {
                        try {
                            if (await reservarDescuentoRetome({ clientId: f.clientId, palabrasDelCliente: palabras, tagNames: (f.client?.tags || []).map(t => t.name) })) {
                                lecturas.push({ nombre, motivo: `respondió al retome: 10% reservado en la ficha («${(palabras || '').slice(0, 80)}»)` });
                            }
                        } catch (e: any) { lecturas.push({ nombre, motivo: `NO se pudo reservar el 10%: ${e?.message}` }); }
                    }
                    continue;
                }
                if (modo !== 'real') { lecturas.push({ nombre, motivo: `(seco) ${clase}: «${(palabras || '').slice(0, 80)}»` }); continue; }
                try {
                    if (clase === 'cierre') {
                        if (f.clientId) await cerrarComoPerdido({ clientId: f.clientId, motivo: 'el cliente dijo que no', palabrasDelCliente: palabras });
                        lecturas.push({ nombre, motivo: `cerrado como perdido: el cliente dijo que no («${(palabras || '').slice(0, 80)}»)` });
                    } else if (f.clientId) {
                        const hasta = await posponerSeguimiento({ clientId: f.clientId, chatId: f.id, palabrasDelCliente: palabras, now });
                        lecturas.push({ nombre, motivo: `pausado hasta ${hasta.toISOString().slice(0, 10)}: pidió más adelante («${(palabras || '').slice(0, 80)}»)` });
                    }
                } catch (e: any) {
                    console.error(`[Motor seguimientos] No se pudo aplicar la respuesta de ${nombre}:`, e?.message);
                    lecturas.push({ nombre, motivo: `NO se pudo aplicar (${clase}): ${e?.message}` });
                }
            }
        }
        // Último SALIENTE de cada chat (de quien sea): lo mira la compuerta de 48 h.
        const salientes = chatIds.length ? await prisma.whatsAppMessage.groupBy({
            by: ['chatId'],
            where: { chatId: { in: chatIds }, direction: 'OUTBOUND' },
            _max: { createdAt: true },
        }) : [];
        const ultimoSaliente = new Map(salientes.map(s => [s.chatId, s._max.createdAt]));

        // ¿Qué plantillas automáticas NO están aprobadas en Meta? (espejo local,
        // lo sincroniza el cron whatsapp-calidad). Una PENDING no se manda: rebota.
        const espejo = await prisma.whatsAppTemplate.findMany({
            where: { name: { in: [...PLANTILLAS_AUTOMATICAS] }, language: 'es_AR' },
            select: { name: true, status: true },
        });
        const hayEspejo = (await prisma.whatsAppTemplate.count()) > 0;
        const plantillasNoAprobadas = new Set<string>(PLANTILLAS_AUTOMATICAS.filter(p => {
            const fila = espejo.find(e => e.name === p);
            return fila ? fila.status !== 'APPROVED' : hayEspejo;
        }));
        const chats = new Map<string, EstadoDelChat>(
            filas.map(f => [f.id, {
                lastInboundAt: f.lastInboundAt, lastFollowUpAt: f.lastFollowUpAt, followUpPausedUntil: f.followUpPausedUntil,
                lastOutboundAt: ultimoSaliente.get(f.id) ?? null,
                chatLabels: f.chatLabels, tagNames: (f.client?.tags || []).map(t => t.name),
                respuesta: respuestas.get(f.id) ?? null,
            }]),
        );

        const seleccion = seleccionar({ candidatos, chats, ctx: { now, plantillasNoAprobadas }, cupo });
        base.elegidos = seleccion.elegidos.length;
        base.enEspera = seleccion.enEspera.length;
        // Los cierres y las lecturas de respuestas se registran junto a los vetos: es lo que el motor HIZO sin mandar nada.
        base.vetados = agruparVetos([...seleccion.vetados.map(v => ({ nombre: v.candidato.nombre, motivo: v.motivo })), ...cierres, ...lecturas]);

        const { resultados: enviados, frenado } = modo === 'real' && seleccion.elegidos.length
            ? await ejecutar(seleccion.elegidos, new Date(now))
            : { resultados: [], frenado: false };
        const ok = enviados.filter(r => r.ok).length;
        const fallidos = enviados.filter(r => !r.ok && !r.salteado).length;

        if (frenado) {
            const hasta = new Date(now + FRENO_HORAS * 3_600_000).toISOString();
            await escribirSetting('seguimientos_freno_hasta', hasta);
            const detalle = enviados.filter(r => !r.ok && !r.salteado).map(r => `${r.nombre}: ${r.detalle}`).join('\n  - ');
            // A la mensajería interna de los admin, no por mail (Ishtar, 8/10/2026).
            await avisarAdmins({
                asunto: `⚠️ Seguimientos: el motor se frenó a las ${hora}:00 (${FALLAS_SEGUIDAS_PARA_FRENAR} fallas seguidas)`,
                urgente: true,
                cuerpo: `A las ${hora}:00 el motor de seguimientos falló ${FALLAS_SEGUIDAS_PARA_FRENAR} envíos seguidos y se frenó solo hasta las ${horaArt(new Date(hasta))}:00 (hora Córdoba). Tres rebotes seguidos suelen ser la cuenta de WhatsApp (pago, plantilla pausada) o la API, no los clientes.\n\nFallas:\n  - ${detalle}\n\nQué mirar: business.facebook.com → WhatsApp Manager (calidad del número, plantillas, método de pago). El motor reintenta solo cuando pasa el freno; los ${seleccion.elegidos.length - ok - fallidos} que quedaron sin mandar vuelven a evaluarse en el próximo tick.`,
            });
        }

        return terminar(
            { enviados: ok, fallidos, detalle: enviados, error: frenado ? `freno: ${FALLAS_SEGUIDAS_PARA_FRENAR} fallas seguidas` : null },
            {
                ok: true,
                modo,
                cupo: { diario: cupoDiario, usadoHoy, esteTick: cupo },
                candidatos: candidatos.length,
                cerrados: modo === 'real' ? cierres : aCerrar.map(l => ({ nombre: l.name, motivo: l.proximaAccion.etiqueta })),
                respuestasLeidas: lecturas,
                habrianSalido: modo === 'seco' ? seleccion.elegidos.map(c => ({ nombre: c.nombre, plantilla: c.plantilla })) : undefined,
                enviados,
                frenado,
                enEspera: seleccion.enEspera.length,
                // En seco, también QUIÉNES esperan: es la única forma de ver la audiencia
                // completa del día antes de prender el motor (el cupo corta la lista).
                esperan: modo === 'seco' ? seleccion.enEspera.map(c => ({ nombre: c.nombre, plantilla: c.plantilla })) : undefined,
                vetados: seleccion.vetados.map(v => ({ nombre: v.candidato.nombre, plantilla: v.candidato.plantilla, motivo: v.motivo })),
            },
        );
    } catch (e: any) {
        console.error('[Motor seguimientos] La corrida reventó:', e?.message);
        return terminar({ error: String(e?.message || e).slice(0, 500) }, { ok: false, modo, error: e?.message }, 500);
    }
}
