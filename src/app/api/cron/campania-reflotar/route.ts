import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { SYSTEM_ACTOR } from '@/lib/actor';
import { sendWhatsApp } from '@/lib/whatsapp/send';
import { templateSpec } from '@/lib/whatsapp/templates';
import { saludoSegunHoraArgentina } from '@/lib/whatsapp/saludo';
import { registrarSeguimientoEnviado } from '@/lib/embudo/registrar-seguimiento';
import { nombreDePila } from '@/lib/seguimientos/politica';
import { TAGS_NO_CLIENTE } from '@/lib/no-cliente';
import { VENTANA_EMBUDO_DIAS } from '@/lib/leads-pipeline';

export const dynamic = 'force-dynamic';

/**
 * Campaña ÚNICA de reflote: los leads que quedaron sin ningún seguimiento
 * antes de que el motor funcionara (pedido de Ishtar, 15/9/2026: "reflotá los
 * de meses anteriores, las mismas plantillas, como acción única").
 *
 * Quién entra: ficha CONTACT sin venta, sin etiqueta de exclusión, con chat de
 * WhatsApp, cuyo presupuesto (o alta, si no tiene) tiene entre 31 y 120 días
 * —más nuevo lo atiende el motor, más viejo ya es otra época—, y a la que
 * NADIE le escribió después (ni etiqueta de seguimiento ni mensaje humano).
 * Medido el 15/9: 135 personas, 122 con presupuesto, $34,8 M.
 *
 * Qué se manda: `ultimo_seguimiento` (aprobada: Instagram + "¿al final
 * resolviste lo de tus anteojitos?"), la más cercana a "web + Instagram +
 * renovar". Se registra como un seguimiento más (etiqueta + lastFollowUpAt),
 * así la respuesta crea la tarea del vendedor igual que con el motor.
 *
 * Misma mecánica que campania-seguimiento: tandas (`batch`, tope 10) con
 * pausas de 20-40 s, dedup atómico por etiqueta "Campaña Reflotar", respeta
 * `followups_enabled` y horario 10-19. EN SECO por defecto: manda solo con
 * `?dryRun=0`.
 */
const TAG = 'Campaña Reflotar';
const PLANTILLA = 'ultimo_seguimiento' as const;
const DIAS_MIN = VENTANA_EMBUDO_DIAS + 1;
const DIAS_MAX = 120;
const EXCLUSION = ['no interesado', 'cancelar bot', 'spam', 'no bot', 'cerrado', 'post-venta', 'sin seguimiento', ...TAGS_NO_CLIENTE];
const REMITENTES_AUTOMATICOS = ['Bot', 'Sistema', 'Sistema Atelier'];
const D = 86_400_000;

const dormir = (ms: number) => new Promise(r => setTimeout(r, ms));
const horaArgentina = () => (new Date().getUTCHours() + 24 - 3) % 24;

