import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendWhatsApp } from '@/lib/whatsapp/send';
import { formatPhoneForWhatsApp } from '@/lib/phone-utils';
import { WHATSAPP_TEMPLATES } from '@/lib/whatsapp/templates';
import { BUSINESS_INFO } from '@/lib/business-info';
import type { Prisma } from '@prisma/client';

/**
 * Dos campañas puntuales de reactivación (30/8/26, pedidas por Ishtar), con el
 * mismo motor por tandas del cron de 12 cuotas (campania-mp-12-cuotas):
 *
 * - `?campana=soycliente`: clientes VIEJOS (venta real anterior a junio 2026,
 *   o del sistema anterior vía Client.contactSource='Importado') que no
 *   compraron ni escribieron en jun-ago — avisar que hay tienda online, con
 *   el cupón SOYCLIENTE (15% OFF, sin mínimo).
 * - `?campana=armazones`: quien YA recibió la campaña de 12 cuotas (tiene el
 *   tag "Campaña MP 12 Cuotas") y sigue sin comprar — sumarle lo que a ese
 *   mensaje le faltaba: tienda, cupón QUIEROMISLENTES e Instagram.
 *
 * Mismo diseño anti-ban que el cron hermano: tandas chicas (`batch`, default
 * 5) con pausas de 20-40 s adentro, tag propio por campaña para dedup
 * atómico, respeta followups_enabled y horario comercial ART (10-19).
 * `?dryRun=1` lista sin enviar.
 */

type Campana = 'soycliente' | 'armazones';

// v2 (30/8/26): ambas plantillas suman "contanos qué modelito te gustó" y
// llevan tienda + Instagram sí o sí (texto y botones). El TAG no cambia:
// quien ya recibió la v1 esta tarde no vuelve a recibir la v2.
const CONFIG: Record<Campana, { tag: string; plantilla: 'tienda_online_soycliente_v2' | 'tienda_online_quieromislentes' }> = {
    soycliente: { tag: 'Campaña Tienda SoyCliente', plantilla: 'tienda_online_soycliente_v2' },
    armazones: { tag: 'Campaña Seguimiento Armazones', plantilla: 'tienda_online_quieromislentes' },
};

const dormir = (ms: number) => new Promise(r => setTimeout(r, ms));

