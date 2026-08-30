/**
 * Genera el PDF de una orden y lo envía por WhatsApp (+ copia por email si hay
 * mail en la ficha). Un solo lugar para las dos puertas que lo disparan:
 *  - `src/app/api/orders/[id]/send-pdf/route.ts` — un vendedor logueado, desde el panel.
 *  - `src/app/api/bot/orders/[id]/send-pdf/route.ts` — el bot de WhatsApp, en la charla.
 *
 * Extraído el 30/8/26 al agregarle la puerta del bot: dos rutas repitiendo
 * 200 líneas de generación + envío + registro habría sido la próxima vez que
 * alguien "arregla" un caso y el otro queda desactualizado.
 */
import { prisma } from '@/lib/db';
import { sendWhatsApp, explainSendFailure } from '@/lib/whatsapp/send';
import { templateSpec } from '@/lib/whatsapp/templates';
import { PricingService } from '@/services/PricingService';
import { generateOrderPDF } from '@/lib/order-pdf-generator';
import { sendClientEmail, escHtml } from '@/lib/client-email';
import { logAudit } from '@/lib/audit';
import { buildOrderDetailSummary, DETALLE_MARK } from '@/lib/order-detail-summary';
import type { Actor } from '@/lib/actor';

export type SendOrderPdfResult =
  | { ok: true; status: 200; method: 'media'; via?: string; email: boolean }
  | { ok: true; status: 200; method: 'link' }
  | { ok: false; status: number; error: string; code?: string };

