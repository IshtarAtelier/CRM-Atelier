// ────────────────────────────────────────────────────────────────────────────
// Confirmación de compra: el repaso completo que el cliente recibe por mail y
// por WhatsApp en el mismo momento en que su presupuesto se convierte en venta
// y se manda a fábrica.
//
// El porqué: a partir de acá el pedido es inmutable, y un dato mal cargado se
// paga en un par de cristales rehecho. El mensaje existe para que el error se
// detecte AHORA, en la ventana previa a que la fábrica empiece — por eso pide
// un OK explícito, dice el teñido incluso cuando no lleva, aclara qué es un
// fotocromático, y le pide al cliente que corrobore el estilo del armazón.
//
// Módulo de COMPOSICIÓN: los datos salen de `describeLabFrameDetails()` y del
// `prescriptionSnapshot` (las mismas fuentes que ve la venta en pantalla), y el
// envío reusa `sendClientEmail` / `fetchWa` / `generateOrderPDF`. Nada de esto
// se reimplementa acá.
// ────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/db';
import { escHtml, sendClientEmail } from '@/lib/client-email';
import { fetchWa } from '@/lib/wa-config';
import { normalizeArgentinePhone } from '@/services/contact.service';
import { resolveStorageUrl } from '@/lib/utils/storage';
import { uploadFile } from '@/lib/storage';
import { STORE_ORIGIN } from '@/lib/constants';
import { describeLabFrameDetails } from '@/lib/lab-frame-summary';
import { frameRecapText, prescriptionRecapText, tienePhotocromatico } from '@/lib/sale-recap-text';
import { logAudit } from '@/lib/audit';
import { isTeñidoAddon } from '@/lib/promo-utils';
import { DETALLE_MARK } from '@/lib/order-detail-summary';

/** Marca de la nota que registra el envío: sirve de candado de idempotencia. */
const MARCA_NOTA = '📧 Confirmación de compra enviada al cliente';

const money = (n: number) => `$${Math.round(n || 0).toLocaleString('es-AR')}`;

function urlAbsoluta(src?: string | null): string | null {
    if (!src) return null;
    const resuelta = resolveStorageUrl(src);
    if (!resuelta) return null;
    if (resuelta.startsWith('http') || resuelta.startsWith('data:')) return resuelta;
    return `${STORE_ORIGIN}${resuelta.startsWith('/') ? '' : '/'}${resuelta}`;
}

/** La receta que vale: la congelada al enviar a fábrica; si no hay, la viva. */
export function recetaDeLaVenta(order: any): any {
    try {
        const snap = order?.prescriptionSnapshot ? JSON.parse(order.prescriptionSnapshot) : null;
        if (snap?.rx) return snap.rx;
    } catch { /* snapshot ilegible: se cae a la receta viva */ }
    return order?.prescription || null;
}

export interface SaleConfirmation {
    subject: string;
    emailHtml: string;
    waText: string;
    /** Foto de la receta, absoluta, para adjuntar/mostrar. null si no hay. */
    prescriptionImageUrl: string | null;
}

/**
 * Arma el mail y el WhatsApp de la confirmación. Función pura: no manda nada,
 * así se puede testear el contenido sin tocar la red.
 *
 * @param esActualizacion true cuando la venta se reabrió y volvió a confirmarse:
 *   el cliente tiene que saber que este repaso PISA al anterior.
 */
