import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendWhatsApp } from '@/lib/whatsapp/send';
import { formatPhoneForWhatsApp } from '@/lib/phone-utils';
import { WHATSAPP_TEMPLATES, renderTemplate } from '@/lib/whatsapp/templates';
import { saludoSegunHoraArgentina } from '@/lib/whatsapp/saludo';
import { hasClosedOrder } from '@/lib/checkout/purchase-guard';
import { ensureClientForAbandonedCart } from '@/services/cart-recovery.service';
import { registrarSeguimientoEnviado } from '@/lib/embudo/registrar-seguimiento';
import { esNoCliente } from '@/lib/no-cliente';
import { SYSTEM_ACTOR } from '@/lib/actor';
import { BUSINESS_INFO } from '@/lib/business-info';

/**
 * Campaña: retomar por WhatsApp los carritos abandonados de la tienda.
 * Pedido de Ishtar del 5/9/26: "atendé todos los que fueron carritos
 * abandonados y enviales WhatsApp también para retomar su compra".
 *
 * Misma mecánica por tandas que campania-seguimiento y campania-mp-12-cuotas:
 * tandas chicas (`batch`, default 5, tope 10) con pausas de 20-40 s, dedup
 * atómico por etiqueta en la ficha, respeta `followups_enabled` y el horario
 * comercial ART (9-20). `?dryRun=1` lista sin mandar — ES EL DEFAULT DE
 * TRABAJO: primero se mira la audiencia, después se manda.
 *
 * Quién entra (`?dias=`, default 30):
 *   - CheckoutSession que no terminó en compra (ni COMPLETED/RECOVERED/FINALIZED),
 *   - con teléfono, con última actividad dentro de la ventana,
 *   - sin venta cerrada después (candado `hasClosedOrder`, el mismo del mail),
 *   - con ficha (se crea si no la tiene, igual que en Oportunidades) que no
 *     esté marcada como no-cliente ni haya recibido ya esta campaña.
 *
 * Qué se manda: la plantilla APROBADA `seguimiento_carrito` (utility). Texto
 * exacto de Meta, nombre de pila + saludo según hora ART. Y como es un toque
 * del embudo, deja el rastro de siempre: etiqueta SEGUIMIENTO_DIA_1 en el
 * chat + nota firmada en la ficha (registrar-seguimiento.ts), así la tarjeta
 * y el panel de Oportunidades saben que ya se le escribió.
 */

const TAG_CAMPANA = 'Campaña Carrito WhatsApp';
const PLANTILLA = 'seguimiento_carrito' as const;
const ESTADOS_CERRADOS = ['COMPLETED', 'RECOVERED', 'FINALIZED'];