async function audiencia(tagId: string, now = Date.now()) {
    const leads = await prisma.client.findMany({
        where: {
            status: 'CONTACT', isDeleted: false,
            orders: { none: { isDeleted: false, orderType: { in: ['SALE', 'ORDER'] } } },
            tags: { none: { id: tagId } },
        },
        select: {
            id: true, name: true, createdAt: true, tags: { select: { name: true } },
            orders: { where: { isDeleted: false, orderType: 'QUOTE' }, orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true, total: true } },
            whatsappChats: { orderBy: { lastMessageAt: 'desc' }, take: 1, select: { id: true, waId: true, realPhone: true, chatLabels: true } },
        },
    });
    const conChat = leads.filter(l => l.whatsappChats[0] && !l.tags.some(t => EXCLUSION.some(x => t.name.toLowerCase().includes(x))));
    const chatIds = conChat.map(l => l.whatsappChats[0].id);
    const humanos = new Map((await prisma.whatsAppMessage.groupBy({
        by: ['chatId'],
        where: { chatId: { in: chatIds }, direction: 'OUTBOUND', senderName: { notIn: REMITENTES_AUTOMATICOS } },
        _max: { createdAt: true },
    })).map(x => [x.chatId, x._max.createdAt]));

    return conChat.flatMap(l => {
        const chat = l.whatsappChats[0];
        const ref = l.orders[0]?.createdAt ?? l.createdAt;
        const dias = (now - ref.getTime()) / D;
        if (dias < DIAS_MIN || dias > DIAS_MAX) return [];
        if ((chat.chatLabels || []).some(x => x.startsWith('SEGUIMIENTO_'))) return [];
        const h = humanos.get(chat.id);
        if (h && h.getTime() > ref.getTime()) return [];
        if (!nombreDePila(l.name)) return [];
        const destino = /^\d{10,15}$/.test(chat.waId) ? chat.waId : chat.realPhone;
        if (!destino || !/^\d{10,15}$/.test(destino)) return [];
        return [{ id: l.id, nombre: l.name, chatId: chat.id, dias: Math.floor(dias), presupuesto: l.orders[0]?.total ?? 0 }];
    }).sort((a, b) => a.dias - b.dias);
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
    if (searchParams.get('secret') !== cronSecret && token !== cronSecret) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const dryRun = searchParams.get('dryRun') !== '0';
    const batch = Math.min(Math.max(parseInt(searchParams.get('batch') || '5', 10) || 5, 1), 10);

    const setting = await prisma.systemSetting.findUnique({ where: { key: 'followups_enabled' } });
    if (setting && setting.value !== 'true') return NextResponse.json({ ok: false, motivo: 'followups_enabled=false — campaña pausada' });
    const hora = horaArgentina();
    if (!dryRun && (hora < 10 || hora >= 19)) return NextResponse.json({ ok: false, motivo: `fuera de horario (10-19 ART, ahora ${hora})` });

    const tag = await prisma.tag.upsert({ where: { name: TAG }, update: {}, create: { name: TAG, color: '#f59e0b' } });
    const todos = await audiencia(tag.id);

    if (dryRun) {
        return NextResponse.json({
            ok: true, dryRun: true, plantilla: PLANTILLA, pendientes: todos.length,
            valor: todos.reduce((a, c) => a + c.presupuesto, 0),
            muestra: todos.slice(0, 10).map(c => ({ nombre: c.nombre, dias: c.dias })),
        });
    }

    const reclamar = (clientId: string) => prisma.$executeRawUnsafe('INSERT INTO "_ClientToTag" ("A", "B") VALUES ($1, $2) ON CONFLICT DO NOTHING', clientId, tag.id);
    const liberar = (clientId: string) => prisma.$executeRawUnsafe('DELETE FROM "_ClientToTag" WHERE "A" = $1 AND "B" = $2', clientId, tag.id).catch(() => 0);

    const tanda = todos.slice(0, batch);
    let enviados = 0;
    const errores: string[] = [];
    for (let i = 0; i < tanda.length; i++) {
        const c = tanda[i];
        if ((await reclamar(c.id)) === 0) continue;
        const now = new Date();
        const res = await sendWhatsApp({
            chatId: c.chatId,
            message: '',
            senderName: SYSTEM_ACTOR.name,
            isProactive: true,
            forceTemplate: true,
            template: templateSpec(PLANTILLA, [nombreDePila(c.nombre)!, saludoSegunHoraArgentina(now)]),
        });
        if (!res.ok) {
            if (/Destino inválido/i.test(res.error || '')) await reclamar(c.id); else await liberar(c.id);
            errores.push(`${c.nombre}: ${res.error || 'fallo de envío'}`);
            continue;
        }
        enviados++;
        // Mismo rastro que un seguimiento del motor: la respuesta crea la tarea del vendedor.
        await registrarSeguimientoEnviado({ chatId: c.chatId, plantilla: PLANTILLA, actor: SYSTEM_ACTOR })
            .catch((e: any) => errores.push(`${c.nombre}: enviado, pero sin registrar (${e?.message})`));
        await prisma.interaction.create({
            data: { clientId: c.id, type: 'NOTE', userName: 'Sistema', content: `📣 [${TAG}] Se envió por WhatsApp la plantilla ${PLANTILLA} (lead de hace ${c.dias} días sin ningún seguimiento).` },
        }).catch(() => {});
        if (i < tanda.length - 1) await dormir(20_000 + Math.floor(Math.random() * 20_000));
    }

    return NextResponse.json({ ok: true, plantilla: PLANTILLA, enviados, restantes: todos.length - tanda.length, errores: errores.slice(0, 10) });
}
