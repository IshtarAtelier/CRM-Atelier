import { sendEmail } from '@/lib/email';
import { getFileBuffer } from '@/lib/storage';

const EXT_CONTENT_TYPES: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    pdf: 'application/pdf',
};

/** Pago anterior donde ya figura cargado el mismo número de operación. */
export interface DuplicatePaymentRef {
    clientName: string;
    clientId?: string;
    orderId: string;
}

interface ReceiptUploadedInfo {
    clientName: string;
    clientId?: string;
    orderId: string;
    amount: number;
    method: string;
    reference?: string | null;
    receiptUrl: string;
    /**
     * Resultado de la auditoría IA:
     * - []        → auditado, sin observaciones
     * - [errores] → auditado, con observaciones (duplicado, monto, CUIT, fecha)
     * - null      → la auditoría no pudo correr (falla de IA / archivo ilegible)
     */
    auditErrors: string[] | null;
    /** Si hubo duplicado, los pagos anteriores con el mismo nº de operación. */
    duplicateRefs?: DuplicatePaymentRef[];
}

function appUrl() {
    return process.env.NEXT_PUBLIC_APP_URL || 'https://crm-atelier-production-ae72.up.railway.app';
}

function clientFichaLink(clientId?: string) {
    return clientId ? `${appUrl()}/admin/contactos?id=${clientId}` : `${appUrl()}/admin/ventas`;
}

/**
 * Avisa al admin por email cada vez que se sube un comprobante de pago,
 * adjuntando la imagen (o el PDF) y el veredicto del auditor IA en el mismo
 * correo. Aplica a ventas web y de local. Se dispara al final de
 * ReceiptAgentService.analyzeReceipt, así el mail llega con la foto y el
 * resultado juntos.
 */
export async function notifyReceiptUploaded(info: ReceiptUploadedInfo) {
    const filename = info.receiptUrl.replace(/^local:\/\//, '').split('/').pop() || 'comprobante';
    const ext = (filename.split('.').pop() || '').toLowerCase();
    const contentType = EXT_CONTENT_TYPES[ext] || 'application/octet-stream';
    const isInlineImage = contentType.startsWith('image/');

    let buffer: Buffer | null = null;
    try {
        buffer = await getFileBuffer(info.receiptUrl);
    } catch (err) {
        console.error('[ReceiptNotify] No se pudo leer el comprobante, se envía aviso sin adjunto:', err);
    }

    const shortOrder = info.orderId.slice(-4).toUpperCase();
    const clientLink = clientFichaLink(info.clientId);

    const hasWarnings = !!info.auditErrors && info.auditErrors.length > 0;

    // Si el nº de operación ya estaba cargado en otro pago, links directos a
    // ambas fichas para comparar los dos comprobantes sin buscar nada.
    const duplicatesBlock = info.duplicateRefs && info.duplicateRefs.length > 0 ? `
        <div style="margin: 16px 0; padding: 12px 16px; background: #fff7ed; border: 1px solid #fdba74; border-radius: 6px;">
          <p style="margin: 0 0 8px; font-weight: bold; color: #9a3412;">El mismo nº de operación ya figura cargado en:</p>
          <ul style="margin: 0; padding-left: 18px; line-height: 1.9;">
            ${info.duplicateRefs.map(d => `
              <li><a href="${clientFichaLink(d.clientId)}" style="color: #1e3a8a;">${d.clientName} — venta #${d.orderId.slice(-4).toUpperCase()}</a></li>
            `).join('')}
          </ul>
          <p style="margin: 8px 0 0;">Y ahora también en <a href="${clientLink}" style="color: #1e3a8a;">${info.clientName} — venta #${shortOrder}</a>.</p>
        </div>
    ` : '';

    const auditBlock = hasWarnings ? `
        <div style="margin: 16px 0; padding: 12px 16px; background: #fef2f2; border: 1px solid #fca5a5; border-radius: 6px;">
          <p style="margin: 0 0 8px; font-weight: bold; color: #b91c1c;">⚠️ Observaciones del auditor IA:</p>
          <ul style="margin: 0; padding-left: 18px; color: #7f1d1d; line-height: 1.7;">
            ${info.auditErrors!.map(e => `<li>${e}</li>`).join('')}
          </ul>
        </div>
    ` : info.auditErrors ? `
        <p style="margin: 16px 0; padding: 10px 16px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; color: #166534;">
          ✅ Auditoría IA: sin observaciones (monto, duplicados, CUIT y fecha OK).
        </p>
    ` : `
        <p style="margin: 16px 0; padding: 10px 16px; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; color: #92400e;">
          ⚠️ La auditoría IA no pudo revisar este comprobante — verificalo manualmente.
        </p>
    `;

    const subjectPrefix = hasWarnings ? '⚠️ Comprobante con observaciones' : '📎 Comprobante subido';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd;">
        <h2 style="color: #333; border-bottom: 2px solid #000; padding-bottom: 10px;">${subjectPrefix}</h2>
        <ul style="list-style: none; padding: 0; line-height: 1.9;">
          <li><strong>Cliente:</strong> ${info.clientName}</li>
          <li><strong>Venta:</strong> #${shortOrder}</li>
          <li><strong>Monto cargado:</strong> $${info.amount.toLocaleString('es-AR')}</li>
          <li><strong>Método:</strong> ${info.method}</li>
          ${info.reference ? `<li><strong>Referencia:</strong> ${info.reference}</li>` : ''}
        </ul>
        ${auditBlock}
        ${duplicatesBlock}
        ${buffer && isInlineImage ? `
          <p style="margin: 16px 0 8px; font-weight: bold;">Imagen del comprobante:</p>
          <img src="cid:comprobante" alt="Comprobante" style="max-width: 100%; border: 1px solid #ddd;" />
        ` : buffer ? `
          <p style="margin: 16px 0 8px;">El comprobante va adjunto a este correo (${ext.toUpperCase()}).</p>
        ` : `
          <p style="margin: 16px 0 8px; color: #b91c1c;">No se pudo adjuntar el archivo — velo desde el CRM.</p>
        `}
        <p style="margin-top: 20px;"><a href="${clientLink}" style="color: #1e3a8a;">Abrir ficha en el CRM</a></p>
      </div>
    `;

    await sendEmail({
        to: process.env.ADMIN_EMAIL || 'pisano.ishtar@gmail.com',
        subject: `${subjectPrefix}: $${info.amount.toLocaleString('es-AR')} - ${info.clientName} (#${shortOrder})`,
        html,
        ...(buffer ? {
            attachments: [{
                filename,
                content: buffer,
                contentType,
                ...(isInlineImage ? { cid: 'comprobante' } : {})
            }]
        } : {})
    });
}

