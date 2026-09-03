/**
 * Reenvía lo que Meta RECHAZÓ (WhatsAppMessage.status = FAILED) y que el CRM
 * había dado por enviado. Nació el 3/9/26: la cuenta de WhatsApp Business
 * tenía un problema de pago (error 131042 "Business eligibility payment
 * issue") y durante una semana TODA plantilla — avisos de pedido listo,
 * presupuestos, comprobantes — moría en Meta mientras la ficha decía "✅
 * enviado". Este script los recupera una vez que el pago está arreglado.
 *
 *   DATABASE_URL=$PROD_DATABASE_URL WA_SERVER_URL=… BOT_API_KEY=… \
 *     npx tsx scripts/maintenance/whatsapp-api-oficial/reenviar-rechazados-por-meta.ts            # dry-run: lista qué haría
 *     … --apply                                                                                    # reenvía
 *     … --desde 2026-08-28 --solo pedido-listo|presupuesto                                         # filtros
 *
 * Qué reenvía y qué no:
 *   - PEDIDO LISTO: solo si el pedido sigue en READY (no entregado). Vuelve a
 *     salir por BotService.notifyOrderReady, con saldo actualizado.
 *   - PRESUPUESTO enviado por una persona: el último presupuesto (QUOTE) vivo
 *     del cliente, como PDF con plantilla (sendOrderPdf), firmado "Sistema".
 *   - Campañas, "retomar conversación", comprobantes: se LISTAN y no se
 *     reenvían (son marketing, o el pago ya se avisó de otra forma).
 * Pega contra la base que diga DATABASE_URL: correrlo con la de producción
 * SOLO con OK explícito. Nunca reenvía dos veces el mismo FAILED: al reenviar
 * deja una Interaction "♻️ Reenviado" y la busca antes de volver a mandar.
 */
import 'dotenv/config';
import { prisma } from '../../../src/lib/db';
import { BotService } from '../../../src/services/bot.service';
import { sendOrderPdf } from '../../../src/lib/checkout/send-order-pdf';
import { SYSTEM_ACTOR } from '../../../src/lib/actor';
import { formatPhoneForWhatsApp } from '../../../src/lib/phone-utils';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const desde = args.includes('--desde') ? new Date(args[args.indexOf('--desde') + 1]) : new Date('2026-08-28');
const solo = args.includes('--solo') ? args[args.indexOf('--solo') + 1] : null;

type Tipo = 'pedido-listo' | 'presupuesto' | 'campania' | 'retomar' | 'comprobante' | 'otro';
function clasificar(m: { content: string; senderName: string | null }): Tipo {
    const t = m.content || '';
    if (/listo para retirar/i.test(t)) return 'pedido-listo';
    if (/^Campaña/i.test(m.senderName || '')) return 'campania';
    if (/te enviamos el presupuesto/i.test(t)) return 'presupuesto';
    if (/registramos tu pago/i.test(t)) return 'comprobante';
    if (/por tu consulta sobre/i.test(t)) return 'retomar';
    return 'otro';
}