const dormir = (ms: number) => new Promise(r => setTimeout(r, ms));
const horaArgentina = () => (new Date().getUTCHours() + 24 - 3) % 24;

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
    if (searchParams.get('secret') !== cronSecret && token !== cronSecret) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const dryRun = searchParams.get('dryRun') !== '0'; // manda SOLO con ?dryRun=0 explícito
    const dias = Math.min(Math.max(parseInt(searchParams.get('dias') || '30', 10) || 30, 1), 365);
    const batch = Math.min(Math.max(parseInt(searchParams.get('batch') || '5', 10) || 5, 1), 10);

    const setting = await prisma.systemSetting.findUnique({ where: { key: 'followups_enabled' } });
    if (!dryRun && setting && setting.value !== 'true') {
        return NextResponse.json({ ok: false, motivo: 'followups_enabled=false — campaña pausada (interruptor "Campañas" del buzón)' });
    }
    const hora = horaArgentina();
    if (!dryRun && (hora < 9 || hora >= 20)) {
        return NextResponse.json({ ok: false, motivo: `fuera de horario comercial (hora ART ${hora})` });
    }

    const tag = await prisma.tag.upsert({
        where: { name: TAG_CAMPANA },
        update: {},
        create: { name: TAG_CAMPANA, color: '#0ea5e9' },
    });
    const NUCLEO_TEL_OPTICA = BUSINESS_INFO.phoneE164.replace(/\D/g, '').slice(-10);
    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

    // Sesiones candidatas: una por persona (la más reciente), para no
    // escribirle dos veces a quien abandonó dos carritos.
    const sesiones = await prisma.checkoutSession.findMany({
        where: {
            status: { notIn: ESTADOS_CERRADOS },
            phone: { not: null, notIn: [''] },
            updatedAt: { gte: desde },
        },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, clientId: true, email: true, firstName: true, lastName: true, phone: true, total: true, cartData: true, updatedAt: true },
    });
    const vistas = new Set<string>();
    const unicas = sesiones.filter(s => {
        const clave = formatPhoneForWhatsApp(s.phone || '');
        if (!clave || clave.length < 13 || vistas.has(clave)) return false;
        vistas.add(clave);
        return !clave.includes(NUCLEO_TEL_OPTICA);
    });

    // Filtros que requieren mirar la ficha / las ventas. Se resuelven acá y no
    // en el where porque la ficha puede no existir todavía.
    type Candidato = { sesion: typeof unicas[number]; clientId: string; nombre: string; telefono: string };
    const candidatos: Candidato[] = [];
    const descartes = { yaCompro: 0, yaRecibio: 0, noCliente: 0, sinFicha: 0 };
    for (const s of unicas) {
        if (await hasClosedOrder(s.email, s.phone)) { descartes.yaCompro++; continue; }
        const clientId = s.clientId ?? await ensureClientForAbandonedCart(s);
        if (!clientId) { descartes.sinFicha++; continue; }
        const ficha = await prisma.client.findUnique({
            where: { id: clientId },
            select: { name: true, isDeleted: true, tags: { select: { id: true, name: true } } },
        });
        if (!ficha || ficha.isDeleted) { descartes.sinFicha++; continue; }
        if (ficha.tags.some(t => t.id === tag.id)) { descartes.yaRecibio++; continue; }
        if (esNoCliente(ficha.tags)) { descartes.noCliente++; continue; }
        const nombre = (s.firstName || ficha.name || '').trim().split(/\s+/)[0] || 'Hola';
        candidatos.push({ sesion: s, clientId, nombre, telefono: formatPhoneForWhatsApp(s.phone || '') });
    }

    const saludo = saludoSegunHoraArgentina();
    if (dryRun) {
        return NextResponse.json({
            ok: true,
            dryRun: true,
            plantilla: PLANTILLA,
            textoEjemplo: renderTemplate(PLANTILLA, ['Julio', saludo]),
            ventanaDias: dias,
            carritosEnVentana: sesiones.length,
            personasUnicas: unicas.length,
            descartes,
            pendientes: candidatos.length,
            lista: candidatos.map(c => ({
                nombre: c.nombre,
                telefono: c.telefono.slice(0, 7) + '…',
                carrito: `$${Math.round(c.sesion.total || 0).toLocaleString('es-AR')}`,
                abandonado: c.sesion.updatedAt.toISOString().slice(0, 10),
            })),
            comoMandar: `mismo GET con &dryRun=0 (manda de a ${batch}; repetir hasta pendientes=0)`,
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

    const tanda = candidatos.slice(0, batch);
    let enviados = 0;
    const errores: string[] = [];
    for (let i = 0; i < tanda.length; i++) {
        const c = tanda[i];
        const claimed = await reclamar(c.clientId);
        if (claimed === 0) continue; // otra corrida se lo llevó

        const bodyParams = [c.nombre, saludo];
        const texto = renderTemplate(PLANTILLA, bodyParams);
        const res = await sendWhatsApp({
            chatId: `${c.telefono}@c.us`,
            message: texto,
            senderName: TAG_CAMPANA,
            isProactive: true,
            forceTemplate: true,
            template: { name: WHATSAPP_TEMPLATES[PLANTILLA].name, bodyParams },
        });

        if (!res.ok) {
            const permanente = /Destino inválido/i.test(res.error || '');
            if (permanente) await reclamar(c.clientId); else await liberar(c.clientId);
            errores.push(`${c.nombre}: ${res.error || 'fallo de envío'}`);
            continue;
        }

        enviados++;
        await prisma.interaction.create({
            data: {
                clientId: c.clientId,
                type: 'FOLLOWUP',
                userName: SYSTEM_ACTOR.name,
                content: `📣 [${TAG_CAMPANA}] Se envió por WhatsApp (carrito de $${Math.round(c.sesion.total || 0).toLocaleString('es-AR')}):\n"${texto}"`,
            },
        }).catch((e: any) => errores.push(`${c.nombre}: enviado, pero sin nota en ficha (${e?.message})`));

        // Rastro del embudo: la etiqueta del chat que hace que la tarjeta y el
        // panel sepan que ya se le escribió. El chat lo creó el envío.
        const chat = await prisma.whatsAppChat.findFirst({
            where: { OR: [{ waId: c.telefono }, { waId: `${c.telefono}@c.us` }, { clientId: c.clientId }] },
            orderBy: { lastMessageAt: 'desc' },
            select: { id: true },
        });
        if (chat) {
            await registrarSeguimientoEnviado({ chatId: chat.id, plantilla: PLANTILLA, actor: { ...SYSTEM_ACTOR, name: TAG_CAMPANA } })
                .catch((e: any) => errores.push(`${c.nombre}: enviado, sin etiqueta de embudo (${e?.message})`));
        }

        if (i < tanda.length - 1) await dormir(20000 + Math.floor(Math.random() * 20000));
    }

    return NextResponse.json({
        ok: true,
        plantilla: PLANTILLA,
        enviados,
        pendientes: candidatos.length - tanda.length,
        errores: errores.slice(0, 10),
    });
}
