import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendWhatsApp } from '@/lib/whatsapp/send';
import { formatPhoneForWhatsApp } from '@/lib/phone-utils';
import { WHATSAPP_TEMPLATES } from '@/lib/whatsapp/templates';

/**
 * Campaña puntual (agosto 2026, pedida por Ishtar): avisar a los contactos del
 * mes que NO compraron que hay 12 cuotas por Mercado Pago (con su 10% de costo
 * financiero SIEMPRE aclarado — nunca "sin interés", eso son solo 3 y 6).
 *
 * Diseño anti-ban (la cuenta está bajo la lupa de Meta y el transporte es la
 * vía no oficial): cada invocación procesa una TANDA CHICA (default 5) con
 * pausas de 20-40 s adentro, y quien la dispara espacia las invocaciones.
 * Idempotente: el tag "Campaña MP 12 Cuotas" marca a quién ya se le envió, y
 * un contacto que compró entre medio queda excluido por la consulta.
 *
 * Respeta el botón de pánico global (followups_enabled) y el horario comercial
 * de Argentina (10-19). `?dryRun=1` lista sin enviar.
 */

const TAG_CAMPANIA = 'Campaña MP 12 Cuotas';

// El texto que viaja es el de la PLANTILLA aprobada (templates.ts); acá solo
// se interpola el nombre para el registro en la ficha.
const textoPlantilla = (pila: string) =>
    WHATSAPP_TEMPLATES.promo_12_cuotas.body.replace('{{1}}', pila);

const dormir = (ms: number) => new Promise(r => setTimeout(r, ms));

function horaArgentina(): number {
    // Railway corre en UTC; ART es UTC-3 todo el año.
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

    const dryRun = searchParams.get('dryRun') === '1';
    const batch = Math.min(Math.max(parseInt(searchParams.get('batch') || '5', 10) || 5, 1), 10);

    // Botón de pánico compartido con todos los seguimientos
    const setting = await prisma.systemSetting.findUnique({ where: { key: 'followups_enabled' } });
    if (setting && setting.value !== 'true') {
        return NextResponse.json({ ok: false, motivo: 'followups_enabled=false — campaña pausada' });
    }

    const hora = horaArgentina();
    if (!dryRun && (hora < 10 || hora >= 19)) {
        return NextResponse.json({ ok: false, motivo: `fuera de horario comercial (hora ART ${hora})` });
    }

    const tag = await prisma.tag.upsert({
        where: { name: TAG_CAMPANIA },
        update: {},
        create: { name: TAG_CAMPANIA, color: '#0ea5e9' },
    });

    // Contactos de agosto sin NINGUNA venta, con teléfono, sin el tag de la
    // campaña. Un solo `where` para candidatos y para `restantes`: si divergen,
    // "restantes" miente y la tanda no termina nunca.
    const whereCandidatos = {
        createdAt: { gte: new Date('2026-08-01T00:00:00-03:00'), lt: new Date('2026-09-01T00:00:00-03:00') },
        isDeleted: false,
        phone: { not: null },
        orders: { none: { isDeleted: false } },
        tags: { none: { id: tag.id } },
    } as const;

    const candidatos = await prisma.client.findMany({
        where: whereCandidatos,
        select: { id: true, name: true, phone: true },
        orderBy: { createdAt: 'asc' },
        take: dryRun ? 500 : batch,
    });

    if (dryRun) {
        return NextResponse.json({
            ok: true, dryRun: true,
            pendientes: candidatos.length,
            muestra: candidatos.slice(0, 5).map(c => ({ nombre: c.name, telefono: (c.phone || '').slice(0, 6) + '…' })),
        });
    }

    // Reclamo ATÓMICO del contacto: se inserta el tag en la tabla puente ANTES
    // de enviar, con ON CONFLICT DO NOTHING. Si otra invocación solapada (o un
    // reintento del disparador) ya lo reclamó, el INSERT devuelve 0 filas y se
    // saltea — imposible mandarle dos veces el mismo mensaje. Ante fallo de
    // envío se libera el reclamo (best effort): preferimos el riesgo de saltear
    // un contacto al de duplicarle la campaña con la cuenta bajo la lupa.
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
        // formatPhoneForWhatsApp SIEMPRE antepone 549: un número real tiene al
        // menos 13 caracteres (549 + área + abonado). Menos que eso es un fijo
        // mal cargado que iría a un chat inexistente.
        const telefono = formatPhoneForWhatsApp(c.phone || '');
        if (!telefono || telefono.length < 13) {
            await reclamar(c.id); // no reintentarlo por siempre
            errores.push(`${c.name}: teléfono inválido`);
            continue;
        }

        const claimed = await reclamar(c.id);
        if (claimed === 0) continue; // otra invocación ya lo tomó

        const pila = (c.name || '').trim().split(/\s+/)[0] || 'Hola';
        const texto = textoPlantilla(pila);
        // API OFICIAL: estos contactos no escribieron en 24 h, así que va
        // directo como plantilla aprobada por Meta (la vía sancionada para
        // mensajes salientes — sin riesgo de ban). El texto libre de arriba
        // queda solo para el registro en la ficha.
        const res = await sendWhatsApp({
            chatId: `${telefono}@c.us`,
            message: texto,
            senderName: 'Campaña MP 12 Cuotas',
            isProactive: true,
            forceTemplate: true,
            template: { name: 'promo_12_cuotas', bodyParams: [pila] },
        });

        if (!res.ok) {
            await liberar(c.id); // que el próximo llamado lo reintente
            errores.push(`${c.name}: ${res.error || 'fallo de envío'}`);
            continue;
        }

        enviados++;
        // Trazabilidad en la ficha (el candado ya está puesto desde antes del envío)
        await prisma.interaction.create({
            data: {
                clientId: c.id,
                type: 'NOTE',
                userName: 'Sistema',
                content: `📣 [CAMPAÑA MP 12 CUOTAS] Se envió el aviso de las 12 cuotas por WhatsApp:\n"${texto}"`,
            },
        }).catch((e: any) => errores.push(`${c.name}: enviado y reclamado, pero sin nota en ficha (${e?.message})`));

        // Pausa corta entre envíos (20-40 s) — no después del último: el
        // espaciado grande entre tandas lo pone quien invoca.
        if (i < candidatos.length - 1) {
            await dormir(20000 + Math.floor(Math.random() * 20000));
        }
    }

    const restantes = await prisma.client.count({ where: whereCandidatos });

    return NextResponse.json({ ok: true, enviados, restantes, errores: errores.slice(0, 10) });
}
