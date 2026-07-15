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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm-atelier-production-ae72.up.railway.app';
    const shortOrder = info.orderId.slice(-4).toUpperCase();
    const clientLink = info.clientId ? `${appUrl}/admin/contactos?id=${info.clientId}` : `${appUrl}/admin/ventas`;

    const hasWarnings = !!info.auditErrors && info.auditErrors.length > 0;

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
    orderId: string;
    amount: number;
    receiptUrl: string;
    /** Observaciones en lenguaje coloquial, ya listas para que las lea un vendedor. */
    issues: string[];
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

    let buffer: Buffer | null = null;
    try {
        buffer = await getFileBuffer(info.receiptUrl);
    } catch (err) {
        console.error('[ReceiptNotify] No se pudo adjuntar el comprobante al mail de vendedores:', err);
    }

    const shortOrder = info.orderId.slice(-4).toUpperCase();

    // Sin cajas de colores ni encabezados: tiene que leerse como un mail escrito a mano.
    const html = `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #222; line-height: 1.7;">
        <p>Hola,</p>
        <p>Estuve revisando el comprobante que cargaron de <strong>${info.clientName}</strong> (venta #${shortOrder}, $${info.amount.toLocaleString('es-AR')}) y encontré esto:</p>
        <ul>
          ${info.issues.map(i => `<li>${i}</li>`).join('')}
        </ul>
        <p>¿Pueden fijarse y volver a cargarlo bien? ${buffer ? 'Les reenvío el comprobante adjunto así lo ven.' : ''} Cualquier duda me escriben.</p>
        <p>Gracias,<br/>Ishtar</p>
      </div>
    `;

    await sendEmail({
        to: process.env.VENDOR_ALERT_EMAILS || 'atelier.optica.cerro@gmail.com',
        from: process.env.PERSONAL_EMAIL_FROM || 'Ishtar - Atelier Óptica <ishtar@atelieroptica.com.ar>',
        replyTo: process.env.PERSONAL_REPLY_TO || 'pisano.ishtar@gmail.com',
        subject: `Comprobante de ${info.clientName} (venta #${shortOrder}) — hay que corregirlo`,
        html,
        ...(buffer ? {
            attachments: [{ filename, content: buffer, contentType }]
        } : {})
    });
}