async function main() {
    const fallidos = await prisma.whatsAppMessage.findMany({
        where: { direction: 'OUTBOUND', status: 'FAILED', createdAt: { gte: desde } },
        select: { id: true, createdAt: true, content: true, senderName: true, chat: { select: { id: true, waId: true, realPhone: true, clientId: true } } },
        orderBy: { createdAt: 'asc' },
    });
    console.log(`${APPLY ? 'REENVIANDO' : 'DRY-RUN'} — ${fallidos.length} rechazados por Meta desde ${desde.toISOString().slice(0, 10)}\n`);

    // Un reenvío por cliente y tipo: si el vendedor apretó tres veces el mismo
    // presupuesto, al cliente le llega UNO.
    const hechos = new Set<string>();
    const resumen: Record<string, number> = {};
    const cuenta = (k: string) => { resumen[k] = (resumen[k] || 0) + 1; };

    for (const m of fallidos) {
        const tipo = clasificar(m);
        const clienteId = m.chat.clientId;
        const etiqueta = `${m.createdAt.toISOString().slice(5, 16)} ${tipo.padEnd(13)} ${m.chat.waId}`;
        if (solo && solo !== tipo) { cuenta('filtrado'); continue; }
        if (!clienteId) { console.log(`- ${etiqueta}: sin ficha de cliente, se salta`); cuenta('sin ficha'); continue; }
        const llave = `${clienteId}|${tipo}`;
        if (hechos.has(llave)) { cuenta('duplicado (ya reenviado en esta corrida)'); continue; }

        if (tipo === 'campania' || tipo === 'retomar' || tipo === 'comprobante' || tipo === 'otro') {
            console.log(`- ${etiqueta}: ${tipo} — solo se lista, no se reenvía`);
            cuenta(`listado: ${tipo}`);
            continue;
        }

        const yaReenviado = await prisma.interaction.findFirst({
            where: { clientId, content: { startsWith: `♻️ Reenviado (rechazo de Meta ${m.id})` } },
            select: { id: true },
        });
        if (yaReenviado) { console.log(`- ${etiqueta}: ya reenviado antes`); cuenta('ya reenviado'); continue; }

        if (tipo === 'pedido-listo') {
            const sufijo = (m.content.match(/#([A-Z0-9]{4})/) || [])[1];
            const order = await prisma.order.findFirst({
                where: { clientId, isDeleted: false, ...(sufijo ? { id: { endsWith: sufijo.toLowerCase() } } : {}) },
                include: { client: true, items: { include: { product: true } }, payments: true },
                orderBy: { createdAt: 'desc' },
            });
            if (!order) { console.log(`- ${etiqueta}: pedido ${sufijo || '?'} no encontrado`); cuenta('pedido no encontrado'); continue; }
            if (order.labStatus !== 'READY') { console.log(`- ${etiqueta}: pedido #${sufijo} ya no está en READY (${order.labStatus}), no se reenvía`); cuenta('pedido ya entregado/otro estado'); continue; }
            console.log(`- ${etiqueta}: ${APPLY ? 'REENVIANDO' : 'reenviaría'} aviso de pedido listo #${sufijo} a ${order.client?.name}`);
            if (APPLY) {
                const ok = await BotService.notifyOrderReady(order);
                await marcar(clienteId, m.id, `aviso de pedido listo #${sufijo}`, ok);
                cuenta(ok ? 'REENVIADO pedido listo' : 'FALLÓ pedido listo');
            } else cuenta('reenviaría pedido listo');
            hechos.add(llave);
            continue;
        }

        // presupuesto
        const quote = await prisma.order.findFirst({
            where: { clientId, isDeleted: false, orderType: 'QUOTE' },
            include: { client: true, items: { include: { product: true } } },
            orderBy: { createdAt: 'desc' },
        });
        if (!quote) { console.log(`- ${etiqueta}: el cliente ya no tiene presupuesto vivo (¿compró?), no se reenvía`); cuenta('sin presupuesto vivo'); continue; }
        const tel = formatPhoneForWhatsApp(quote.client?.phone || m.chat.realPhone || m.chat.waId);
        const nombre = (quote.client?.name || '').split(' ')[0] || 'Hola';
        const articulos = [...new Set((quote.items || []).map(it => it.product?.name || it.productNameSnapshot).filter(Boolean))].join(', ') || 'tus anteojos';
        console.log(`- ${etiqueta}: ${APPLY ? 'REENVIANDO' : 'reenviaría'} presupuesto #${quote.id.slice(-4).toUpperCase()} en PDF a ${quote.client?.name}`);
        if (APPLY) {
            const r = await sendOrderPdf(quote.id, {
                formattedPhone: tel,
                text: `Hola ${nombre}, te reenviamos tu presupuesto por: ${articulos}. Disculpá la demora.\n\nAtelier Óptica, la óptica mejor calificada en Córdoba ⭐⭐⭐⭐⭐.`,
                actor: SYSTEM_ACTOR,
            });
            await marcar(clienteId, m.id, `presupuesto #${quote.id.slice(-4).toUpperCase()} en PDF`, r.ok);
            cuenta(r.ok ? 'REENVIADO presupuesto' : `FALLÓ presupuesto (${r.error})`);
        } else cuenta('reenviaría presupuesto');
        hechos.add(llave);
    }

    console.log('\nResumen:');
    console.table(resumen);
    await prisma.$disconnect();
}

async function marcar(clientId: string, failedId: string, que: string, ok: boolean) {
    await prisma.interaction.create({
        data: {
            clientId, type: ok ? 'NOTE' : 'ERROR', userName: 'Sistema',
            content: `♻️ Reenviado (rechazo de Meta ${failedId}): ${que} — ${ok ? 'salió' : 'NO salió'}. El original había sido rechazado por Meta por el problema de pago de la cuenta (131042).`,
        },
    });
}

main().catch(e => { console.error(e); process.exit(1); });