export function buildSaleConfirmation(order: any, esActualizacion = false): SaleConfirmation {
    const nro = String(order.id).slice(-4).toUpperCase();
    const nombre = (order.client?.name || '').split(' ')[0] || '';
    const rx = recetaDeLaVenta(order);
    const resumen = describeLabFrameDetails(order);

    const total = order.total || 0;
    const pagado = order.paid || 0;
    const saldo = Math.max(0, total - pagado);

    const items: any[] = order.items || [];

    // Una línea por producto, y si es un teñido, CON su color y su grado. Decir
    // "Teñido Degradé" a secas y más abajo listar el color por separado obliga
    // al cliente a atar cabos; junto se lee de una.
    const lineasDeItems = (lista: any[]): string[] => {
        const vistos = new Set<string>();
        const salida: string[] = [];
        for (const it of lista) {
            // El teñido tiene su propia línea en "Tu anteojo", con color y grado.
            // Repetirlo acá hacía que el cliente lo leyera dos veces y dudara de
            // si eran dos cosas distintas.
            if (isTeñidoAddon(it.product)) continue;
            const nombre = it.product?.name || it.productNameSnapshot || 'Producto';
            const detalle = [it.crystalColor, it.crystalColorNote ? `grado ${it.crystalColorNote}` : null]
                .filter(Boolean).join(', ');
            const linea = `• ${nombre}${detalle ? ` — ${detalle}` : ''}`;
            // Los cristales vienen por ojo (OD y OI): al cliente le importa el
            // par, no la línea contable de cada ojo.
            if (vistos.has(linea)) continue;
            vistos.add(linea);
            salida.push(linea);
        }
        return salida;
    };
    const fotoReceta = urlAbsoluta(rx?.imageUrl);

    // Fotos del armazón sacadas por el vendedor. Se le MUESTRAN al cliente: no
    // se le piden. Él tiene que reconocer su armazón, no fotografiarlo.
    const fotosArmazon = resumen.pairs
        .map(p => urlAbsoluta(p.imageUrl))
        .filter(Boolean) as string[];

    // ── WhatsApp ─────────────────────────────────────────────────────────────
    //
    // Las líneas vacías son las que separan las secciones: sin ellas el mensaje
    // es un bloque de texto que nadie lee hasta el final, que es justo lo que
    // acá hace falta. Por eso lo condicional se marca con `null` y se filtra
    // eso — no las cadenas vacías, que son los espacios a propósito.
    const L = (...lineas: (string | null)[]) => lineas.filter(l => l !== null) as string[];

    const waText = L(
        `*Confirmación de compra — Pedido #${nro}*`,
        esActualizacion ? `⚠️ *PEDIDO ACTUALIZADO* — este repaso reemplaza al anterior.` : null,
        ``,
        `Hola ${nombre}! Tu pedido ya salió a fabricación. Te pasamos el detalle *exacto* de cómo se va a fabricar para que lo revises.`,
        ``,
        `*LO QUE ENCARGASTE*`,
        ...lineasDeItems(items),
        ``,
        `*TU ANTEOJO*`,
        frameRecapText(order, true),
        ``,
        ...(prescriptionRecapText(rx, true)
            ? [`*TU RECETA* (tal cual está cargada)`, prescriptionRecapText(rx, true), ``]
            : []),
        `*PAGO*`,
        `Total: ${money(total)}`,
        `Abonado: ${money(pagado)}`,
        saldo > 0 ? `Saldo pendiente: ${money(saldo)}` : `Saldo: totalmente abonado ✅`,
        ``,
        `*NECESITAMOS TU OK* 🙏`,
        `Revisá que esté todo bien: así es como se va a fabricar.`,
        ``,
        fotosArmazon.length
            ? `• Mirá la foto que te adjuntamos: ¿es el armazón que elegiste?`
            : `• ¿El armazón es el que elegiste?`,
        resumen.tint
            ? `• El teñido va *${resumen.tint.text}*: confirmanos que es el que pediste.`
            : `• Este pedido va *SIN teñido*. Si lo querés con color, decinos ahora.`,
        `• Si hay algún término que no entendés (esférico, cilindro, eje, adición, fotocromático), preguntanos y te lo explicamos.`,
        ``,
        `Respondenos *OK* si está todo bien, o contanos qué corregir. Es el momento: una vez fabricado no se puede cambiar.`,
    ).join('\n');

    // ── Email ────────────────────────────────────────────────────────────────
    const fila = (label: string, valor: string) => `
        <tr>
          <td style="padding:6px 12px 6px 0;font-size:13px;color:#666;white-space:nowrap;vertical-align:top">${escHtml(label)}</td>
          <td style="padding:6px 0;font-size:14px;color:#111;font-weight:600">${escHtml(valor)}</td>
        </tr>`;

    const bloque = (titulo: string, cuerpo: string) => `
        <div style="margin:24px 0;padding:18px;border:1px solid #e5e1da;border-radius:12px;background:#fbfaf8">
          <p style="margin:0 0 12px;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#8a7f6d">${escHtml(titulo)}</p>
          ${cuerpo}
        </div>`;

    // Mismo criterio que el WhatsApp: el teñido va en su bloque, no repetido acá.
    const itemsHtml = items.filter(it => !isTeñidoAddon(it.product)).map(it => {
        const foto = urlAbsoluta((it.product?.imagenesCatalogo || [])[0]);
        const nombreItem = it.product?.name || it.productNameSnapshot || 'Producto';
        const marca = it.product?.brand || '';
        return `
        <tr>
          <td width="72" style="padding:10px 14px 10px 0;border-bottom:1px solid #eee;vertical-align:middle">
            ${foto
                ? `<img src="${foto}" alt="" width="72" height="72" style="display:block;width:72px;height:72px;border-radius:10px;object-fit:cover;background:#f0ece5" />`
                : `<div style="width:72px;height:72px;border-radius:10px;background:#f0ece5"></div>`}
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;vertical-align:middle">
            ${marca ? `<p style="margin:0;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#8a7f6d">${escHtml(marca)}</p>` : ''}
            <p style="margin:2px 0 0;font-size:15px;color:#111">${escHtml(nombreItem)}${it.quantity > 1 ? ` <span style="color:#666">x${it.quantity}</span>` : ''}</p>
          </td>
        </tr>`;
    }).join('');

    const paresHtml = resumen.pairs.map(par => {
        const filas = par.isEmpty
            ? fila('Medidas', 'sin cargar')
            : [
                par.shape ? fila('Forma / aro', par.shape) : '',
                par.measurements ? fila('Medidas', par.measurements) : '',
                par.fitting ? fila('Altura y DNP', par.fitting) : '',
                par.details ? fila('Detalles', par.details) : '',
            ].join('');
        return `
          <p style="margin:14px 0 6px;font-size:12px;font-weight:800;color:#4b3f2f">${escHtml(par.label)}</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">${filas}</table>`;
    }).join('');

    const recetaHtml = rx
        ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">
             ${rx.prescriptionType ? fila('Tipo de lente', String(rx.prescriptionType)) : ''}
             ${fila('Ojo derecho (OD)', `Esf ${rx.sphereOD ?? '—'} · Cil ${rx.cylinderOD ?? '—'} · Eje ${rx.axisOD ?? '—'} · Add ${rx.additionOD ?? rx.addition ?? '—'} · Altura ${rx.heightOD ?? '—'}`)}
             ${fila('Ojo izquierdo (OI)', `Esf ${rx.sphereOI ?? '—'} · Cil ${rx.cylinderOI ?? '—'} · Eje ${rx.axisOI ?? '—'} · Add ${rx.additionOI ?? rx.addition ?? '—'} · Altura ${rx.heightOI ?? '—'}`)}
             ${fila('Distancia interpupilar', String(rx.pd ?? '—'))}
             ${rx.notes ? fila('Observaciones', String(rx.notes)) : ''}
           </table>
           ${fotoReceta ? `<p style="margin:14px 0 0"><img src="${fotoReceta}" alt="Foto de tu receta" style="max-width:100%;border-radius:10px;border:1px solid #e5e1da" /></p>` : ''}`
        : `<p style="margin:0;font-size:14px;color:#666">No hay una receta cargada en este pedido.</p>`;

    const emailHtml = `
      <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:620px;margin:0 auto;color:#111">
        <h1 style="font-size:22px;margin:0 0 6px">Confirmación de compra — Pedido #${escHtml(nro)}</h1>
        ${esActualizacion ? `<p style="margin:0 0 14px;padding:10px 14px;border-radius:10px;background:#fff4e5;color:#7a4a00;font-size:14px;font-weight:700">PEDIDO ACTUALIZADO — este repaso reemplaza al que te enviamos antes.</p>` : ''}
        <p style="font-size:15px;line-height:1.6;color:#333;margin:0 0 4px">Hola ${escHtml(nombre)}, tu pedido ya salió a fabricación.</p>
        <p style="font-size:15px;line-height:1.6;color:#333;margin:0">Abajo está el detalle <strong>exacto</strong> de cómo se va a fabricar. Te pedimos que lo revises con calma: es el momento para corregir cualquier cosa.</p>

        ${bloque('Lo que encargaste', `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">${itemsHtml}</table>`)}

        ${bloque('Armazón y teñido', `
            ${resumen.origin ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">${fila('Armazón', resumen.origin)}</table>` : ''}
            ${paresHtml}
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-top:10px">
              ${fila('Teñido', resumen.tint ? resumen.tint.text : 'NO lleva teñido')}
              ${tienePhotocromatico(order) ? fila('Fotocromático', 'Sí — los cristales se oscurecen solos con el sol y se aclaran en interiores.') : ''}
              ${resumen.notes ? fila('Notas de laboratorio', resumen.notes) : ''}
            </table>
            ${fotosArmazon.length ? `
              <p style="margin:16px 0 8px;font-size:13px;color:#666">Así es el armazón que te llevás:</p>
              <div>${fotosArmazon.map(u => `<img src="${u}" alt="Foto de tu armazón" style="max-width:260px;width:100%;border-radius:12px;border:1px solid #e5e1da;margin:0 8px 8px 0" />`).join('')}</div>` : ''}`)}

        ${bloque('Tu receta, tal cual está cargada', recetaHtml)}

        ${bloque('Pago', `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">
              ${fila('Total', money(total))}
              ${fila('Abonado', money(pagado))}
              ${fila('Saldo pendiente', saldo > 0 ? money(saldo) : 'Totalmente abonado')}
            </table>`)}

        <div style="margin:24px 0;padding:18px;border:2px solid #d8cfc0;border-radius:12px;background:#fffdf8">
          <p style="margin:0 0 10px;font-size:16px;font-weight:800;color:#111">Necesitamos tu OK 🙏</p>
          <p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:#333">Revisá que esté todo bien: <strong>así es como se va a fabricar</strong>.</p>
          <ul style="margin:0 0 10px;padding-left:20px;font-size:14px;line-height:1.8;color:#333">
            <li>${fotosArmazon.length ? 'Mirá la foto del armazón acá arriba: ¿es el que elegiste?' : '¿El armazón es el que elegiste?'}</li>
            <li>${resumen.tint
                ? `El teñido va <strong>${escHtml(resumen.tint.text)}</strong>: confirmanos que es el que pediste.`
                : 'Si querés que lleven teñido, decinos ahora — este pedido va sin teñido.'}</li>
            <li>Si hay algún término que no entendés (esférico, cilindro, eje, adición, fotocromático), preguntanos y te lo explicamos con gusto.</li>
          </ul>
          <p style="margin:0;font-size:14px;line-height:1.7;color:#333">Respondé este mail o escribinos por WhatsApp con un <strong>OK</strong> si está todo bien, o contanos qué hay que corregir. Una vez fabricado ya no se puede cambiar.</p>
        </div>
      </div>`;

    return {
        subject: `${esActualizacion ? 'Pedido actualizado' : 'Confirmá tu pedido'} #${nro} — así se va a fabricar`,
        emailHtml,
        waText,
        prescriptionImageUrl: fotoReceta,
    };
}

/** Todo lo que la confirmación necesita leer de la orden, en un solo lugar. */
const SELECT_CONFIRMACION = {
    id: true, total: true, paid: true, orderType: true, isLocked: true,
    clientId: true, labSentBy: true, labSentAt: true,
    appliedPromoName: true, prescriptionSnapshot: true,
    frameSource: true, userFrameBrand: true, userFrameModel: true,
    labFrameShape: true, labFrameDetails: true,
    frameA: true, frameB: true, frameDbl: true, frameEdc: true,
    labFrameShape2: true, labFrameDetails2: true,
    frameImageUrl: true, frameImageUrl2: true,
    frames: { orderBy: { position: 'asc' } },
    labHeightOD: true, labHeightOI: true, labHeightOD2: true, labHeightOI2: true,
    frameA2: true, frameB2: true, frameDbl2: true, frameEdc2: true,
    labColor: true, labTreatment: true, labNotes: true,
    client: { select: { id: true, name: true, email: true, phone: true } },
    prescription: true,
    items: {
        select: {
            id: true, quantity: true, price: true, eye: true,
            productNameSnapshot: true, productCategorySnapshot: true, productTypeSnapshot: true,
            product: { select: { name: true, brand: true, category: true, type: true, imagenesCatalogo: true } },
        },
    },
} as const;

export interface EnvioConfirmacionResultado {
    email: boolean;
    whatsapp: boolean;
    /** No se envió porque ya se había enviado antes para esta versión del pedido. */
    yaEnviada?: boolean;
    pdfUrl?: string | null;
}

/**
 * Manda la confirmación por mail y por WhatsApp, guarda el PDF y deja la nota
 * en la ficha con el resultado REAL de cada canal.
 *
 * Nunca lanza: la venta ya está hecha y confirmada: que falle un aviso no puede
 * voltearla. Lo que falla queda escrito en la ficha para que una persona lo vea.
 */
export async function sendSaleConfirmation(
    orderId: string,
    opts: { esActualizacion?: boolean; version?: number } = {}
): Promise<EnvioConfirmacionResultado> {
    const { esActualizacion = false, version } = opts;
    const resultado: EnvioConfirmacionResultado = { email: false, whatsapp: false };

    try {
        const order: any = await prisma.order.findUnique({ where: { id: orderId }, select: SELECT_CONFIRMACION });
        if (!order || !order.client) return resultado;

        // Idempotencia: una confirmación por versión del pedido. Sin esto, dos
        // guardados seguidos le mandan el mismo repaso dos veces al cliente.
        const sello = `${MARCA_NOTA} · #${String(order.id).slice(-4).toUpperCase()}${version ? ` (v${version})` : ''}`;
        const yaHay = await prisma.interaction.findFirst({
            where: { clientId: order.client.id, content: { startsWith: sello } },
            select: { id: true },
        });
        if (yaHay) return { ...resultado, yaEnviada: true };

        const conf = buildSaleConfirmation(order, esActualizacion);

        // PDF del pedido: se adjunta al mail, se manda por WhatsApp y queda
        // guardado para la ficha del cliente.
        let pdf: { base64: string; filename: string } | null = null;
        let pdfUrl: string | null = null;
        try {
            const { generateOrderPDF } = await import('@/lib/order-pdf-generator');
            pdf = await generateOrderPDF(order, order.client, order.labSentBy || undefined);
            pdfUrl = await uploadFile(
                Buffer.from(pdf.base64, 'base64'),
                `confirmaciones/${order.id}-${version || 1}.pdf`,
                'application/pdf',
            );
        } catch (err) {
            console.error('[Confirmación de compra] No se pudo generar/guardar el PDF:', err);
        }

        // ── Email ────────────────────────────────────────────────────────────
        resultado.email = await sendClientEmail({
            to: order.client.email,
            subject: conf.subject,
            bodyHtml: conf.emailHtml,
            label: 'confirmación de compra',
            ...(pdf ? { attachments: [{ filename: pdf.filename, content: Buffer.from(pdf.base64, 'base64'), contentType: 'application/pdf' }] } : {}),
        });

        // ── WhatsApp ─────────────────────────────────────────────────────────
        const tel = (order.client.phone || '').replace(/\D/g, '');
        if (tel.length >= 10) {
            try {
                const res = await fetchWa('/api/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chatId: `${normalizeArgentinePhone(tel)}@c.us`,
                        message: conf.waText,
                        senderName: 'Sistema Atelier',
                        ...(pdf ? { media: { base64: pdf.base64, mimetype: 'application/pdf', filename: pdf.filename } } : {}),
                    }),
                });
                resultado.whatsapp = res.ok;
            } catch (err) {
                console.error('[Confirmación de compra] WhatsApp falló:', err);
            }
        }

        resultado.pdfUrl = pdfUrl;

        // ── Registro en la ficha, con el resultado real de cada canal ────────
        // Resumen arriba, y detrás del separador la COPIA EXACTA que recibió el
        // cliente (la ficha la muestra colapsada). Es lo que se le contesta a un
        // "a mí me dijeron otra cosa".
        const detalle = [
            sello,
            `Email: ${resultado.email ? `✅ enviado a ${order.client.email}` : (order.client.email ? '❌ NO se pudo enviar' : '— sin email cargado')}`,
            `WhatsApp: ${resultado.whatsapp ? `✅ enviado al ${order.client.phone}` : (tel.length >= 10 ? '❌ NO se pudo enviar' : '— sin teléfono válido')}`,
            pdfUrl ? `PDF del pedido: ${resolveStorageUrl(pdfUrl)}` : `PDF del pedido: ❌ no se pudo generar`,
        ].join('\n') + DETALLE_MARK + conf.waText;

        await prisma.interaction.create({
            data: {
                clientId: order.client.id,
                type: 'NOTE',
                content: detalle,
                userId: null,
                userName: 'Sistema',
            },
        }).catch(err => console.error('[Confirmación de compra] No se pudo registrar la nota:', err));

        // Si NINGÚN canal salió, alguien tiene que enterarse y mandarla a mano.
        if (!resultado.email && !resultado.whatsapp) {
            await prisma.clientTask.create({
                data: {
                    clientId: order.client.id,
                    description: `⚠️ La confirmación de compra del pedido #${String(order.id).slice(-4).toUpperCase()} NO llegó ni por mail ni por WhatsApp. Enviarla a mano y pedirle el OK.`,
                    status: 'PENDING',
                    type: 'TASK',
                },
            }).catch(err => console.error('[Confirmación de compra] No se pudo crear la tarea de aviso:', err));
        }

        logAudit({
            userId: null,
            userName: 'Sistema',
            action: 'NOTIFY',
            entityType: 'ORDER',
            entityId: order.id,
            details: { tipo: 'confirmacion_compra', email: resultado.email, whatsapp: resultado.whatsapp, version: version || 1 },
        }).catch(err => console.error('[Confirmación de compra] audit:', err));

        return resultado;
    } catch (err) {
        console.error('[Confirmación de compra] Error inesperado:', err);
        return resultado;
    }
}