interface VendorReceiptErrorInfo {
    clientName: string;
    clientId?: string;
    orderId: string;
    amount: number;
    receiptUrl: string;
    /** Observaciones en lenguaje coloquial, ya listas para que las lea un vendedor. */
    issues: string[];
    /** Si hubo duplicado, los pagos anteriores con el mismo nº de operación. */
    duplicateRefs?: DuplicatePaymentRef[];
}

/**
 * Cuando el auditor IA encuentra errores en un comprobante, además del aviso
 * al admin les llega un mail a los vendedores pidiéndoles que lo corrijan.
 * El mail va redactado en primera persona como si lo mandara Ishtar (texto
 * plano, sin plantilla), con reply-to a su Gmail para que las respuestas le
 * lleguen a su casilla personal.
 */
export async function notifyVendorsReceiptError(info: VendorReceiptErrorInfo) {
    if (info.issues.length === 0) return;

    const filename = info.receiptUrl.replace(/^local:\/\//, '').split('/').pop() || 'comprobante';
    const ext = (filename.split('.').pop() || '').toLowerCase();
    const contentType = EXT_CONTENT_TYPES[ext] || 'application/octet-stream';
    const isInlineImage = contentType.startsWith('image/');

    let buffer: Buffer | null = null;
    try {
        buffer = await getFileBuffer(info.receiptUrl);
    } catch (err) {
        console.error('[ReceiptNotify] No se pudo adjuntar el comprobante al mail de vendedores:', err);
    }

    const shortOrder = info.orderId.slice(-4).toUpperCase();

    const duplicateLines = (info.duplicateRefs || []).map(d =>
        `<p>El mismo pago ya está cargado en la ficha de <a href="${clientFichaLink(d.clientId)}" style="color: #1e3a8a;">${d.clientName} (venta #${d.orderId.slice(-4).toUpperCase()})</a> — entren y comparen los dos.</p>`
    ).join('');

    // Sin cajas de colores ni encabezados: tiene que leerse como un mail escrito a mano.
    const html = `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #222; line-height: 1.7;">
        <p>Hola,</p>
        <p>Estuve revisando el comprobante que cargaron de <strong>${info.clientName}</strong> (venta #${shortOrder}, $${info.amount.toLocaleString('es-AR')}) y encontré esto:</p>
        <ul>
          ${info.issues.map(i => `<li>${i}</li>`).join('')}
        </ul>
        ${duplicateLines}
        <p>Acá les dejo la ficha del cliente para corregirlo: <a href="${clientFichaLink(info.clientId)}" style="color: #1e3a8a;">${info.clientName} — venta #${shortOrder}</a></p>
        <p>¿Pueden fijarse y volver a cargarlo bien? Cualquier duda me escriben.</p>
        ${buffer && isInlineImage ? `
          <p>Este es el comprobante que subieron:</p>
          <img src="cid:comprobante" alt="Comprobante" style="max-width: 100%; border: 1px solid #ddd;" />
        ` : buffer ? `
          <p>Les reenvío el comprobante adjunto (${ext.toUpperCase()}) así lo ven.</p>
        ` : ''}
        <p>Gracias,<br/>Ishtar</p>
      </div>
    `;

    await sendEmail({
        to: process.env.VENDOR_ALERT_EMAILS || 'atelier.optica.cerro@gmail.com',
        from: process.env.PERSONAL_EMAIL_FROM || 'Ishtar - Atelier Óptica <ishtar@atelieroptica.com.ar>',
        replyTo: process.env.PERSONAL_REPLY_TO || 'pisano.ishtar@gmail.com',
        // Copia oculta a Ishtar: le queda en su casilla el mail exacto que salió
        // a su nombre, y Gmail encadena las respuestas de los vendedores con él.
        bcc: process.env.PERSONAL_BCC || 'pisano.ishtar@gmail.com',
        subject: `Comprobante de ${info.clientName} (venta #${shortOrder}) — hay que corregirlo`,
        html,
        ...(buffer ? {
            attachments: [{
                filename,
                content: buffer,
                contentType,
                ...(isInlineImage ? { cid: 'comprobante' } : {})
            }]
        } : {})
    });
}
