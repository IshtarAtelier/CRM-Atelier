// ────────────────────────────────────────────────────────────────────────────
// BRIEFING DIARIO del equipo de venta.
//
// Pedido de Ishtar: que cada vendedor, la primera vez que abre el panel en el
// día, tenga que leer tres fichas (su reporte, cómo se atiende online, cómo se
// atiende en el local) y escribir con sus palabras qué se le pidió. Es
// OBLIGATORIO por el mismo motivo que las novedades guiadas: "no les permitas
// decir que no quieren verlo". El modal no se cierra hasta que este endpoint
// registra el texto.
//
// Quién lo tiene pendiente se decide ACÁ, en el server, y no en localStorage:
// cambiar de máquina o de navegador no puede saltearlo.
//
// Solo lo ven los STAFF (los vendedores). Los ADMIN no: para ellos el briefing
// no es una tarea, es lo que reciben en la bandeja cuando el equipo lo completa.
// ────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';
import { InternalMessagingService } from '@/services/internal-messaging.service';
import { diaArgentino, hoyArgentino } from '@/lib/dia-argentino';
import { BRIEFING_MINIMO_TEXTO } from '@/lib/constants/briefing';

/** `{ [userId]: 'YYYY-MM-DD' }` — el último día que cada persona lo completó. */
const CLAVE_HECHO = 'briefing_diario_hecho';

/** Tope defensivo: el cuerpo va a un mensaje interno, no a un documento. */
const MAXIMO_TEXTO = 2000;

async function diasHechos(): Promise<Record<string, string>> {
    const fila = await prisma.systemSetting.findUnique({ where: { key: CLAVE_HECHO } });
    try {
        const datos = fila ? JSON.parse(fila.value) : {};
        return datos && typeof datos === 'object' && !Array.isArray(datos) ? datos : {};
    } catch {
        return {};
    }
}

/** "Milena Gómez" → "Milena". El saludo del modal es de a una persona. */
function primerNombre(nombre: string): string {
    return (nombre || '').trim().split(/\s+/)[0] || 'equipo';
}

/**
 * GET → `{ pendiente, nombre, dia, actividad }`
 *
 * `actividad` son los números REALES de ayer de esta persona, para poder
 * poner el mínimo al lado de lo que efectivamente hizo. Si el cálculo falla,
 * viaja en `null` y el modal muestra los mínimos sin números: un briefing que
 * no aparece porque una consulta se cayó es peor que uno sin métricas.
 */
export async function GET(request: NextRequest) {
    try {
        const actor = getActor(request);
        if (!actor.id || actor.role !== 'STAFF') {
            return NextResponse.json({ pendiente: false });
        }

        const hechos = await diasHechos();
        if (hechos[actor.id] === hoyArgentino()) {
            return NextResponse.json({ pendiente: false });
        }

        const ayer = diaArgentino(1);
        let actividad: { presupuestos: number; tareasCerradas: number; resenasPedidas: number } | null = null;
        try {
            const a = await InternalMessagingService.actividadDe(actor.id, actor.name, ayer.desde, ayer.hasta);
            actividad = {
                presupuestos: a.presupuestos,
                tareasCerradas: a.tareasCerradas,
                resenasPedidas: a.resenasPedidas,
            };
        } catch (error: any) {
            console.error('[Briefing] No se pudo calcular la actividad:', error.message);
        }

        return NextResponse.json({
            pendiente: true,
            nombre: primerNombre(actor.name),
            dia: ayer.etiqueta,
            actividad,
        });
    } catch (error: any) {
        // Un briefing que no se puede resolver no puede trabar el panel entero.
        console.error('[Briefing] Error consultando pendiente:', error.message);
        return NextResponse.json({ pendiente: false });
    }
}

/**
 * POST `{ texto, vueltasAtras }` → le manda lo escrito a los ADMIN y marca el
 * día como hecho.
 *
 * El orden importa: primero se avisa, después se marca. Si el marcado falla, el
 * modal queda abierto y el reintento NO duplica el mensaje — `dedupePrefijo`
 * lleva la fecha y el nombre, y la IA no repite lo que ya mandó en 20 h.
 */
export async function POST(request: NextRequest) {
    try {
        const actor = getActor(request);
        if (!actor.id) return NextResponse.json({ error: 'Sin usuario' }, { status: 401 });
        if (actor.role !== 'STAFF') return NextResponse.json({ error: 'El briefing es del equipo de venta' }, { status: 403 });

        const body = await request.json().catch(() => ({}));
        const texto = String(body?.texto ?? '').trim().slice(0, MAXIMO_TEXTO);
        if (texto.length < BRIEFING_MINIMO_TEXTO) {
            return NextResponse.json({ error: 'Escribí un poco más de lo que te pedimos hoy.' }, { status: 400 });
        }

        const crudo = Number(body?.vueltasAtras);
        const vueltas = Number.isFinite(crudo) ? Math.min(99, Math.max(0, Math.trunc(crudo))) : 0;

        const hoy = diaArgentino(0);
        const nombre = (actor.name || 'Alguien del equipo').trim();
        const encabezado = `📝 Briefing de ${nombre} — ${hoy.fecha}`;

        const cuerpo = [
            encabezado,
            ``,
            `Escribió lo que se le pidió hoy:`,
            `“${texto}”`,
            ``,
            // Siempre presente, también cuando es cero: un renglón que aparece
            // solo a veces no se puede distinguir de uno que faltó por un error.
            vueltas > 0
                ? `↩️ Tocó “Tengo dudas, quiero volver a leer” ${vueltas === 1 ? '1 vez' : `${vueltas} veces`}. Puede que convenga repasarlo con ${primerNombre(nombre)}.`
                : `↩️ No necesitó volver atrás a releer.`,
        ].join('\n');

        const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
        let avisados = 0;
        for (const admin of admins) {
            const enviado = await InternalMessagingService.mensajeDeIA({
                paraUserId: admin.id,
                cuerpo,
                asunto: 'Briefing del equipo',
                dedupePrefijo: encabezado,
            }).catch(err => { console.error('[Briefing] aviso a admin:', err); return null; });
            if (enviado) avisados++;
        }

        const hechos = await diasHechos();
        hechos[actor.id] = hoy.iso;
        await prisma.systemSetting.upsert({
            where: { key: CLAVE_HECHO },
            create: { key: CLAVE_HECHO, value: JSON.stringify(hechos) },
            update: { value: JSON.stringify(hechos) },
        });

        // Queda firmado quién lo completó y qué escribió: es la respuesta a un
        // futuro "a mí nadie me lo explicó".
        logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'OTHER',
            entityType: 'SETTING',
            entityId: `${CLAVE_HECHO}:${hoy.iso}`,
            details: { evento: 'briefing_diario_completado', dia: hoy.iso, texto, vueltasAtras: vueltas, avisados },
        }).catch(console.error);

        return NextResponse.json({ ok: true, avisados });
    } catch (error: any) {
        console.error('[Briefing] Error registrando el briefing:', error.message);
        return NextResponse.json({ error: 'No se pudo registrar el briefing' }, { status: 500 });
    }
}
