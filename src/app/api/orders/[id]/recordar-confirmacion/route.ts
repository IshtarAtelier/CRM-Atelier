import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';
import { sendWhatsApp, explainSendFailure } from '@/lib/whatsapp/send';
import { normalizeArgentinePhone } from '@/services/contact.service';
import { generarVozMp3 } from '@/lib/voz';
import { guionRecordatorioConfirmacion, HORAS_ENTRE_RECORDATORIOS, SELLO_RECORDATORIO, textoRecordatorioConfirmacion } from '@/lib/recordatorio-confirmacion';

export const dynamic = 'force-dynamic';

/**
 * POST /api/orders/[id]/recordar-confirmacion
 *
 * El cliente no respondió la confirmación de su pedido: se le recuerda por
 * WhatsApp que SIN su OK no se procesa (Ishtar, 15/10/2026). Sale un texto y,
 * si la voz se pudo generar (Vertex), un audio que dice lo mismo. Queda en la
 * ficha del cliente firmado por quien apretó el botón, y no se repite antes
 * de HORAS_ENTRE_RECORDATORIOS.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const actor = getActor(request);
    try {
        const { id: orderId } = await params;
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: { id: true, clientId: true, labSentAt: true, labStatus: true, clientConfirmation: true, client: { select: { name: true, phone: true } } },
        });
        if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
        if (!order.labSentAt) return NextResponse.json({ error: 'Todavía no se le mandó la confirmación: primero enviá la venta a fábrica.' }, { status: 409 });
        if (order.clientConfirmation) return NextResponse.json({ error: `El cliente ya respondió (${order.clientConfirmation}): no hace falta recordarle.` }, { status: 409 });
        // Solo mientras el pedido NO se mandó a fabricar: a uno ya en proceso no se le puede decir "sin tu OK no se procesa".
        if (order.labStatus !== 'SENT') return NextResponse.json({ error: `El pedido ya está ${order.labStatus === 'IN_PROGRESS' ? 'en proceso en el laboratorio' : order.labStatus}: el recordatorio diría algo que ya no es cierto.` }, { status: 409 });
        const tel = (order.client.phone || '').replace(/\D/g, '');
        if (tel.length < 10) return NextResponse.json({ error: 'El cliente no tiene un teléfono de WhatsApp válido en la ficha.' }, { status: 400 });

        // Un recordatorio cada tantas horas, no uno por clic.
        const reciente = await prisma.interaction.findFirst({
            where: { clientId: order.clientId, content: { startsWith: SELLO_RECORDATORIO }, createdAt: { gte: new Date(Date.now() - HORAS_ENTRE_RECORDATORIOS * 3_600_000) } },
            select: { createdAt: true, userName: true },
        });
        if (reciente) return NextResponse.json({ error: `Ya se le recordó hace menos de ${HORAS_ENTRE_RECORDATORIOS} h (${reciente.userName || 'alguien'}). Esperá a que conteste.` }, { status: 409 });

        const chat = await prisma.whatsAppChat.findFirst({ where: { clientId: order.clientId }, select: { id: true } });
        const chatId = chat ? chat.id : `${normalizeArgentinePhone(order.client.phone)}@c.us`;
        const nombre = (order.client.name || '').split(' ')[0] || null;
        const senderName = actor.name || 'Atelier';

        // 1. El texto (siempre).
        const texto = await sendWhatsApp({ chatId, message: textoRecordatorioConfirmacion(nombre), senderName, isProactive: false });
        if (!texto.ok) return NextResponse.json({ error: `No se pudo mandar el recordatorio: ${explainSendFailure(texto)}` }, { status: 502 });

        // 2. El audio (si la voz se pudo generar; si no, queda el texto).
        const voz = await generarVozMp3(guionRecordatorioConfirmacion(nombre), { filename: 'confirmacion-de-tu-pedido.mp3' });
        let audioOk = false;
        if (voz) {
            const r = await sendWhatsApp({ chatId, message: '', media: { base64: voz.base64, mimetype: voz.mimetype, filename: voz.filename }, senderName, isProactive: false });
            audioOk = r.ok;
            if (!r.ok) console.error('[recordar-confirmacion] el audio no salió:', explainSendFailure(r));
        }

        // 3. La ficha, firmada, y el AuditLog.
        const linea = `${SELLO_RECORDATORIO}: ${senderName} le recordó por WhatsApp que sin su OK no se procesa el pedido (texto${audioOk ? ' + audio' : voz ? '; el audio no salió' : '; sin audio'}).`;
        await prisma.interaction.create({ data: { clientId: order.clientId, type: 'NOTE', content: linea, userId: actor.id, userName: senderName } }).catch(err => console.error('[recordar-confirmacion] ficha:', err));
        logAudit({ userId: actor.id, userName: senderName, action: 'NOTIFY', entityType: 'ORDER', entityId: orderId, details: { tipo: 'RECORDATORIO_CONFIRMACION', texto: true, audio: audioOk, segundos: voz?.segundos ?? null } }).catch(console.error);

        return NextResponse.json({ ok: true, audio: audioOk, mensaje: audioOk ? 'Recordatorio enviado: texto y audio.' : 'Recordatorio enviado como texto (el audio no se pudo generar).' });
    } catch (error: any) {
        console.error('[recordar-confirmacion]', error);
        return NextResponse.json({ error: error?.message || 'No se pudo mandar el recordatorio.' }, { status: 500 });
    }
}
