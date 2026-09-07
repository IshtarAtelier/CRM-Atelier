import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { PricingService } from '@/services/PricingService';
import { sendWhatsApp } from '@/lib/whatsapp/send';
import { templateSpec } from '@/lib/whatsapp/templates';
import { normalizeArgentinePhone } from '@/services/contact.service';
import { SYSTEM_ACTOR } from '@/lib/actor';

export const dynamic = 'force-dynamic';

/**
 * Recordatorio de SALDO PENDIENTE — corre una vez por hora.
 *
 * A quién: al cliente cuyo pedido está listo para retirar, al que YA se le
 * avisó, y que a los 7 días sigue con saldo sin pagar. Pedido de Ishtar el
 * 7/9/26, junto con la cláusula de los 7 días hábiles que suma la plantilla
 * `pedido_listo_saldo_v4`.
 *
 * Sale UNA sola vez. El segundo golpe lo decide una persona: insistir solo con
 * plata es lo que hace que un cliente deje de contestar.
 *
 * NO mira `followups_enabled`, igual que el aviso de pedido listo. Ese
 * interruptor pausa lo comercial (campañas y toques del embudo); esto es plata
 * que el cliente debe por una compra que ya hizo. Si se apagara con el mismo
 * switch, pausar las campañas dejaría de cobrar.
 *
 * El saldo sale de `PricingService`, nunca de una resta a mano: el saldo NO es
 * lista − cobrado, y calcularlo aparte ya inventó 76 saldos fantasma.
 */

const DIAS_PARA_RECORDAR = 7;
const HORA_DESDE = 10;
const HORA_HASTA = 19;

function horaArgentina(): number {
    return Number(new Intl.DateTimeFormat('es-AR', {
        timeZone: 'America/Argentina/Cordoba', hour: '2-digit', hour12: false,
    }).format(new Date()));
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET no está configurado.' }, { status: 500 });
    if (secret !== cronSecret && token !== cronSecret) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const dryRun = searchParams.get('dryRun') === '1';
    const hora = horaArgentina();
    if (!dryRun && (hora < HORA_DESDE || hora >= HORA_HASTA)) {
        return NextResponse.json({ ok: true, motivo: `fuera de horario (${HORA_DESDE}-${HORA_HASTA} ART)`, enviados: [] });
    }

    const corte = new Date(Date.now() - DIAS_PARA_RECORDAR * 24 * 3600 * 1000);

    // Pedidos listos, avisados hace más de 7 días, sin recordatorio previo.
    // "Avisado" = Meta confirmó que salió (SENT/DELIVERED/READ). Un mensaje
    // RECHAZADO no cuenta: a ese cliente todavía le debemos el primer aviso, y
    // el recordatorio de saldo llegaría sin contexto.
    const candidatos = await prisma.$queryRawUnsafe<any[]>(`
        SELECT o.id AS "orderId", c.id AS "clientId", c.name, c.phone
          FROM "Order" o
          JOIN "Client" c ON c.id = o."clientId"
         WHERE o."isDeleted" = false
           AND o."labStatus" = 'READY'
           AND c.phone IS NOT NULL
           AND EXISTS (
                 SELECT 1 FROM "WhatsAppMessage" m
                   JOIN "WhatsAppChat" ch ON ch.id = m."chatId"
                  WHERE ch."clientId" = c.id
                    AND m."templateName" LIKE 'pedido_listo_saldo%'
                    AND m.status IN ('SENT','DELIVERED','READ')
                    AND m."createdAt" < $1)
           AND NOT EXISTS (
                 SELECT 1 FROM "WhatsAppMessage" m
                   JOIN "WhatsAppChat" ch ON ch.id = m."chatId"
                  WHERE ch."clientId" = c.id
                    AND m."templateName" = 'recordatorio_saldo')
    `, corte);

    const enviados: any[] = [];
    const salteados: any[] = [];

    for (const cand of candidatos) {
        const order: any = await prisma.order.findUnique({
            where: { id: cand.orderId },
            include: { items: { include: { product: true } }, payments: true },
        });
        if (!order) continue;

        const f: any = PricingService.calculateOrderFinancials(order);
        // Pagó en el medio: no hay nada que recordar.
        if (!f.hasBalance) { salteados.push({ nombre: cand.name, motivo: 'ya no tiene saldo' }); continue; }

        const telefono = normalizeArgentinePhone(cand.phone);
        if (!telefono) { salteados.push({ nombre: cand.name, motivo: 'teléfono inválido' }); continue; }

        const nombre = String(cand.name || '').split(' ')[0] || 'Hola';
        const nro = `#${String(cand.orderId).slice(-4).toUpperCase()}`;
        const fmt = (n: number) => `$ ${Number(n || 0).toLocaleString('es-AR')}`;

        if (dryRun) { enviados.push({ nombre, nro, saldo: fmt(f.remainingCash), simulado: true }); continue; }

        const r = await sendWhatsApp({
            chatId: `${telefono}@c.us`,
            message: '',
            senderName: SYSTEM_ACTOR.name,
            isProactive: true,
            forceTemplate: true,
            template: templateSpec('recordatorio_saldo', [
                nombre, nro, fmt(f.remainingCard), fmt(f.remainingTransfer), fmt(f.remainingCash),
            ]),
        }).catch((e: any) => ({ ok: false, error: e?.message }));

        if (r?.ok) {
            enviados.push({ nombre, nro, saldo: fmt(f.remainingCash) });
            await prisma.interaction.create({
                data: {
                    clientId: cand.clientId, type: 'FOLLOWUP',
                    userId: SYSTEM_ACTOR.id, userName: SYSTEM_ACTOR.name,
                    content: `📲 Recordatorio automático de saldo pendiente del pedido ${nro} (${fmt(f.remainingCash)} en efectivo).`,
                },
            }).catch(console.error);
        } else {
            salteados.push({ nombre: cand.name, motivo: (r as any)?.error || 'no se pudo enviar' });
        }
    }

    return NextResponse.json({ ok: true, dryRun, candidatos: candidatos.length, enviados, salteados });
}
