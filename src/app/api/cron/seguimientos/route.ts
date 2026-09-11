import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { EmbudoService } from '@/services/embudo.service';
import { seleccionar } from '@/lib/seguimientos/seleccion';
import { ejecutar } from '@/lib/seguimientos/ejecutor';
import type { Candidato, EstadoDelChat } from '@/lib/seguimientos/politica';
import {
    CUPO_DIARIO_POR_DEFECTO, HORA_DESDE, HORA_HASTA, LOTE_POR_TICK, MODO_POR_DEFECTO,
} from '@/lib/constants/seguimientos';

export const dynamic = 'force-dynamic';

/**
 * EL DISPARADOR del motor de seguimientos. Corre una vez por hora desde
 * `src/instrumentation.ts` (nunca desde un scheduler externo: los que se
 * declararon en `vercel.json` nunca corrieron).
 *
 * Devuelve TODO lo que hizo y lo que no: qué salió, qué se vetó y por qué, y
 * qué quedó en espera por cupo. Sin eso, un motor que no manda nada es
 * indistinguible de uno que anda bien y no tenía a quién escribirle.
 *
 * `?dryRun=1` fuerza el modo seco para este tick.
 */

function ahoraArgentina() {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Cordoba' }));
    const inicioDelDia = new Date(d); inicioDelDia.setHours(0, 0, 0, 0);
    // Volver a UTC el inicio del día local, para comparar contra createdAt.
    const offsetMs = new Date().getTime() - d.getTime();
    return { hora: d.getHours(), inicioDelDiaUtc: new Date(inicioDelDia.getTime() + offsetMs) };
}

async function leerSetting(key: string): Promise<string | null> {
    const row = await prisma.systemSetting.findUnique({ where: { key } }).catch(() => null);
    return row?.value ?? null;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET no está configurado.' }, { status: 500 });
    if (secret !== cronSecret && token !== cronSecret) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    // ── Interruptores ───────────────────────────────────────────────────────
    const followups = await leerSetting('followups_enabled');
    if (followups !== null && followups !== 'true') {
        return NextResponse.json({ ok: false, motivo: 'followups_enabled=false — motor pausado' });
    }
    const modo = searchParams.get('dryRun') === '1' ? 'seco'
        : ((await leerSetting('seguimientos_auto_modo')) === 'real' ? 'real'
            : ((await leerSetting('seguimientos_auto_modo')) === 'seco' ? 'seco' : MODO_POR_DEFECTO));

    const { hora, inicioDelDiaUtc } = ahoraArgentina();
    if (hora < HORA_DESDE || hora >= HORA_HASTA) {
        return NextResponse.json({ ok: true, modo, motivo: `fuera de horario (${HORA_DESDE}-${HORA_HASTA} ART)`, enviados: [] });
    }

    // ── Cupo del día ────────────────────────────────────────────────────────
    const cupoDiario = Number(await leerSetting('seguimientos_cupo_diario')) || CUPO_DIARIO_POR_DEFECTO;
    const yaHoy = await prisma.interaction.count({
        where: { type: 'FOLLOWUP', userName: 'Sistema', createdAt: { gte: inicioDelDiaUtc } },
    });
    const cupo = Math.min(Math.max(0, cupoDiario - yaHoy), LOTE_POR_TICK);

    // ── Candidatos: lo que el tablero dice que toca HOY ─────────────────────
    const now = Date.now();
    const { paraHoy } = await EmbudoService.tablero(now);
    const candidatos: Candidato[] = paraHoy
        .filter(l => l.proximaAccion.tipo === 'plantilla')
        .map(l => ({
            leadId: l.id,
            nombre: l.name,
            createdAt: new Date(l.createdAt),
            waChatId: l.waChatId,
            plantilla: l.proximaAccion.plantilla,
        }));

    const chatIds = candidatos.map(c => c.waChatId).filter((x): x is string => !!x);
    const filas = chatIds.length ? await prisma.whatsAppChat.findMany({
        where: { id: { in: chatIds } },
        select: {
            id: true, lastInboundAt: true, lastFollowUpAt: true, followUpPausedUntil: true,
            // El interruptor por persona: etiqueta del chat o de la ficha (politica.ts).
            chatLabels: true, client: { select: { tags: { select: { name: true } } } },
        },
    }) : [];
    // Último SALIENTE de cada chat (de quien sea): lo mira la compuerta de 48 h.
    const salientes = chatIds.length ? await prisma.whatsAppMessage.groupBy({
        by: ['chatId'],
        where: { chatId: { in: chatIds }, direction: 'OUTBOUND' },
        _max: { createdAt: true },
    }) : [];
    const ultimoSaliente = new Map(salientes.map(s => [s.chatId, s._max.createdAt]));
    const chats = new Map<string, EstadoDelChat>(
        filas.map(f => [f.id, {
            lastInboundAt: f.lastInboundAt, lastFollowUpAt: f.lastFollowUpAt, followUpPausedUntil: f.followUpPausedUntil,
            lastOutboundAt: ultimoSaliente.get(f.id) ?? null,
            chatLabels: f.chatLabels, tagNames: (f.client?.tags || []).map(t => t.name),
        }]),
    );

    const seleccion = seleccionar({ candidatos, chats, ctx: { now }, cupo });

    const enviados = modo === 'real' && seleccion.elegidos.length
        ? await ejecutar(seleccion.elegidos, new Date(now))
        : [];

    return NextResponse.json({
        ok: true,
        modo,
        cupo: { diario: cupoDiario, usadoHoy: yaHoy, esteTick: cupo },
        candidatos: candidatos.length,
        habrianSalido: modo === 'seco' ? seleccion.elegidos.map(c => ({ nombre: c.nombre, plantilla: c.plantilla })) : undefined,
        enviados,
        enEspera: seleccion.enEspera.length,
        // En seco, también QUIÉNES esperan: es la única forma de ver la audiencia
        // completa del día antes de prender el motor (el cupo corta la lista).
        esperan: modo === 'seco' ? seleccion.enEspera.map(c => ({ nombre: c.nombre, plantilla: c.plantilla })) : undefined,
        vetados: seleccion.vetados.map(v => ({ nombre: v.candidato.nombre, plantilla: v.candidato.plantilla, motivo: v.motivo })),
    });
}