function horaArgentina(): number {
    return (new Date().getUTCHours() + 24 - 3) % 24;
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
    if (searchParams.get('secret') !== cronSecret && token !== cronSecret) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const campanaParam = searchParams.get('campana') as Campana | null;
    if (!campanaParam || !CONFIG[campanaParam]) {
        return NextResponse.json({ error: `?campana debe ser 'soycliente' o 'armazones'` }, { status: 400 });
    }
    const { tag: nombreTag, plantilla } = CONFIG[campanaParam];

    const dryRun = searchParams.get('dryRun') === '1';
    const batch = Math.min(Math.max(parseInt(searchParams.get('batch') || '5', 10) || 5, 1), 10);

    const setting = await prisma.systemSetting.findUnique({ where: { key: 'followups_enabled' } });
    if (setting && setting.value !== 'true') {
        return NextResponse.json({ ok: false, motivo: 'followups_enabled=false — campaña pausada' });
    }

    // Horario real del local (BUSINESS_INFO.hours): 9 a 20 en semana. La
    // campaña hermana (12 cuotas) usa 10-19 por conservadora, pero acá se
    // sigue el horario comercial real para no quedar mandando de más afuera.
    const hora = horaArgentina();
    if (!dryRun && (hora < 9 || hora >= 20)) {
        return NextResponse.json({ ok: false, motivo: `fuera de horario comercial (hora ART ${hora})` });
    }

    const tag = await prisma.tag.upsert({
        where: { name: nombreTag },
        update: {},
        create: { name: nombreTag, color: '#0ea5e9' },
    });

    const NUCLEO_TEL_OPTICA = BUSINESS_INFO.phoneE164.replace(/\D/g, '').slice(-10);
    const CORTE_RECIENTE = new Date('2026-06-01T00:00:00-03:00');

    let whereCandidatos: Prisma.ClientWhereInput;
    if (campanaParam === 'soycliente') {
        // Venta real vieja, o del sistema anterior — pero sin nada reciente
        // (jun-ago 2026, ya cubiertos por la campaña de 12 cuotas).
        whereCandidatos = {
            isDeleted: false,
            phone: { not: null },
            NOT: { phone: { contains: NUCLEO_TEL_OPTICA } },
            orders: { none: { isDeleted: false, createdAt: { gte: CORTE_RECIENTE } } },
            tags: { none: { id: tag.id } },
            OR: [
                { orders: { some: { isDeleted: false, orderType: { in: ['SALE', 'MAYORISTA'] } } } },
                { contactSource: 'Importado' },
            ],
        };
    } else {
        // Prospectos jun-ago 2026 sin NINGUNA compra. Cubre tanto a quien ya
        // recibió la campaña de 12 cuotas (le llega como seguimiento) como a
        // quien todavía no recibió nada (le llega como primer contacto — el
        // texto "¿Ya conocés nuestra tienda?" funciona para ambos). Se excluye
        // a los 'Importado': esos son clientes del sistema anterior y les
        // corresponde la campaña soycliente — sin esta exclusión un importado
        // de julio sin ventas recibiría LOS DOS mensajes con DOS cupones.
        whereCandidatos = {
            createdAt: { gte: CORTE_RECIENTE, lt: new Date('2026-09-01T00:00:00-03:00') },
            isDeleted: false,
            phone: { not: null },
            NOT: [
                { phone: { contains: NUCLEO_TEL_OPTICA } },
                { contactSource: 'Importado' },
            ],
            orders: { none: { isDeleted: false } },
            tags: { none: { id: tag.id } },
        };
    }

    const candidatos = await prisma.client.findMany({
        where: whereCandidatos,
        select: { id: true, name: true, phone: true },
        orderBy: { createdAt: 'asc' },
        take: dryRun ? 500 : batch,
    });

    if (dryRun) {
        return NextResponse.json({
            ok: true, dryRun: true, campana: campanaParam, plantilla,
            pendientes: candidatos.length,
            muestra: candidatos.slice(0, 5).map(c => ({ nombre: c.name, telefono: (c.phone || '').slice(0, 6) + '…' })),
        });
    }

    const reclamar = (clientId: string) => prisma.$executeRawUnsafe(
        'INSERT INTO "_ClientToTag" ("A", "B") VALUES ($1, $2) ON CONFLICT DO NOTHING',
        clientId, tag.id,
    );
    const liberar = (clientId: string) => prisma.$executeRawUnsafe(
        'DELETE FROM "_ClientToTag" WHERE "A" = $1 AND "B" = $2',
        clientId, tag.id,
    ).catch(() => 0);

    let enviados = 0;
    const errores: string[] = [];
    for (let i = 0; i < candidatos.length; i++) {
        const c = candidatos[i];
        const telefono = formatPhoneForWhatsApp(c.phone || '');
        if (!telefono || telefono.length < 13) {
            await reclamar(c.id);
            errores.push(`${c.name}: teléfono inválido`);
            continue;
        }

        const claimed = await reclamar(c.id);
        if (claimed === 0) continue;

        const pila = (c.name || '').trim().split(/\s+/)[0] || 'Hola';
        const texto = WHATSAPP_TEMPLATES[plantilla].body.replace('{{1}}', pila);
        const res = await sendWhatsApp({
            chatId: `${telefono}@c.us`,
            message: texto,
            senderName: nombreTag,
            isProactive: true,
            forceTemplate: true,
            template: { name: plantilla, bodyParams: [pila] },
        });

        if (!res.ok) {
            const permanente = /Destino inválido/i.test(res.error || '');
            if (permanente) await reclamar(c.id);
            else await liberar(c.id);
            errores.push(`${c.name}: ${res.error || 'fallo de envío'}`);
            continue;
        }

        enviados++;
        await prisma.interaction.create({
            data: {
                clientId: c.id,
                type: 'NOTE',
                userName: 'Sistema',
                content: `📣 [${nombreTag}] Se envió por WhatsApp:\n"${texto}"`,
            },
        }).catch((e: any) => errores.push(`${c.name}: enviado y reclamado, pero sin nota en ficha (${e?.message})`));

        if (i < candidatos.length - 1) {
            await dormir(20000 + Math.floor(Math.random() * 20000));
        }
    }

    const restantes = await prisma.client.count({ where: whereCandidatos });

    return NextResponse.json({ ok: true, campana: campanaParam, plantilla, enviados, restantes, errores: errores.slice(0, 10) });
}
