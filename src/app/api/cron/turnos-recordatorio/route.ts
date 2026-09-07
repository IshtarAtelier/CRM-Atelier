import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { BUSINESS_INFO } from '@/lib/business-info';
import { sendWhatsApp } from '@/lib/whatsapp/send';
import { templateSpec } from '@/lib/whatsapp/templates';
import { avisarEquipoPorWhatsApp } from '@/lib/whatsapp/aviso-interno';
import { formatPhoneForWhatsApp } from '@/lib/phone-utils';

export const dynamic = 'force-dynamic';

/**
 * Recordatorios de turno — corre una vez por hora.
 *
 * Un turno es un `ClientTask` con `type: 'TURNO'` y `dueDate` = fecha y hora
 * (ver `wa-service/shared/turnos.js`). Este cron manda DOS avisos distintos:
 *
 *  1. AL EQUIPO, a primera hora del día: la lista de los turnos de HOY, a los
 *     celulares cargados en `User.whatsappPhone`. Un aviso por día, no uno por
 *     turno: tres turnos no son tres WhatsApp.
 *  2. AL CLIENTE, el día anterior: que se acuerde de venir. Sale por la
 *     plantilla `recordatorio_turno` porque a esa altura la ventana de 24 h casi
 *     siempre está cerrada (el turno se sacó días antes).
 *
 * IDEMPOTENCIA: no hay tabla de "ya avisado". Se usa el propio `description` de
 * la tarea como marca (se le pega un sufijo). Es feo pero no necesita
 * migración, y el cron corre cada hora: sin marca, un turno de la tarde
 * recibiría el recordatorio ocho veces.
 */

const MARCA_CLIENTE = ' ·avisado-cliente';
const MARCA_EQUIPO = ' ·avisado-equipo';

/** Hora de Córdoba, que es la que vale para el negocio. */
function ahoraEnCordoba() {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Cordoba' }));
    return { hora: d.getHours(), fecha: d };
}

function inicioDelDia(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET no está configurado.' }, { status: 500 });
    if (secret !== cronSecret && token !== cronSecret) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { hora, fecha } = ahoraEnCordoba();
    const hoy = inicioDelDia(fecha);
    const manana = new Date(hoy.getTime() + 24 * 3600 * 1000);
    const pasadoManana = new Date(hoy.getTime() + 48 * 3600 * 1000);

    const resultado = { avisadosCliente: 0, fallidosCliente: 0, avisoAlEquipo: false, turnosDeHoy: 0 };

    // ── 1. Al cliente: los turnos de MAÑANA ─────────────────────────────────
    const deManana = await prisma.clientTask.findMany({
        where: {
            type: 'TURNO', status: 'PENDING',
            dueDate: { gte: manana, lt: pasadoManana },
            NOT: { description: { contains: MARCA_CLIENTE } },
        },
        include: { client: { select: { id: true, name: true, phone: true } } },
    });

    for (const t of deManana) {
        if (!t.client?.phone || !t.dueDate) continue;
        const nombre = (t.client.name || '').split(' ')[0] || 'Hola';
        const cuando = new Intl.DateTimeFormat('es-AR', {
            timeZone: 'America/Argentina/Cordoba', weekday: 'long', day: '2-digit', month: '2-digit',
        }).format(t.dueDate) + ' a las ' + new Intl.DateTimeFormat('es-AR', {
            timeZone: 'America/Argentina/Cordoba', hour: '2-digit', minute: '2-digit', hour12: false,
        }).format(t.dueDate);

        // `sendWhatsApp` direcciona por chatId, no por teléfono: el "<E.164>@c.us"
        // es la forma que ya usan las campañas.
        const telefono = formatPhoneForWhatsApp(t.client.phone);
        if (!telefono) { resultado.fallidosCliente++; continue; }

        const r = await sendWhatsApp({
            chatId: `${telefono}@c.us`,
            message: `Hola ${nombre}, te recordamos tu turno en Atelier Óptica: ${cuando}. Estamos en ${BUSINESS_INFO.address}. Si no podés venir, respondé este mensaje y lo reprogramamos.`,
            senderName: 'Sistema',
            isProactive: true,
            // Con la ventana cerrada (lo normal: el turno se sacó días antes) sale
            // la plantilla; si el cliente escribió hace poco, va el texto libre.
            template: templateSpec('recordatorio_turno', [nombre, cuando, BUSINESS_INFO.address]),
        }).catch((e: any) => ({ ok: false, error: e?.message }));

        if (r?.ok) {
            resultado.avisadosCliente++;
            // La marca se pega DESPUÉS de que el envío salió: si falla, el
            // próximo tick lo reintenta en vez de darlo por avisado.
            await prisma.clientTask.update({
                where: { id: t.id },
                data: { description: t.description + MARCA_CLIENTE },
            }).catch(() => {});
        } else {
            resultado.fallidosCliente++;
            console.error(`[CRON turnos] No se pudo recordar el turno ${t.id}:`, (r as any)?.error);
        }
    }

    // ── 2. Al equipo: los turnos de HOY, una sola vez, a primera hora ───────
    if (hora >= 9 && hora < 11) {
        const deHoy = await prisma.clientTask.findMany({
            where: {
                type: 'TURNO', status: 'PENDING',
                dueDate: { gte: hoy, lt: manana },
                NOT: { description: { contains: MARCA_EQUIPO } },
            },
            include: { client: { select: { name: true } } },
            orderBy: { dueDate: 'asc' },
        });
        resultado.turnosDeHoy = deHoy.length;

        if (deHoy.length > 0) {
            const equipo = await prisma.user.findMany({
                where: { whatsappPhone: { not: null }, role: { in: ['ADMIN', 'STAFF'] } },
                select: { id: true, name: true, whatsappPhone: true },
            });
            const lista = deHoy.map(t => {
                const h = new Intl.DateTimeFormat('es-AR', {
                    timeZone: 'America/Argentina/Cordoba', hour: '2-digit', minute: '2-digit', hour12: false,
                }).format(t.dueDate!);
                return `${h} · ${t.client?.name || 'sin nombre'}`;
            }).join(' | ');

            if (equipo.length > 0) {
                await avisarEquipoPorWhatsApp({
                    destinatarios: equipo,
                    remitente: { id: null, name: 'Agenda' },
                    contexto: `los turnos de hoy (${deHoy.length})`,
                    texto: lista,
                    link: `${(process.env.NEXT_PUBLIC_APP_URL || 'https://atelieroptica.com.ar').replace(/\/$/, '')}/admin/agenda`,
                }).catch((e: any) => console.error('[CRON turnos] No se pudo avisar al equipo:', e?.message));
                resultado.avisoAlEquipo = true;
            }

            for (const t of deHoy) {
                await prisma.clientTask.update({
                    where: { id: t.id }, data: { description: t.description + MARCA_EQUIPO },
                }).catch(() => {});
            }
        }
    }

    return NextResponse.json({ ok: true, ...resultado });
}