export async function sendOrderPdf(
  orderId: string,
  { formattedPhone, text, actor }: { formattedPhone: string; text: string; actor: Actor },
): Promise<SendOrderPdfResult> {
  const senderName = actor.name || 'Atelier';

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      client: true,
      items: { include: { product: true } },
      payments: true,
      prescription: true,
    },
  });

  if (!order || !order.client) {
    return { ok: false, status: 404, error: 'Orden o cliente no encontrado' };
  }

  // Reenvío en caliente: si ya se mandó un PDF de ESTA orden en los últimos
  // 60s, no se repite. El bot puede invocar el tool dos veces en la misma
  // charla (el cliente escribe rápido, o el LLM reintenta ante una respuesta
  // ambigua); createOrder ya tenía este gate de 10s para la creación, acá
  // hace más falta todavía porque un PDF duplicado SÍ le llega al cliente dos
  // veces, a diferencia de una fila de base que nadie ve.
  const unMinutoAtras = new Date(Date.now() - 60000);
  const envioReciente = await prisma.interaction.findFirst({
    where: {
      clientId: order.clientId,
      type: 'NOTE',
      content: { startsWith: '📄 Presupuesto enviado' },
      createdAt: { gte: unMinutoAtras },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (envioReciente) {
    return { ok: true, status: 200, method: 'media', email: false, via: 'ya enviado hace menos de 1 minuto (no se reenvía)' };
  }

  const chat = await prisma.whatsAppChat.findFirst({ where: { clientId: order.clientId } });
  const waId = chat ? chat.waId : `${formattedPhone}@c.us`;
  const chatIdForBot = chat ? chat.id : waId;

  /**
   * Deja el envío asentado en las notas de la ficha, con quién lo mandó y por
   * qué canales. Registra TODOS los desenlaces, también el fallido — que es
   * el que más importa poder reclamar.
   */
  const registrarEnFicha = async (detalle: string, ok: boolean) => {
    let cuerpo = `${ok ? '📄' : '⚠️'} Presupuesto ${ok ? 'enviado' : 'NO enviado'} por ${senderName}: ${detalle}`;
    try {
      cuerpo += `${DETALLE_MARK}Mensaje enviado al cliente:\n${text}\n\n— CONTENIDO DEL PDF —\n${buildOrderDetailSummary(order)}`;
    } catch (e) {
      console.error('[send-order-pdf] No se pudo armar el detalle del presupuesto:', e);
    }
    try {
      await prisma.interaction.create({
        data: {
          clientId: order.clientId,
          type: ok ? 'NOTE' : 'ERROR',
          userId: actor.id,
          userName: senderName,
          content: cuerpo,
        },
      });
    } catch (e) {
      console.error('[send-order-pdf] No se pudo registrar el envío en la ficha:', e);
    }
    logAudit({
      userId: actor.id,
      userName: senderName,
      action: 'OTHER',
      entityType: 'ORDER',
      entityId: orderId,
      details: { evento: 'envio_presupuesto', ok, detalle, clientName: order.client!.name },
    }).catch(console.error);
  };

  let pdfResult: Awaited<ReturnType<typeof generateOrderPDF>> | null = null;
  try {
    pdfResult = await generateOrderPDF(order, order.client, senderName);
  } catch (pdfError: any) {
    console.error('[send-order-pdf] PDF generation failed:', pdfError.message);
  }

  let emailEnviado = false;
  if (pdfResult) {
    emailEnviado = await sendClientEmail({
      to: order.client.email,
      subject: 'Tu presupuesto — Atelier Óptica',
      bodyHtml: `<p>Hola <strong>${escHtml(order.client.name)}</strong>,</p>
<p>Te enviamos el documento adjunto en PDF.</p>
<p style="white-space:pre-wrap">${escHtml(text)}</p>`,
      attachments: [{ filename: pdfResult.filename, content: pdfResult.base64, contentType: 'application/pdf' }],
      label: 'presupuesto',
    });
  }
  const sufijoEmail = emailEnviado ? ` y por email a ${order.client.email}` : '';

  if (pdfResult) {
    try {
      const fin = PricingService.calculateOrderFinancials(order);
      const esVenta = order.orderType === 'SALE' || order.orderType === 'MAYORISTA';
      const nro = `#${String(order.id).slice(-4).toUpperCase()}`;
      const money = (n: number) => `$ ${Number(n || 0).toLocaleString('es-AR')}`;
      const template = esVenta
        ? templateSpec('venta_confirmada', [order.client.name.split(' ')[0], nro, money(fin.totalCard)])
        : templateSpec('presupuesto_pdf', [order.client.name.split(' ')[0], money(fin.totalCard), '7']);

      const res = await sendWhatsApp({
        chatId: chatIdForBot,
        message: text,
        senderName,
        media: { base64: pdfResult.base64, mimetype: 'application/pdf', filename: pdfResult.filename },
        template,
      });

      if (res.ok) {
        await registrarEnFicha(`PDF adjunto por WhatsApp al ${formattedPhone}${res.via === 'template' ? ' (plantilla, fuera de la ventana de 24 h)' : ''}${sufijoEmail}.`, true);
        return { ok: true, status: 200, method: 'media', via: res.via, email: emailEnviado };
      }

      if (res.notSent) {
        await registrarEnFicha(`no salió nada: ${explainSendFailure(res)}${sufijoEmail ? `. Sí se envió${sufijoEmail}` : ''}.`, false);
        return { ok: false, status: res.status === 503 ? 503 : 409, error: explainSendFailure(res), code: res.code };
      }

      await registrarEnFicha(`no pudo adjuntar el PDF por WhatsApp (HTTP ${res.status})${sufijoEmail ? `. Sí se envió${sufijoEmail}` : ''}. Verificar si le llegó antes de reintentar.`, false);
      return { ok: false, status: 502, error: `No se pudo adjuntar el PDF (${res.status}). Verificá si le llegó al cliente antes de reintentar.` };
    } catch (mediaErr: any) {
      if (mediaErr?.status === 503) {
        await registrarEnFicha(`WhatsApp estaba reconectando, no salió nada${sufijoEmail ? `. Sí se envió${sufijoEmail}` : ''}. Hay que reintentar.`, false);
        return { ok: false, status: 503, error: 'WhatsApp se está reconectando: NO se envió nada. Esperá unos segundos y reintentá.' };
      }
      await registrarEnFicha(`error de red enviando el PDF por WhatsApp (${mediaErr.message})${sufijoEmail ? `. Sí se envió${sufijoEmail}` : ''}. Verificar si le llegó antes de reintentar.`, false);
      return { ok: false, status: 502, error: `Error de red enviando el PDF: ${mediaErr.message}. Verificá si le llegó al cliente antes de reintentar.` };
    }
  }

  // Sin PDF generado: único caso donde el link es respaldo (no hubo media, no hay riesgo de duplicado).
  const pdfUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://atelieroptica.com.ar'}/api/orders/${orderId}/pdf`;
  const fallbackText = `${text}\n\n📄 *Descargar Documento:* ${pdfUrl}`;
  try {
    const finB = PricingService.calculateOrderFinancials(order);
    const moneyB = (n: number) => `$ ${Number(n || 0).toLocaleString('es-AR')}`;
    const resLink = await sendWhatsApp({
      chatId: chatIdForBot,
      message: fallbackText,
      senderName,
      template: templateSpec('presupuesto', [order.client.name.split(' ')[0], moneyB(finB.totalCard), moneyB(finB.totalTransfer), moneyB(finB.totalCash)]),
    });

    if (resLink.ok) {
      await registrarEnFicha(`no se pudo generar el PDF, se envió el LINK de descarga por WhatsApp al ${formattedPhone}.`, true);
      return { ok: true, status: 200, method: 'link' };
    }
    await registrarEnFicha(`falló el PDF y también el link de respaldo por WhatsApp (${explainSendFailure(resLink)}).`, false);
    return { ok: false, status: 500, error: explainSendFailure(resLink), code: resLink.code };
  } catch (linkErr: any) {
    await registrarEnFicha(`falló el PDF y también el link de respaldo por error de red (${linkErr.message}).`, false);
    return { ok: false, status: 500, error: `Error de red al enviar el link: ${linkErr.message}` };
  }
}
