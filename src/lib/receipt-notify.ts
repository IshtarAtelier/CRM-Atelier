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
    context: string; // ej: 'Nuevo pago registrado' | 'Comprobante actualizado (edición)'
}

/**
 * Avisa al admin por email cada vez que se sube un comprobante de pago,
 * adjuntando la imagen (o el PDF) del comprobante. Aplica a ventas web y de local:
 * todos los pagos de órdenes pasan por ContactService.addPayment / updatePayment.
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

    const adminEmail = (process.env.ADMIN_EMAIL || '').trim();
    const toEmail = !adminEmail || adminEmail.toLowerCase() === 'pisano.ishtar@gmail.com'
        ? 'pisano.ishtar@gmail.com'
        : `pisano.ishtar@gmail.com, ${adminEmail}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd;">
        <h2 style="color: #333; border-bottom: 2px solid #000; padding-bottom: 10px;">📎 Comprobante subido al sistema</h2>
        <p style="margin: 4px 0;"><strong>Contexto:</strong> ${info.context}</p>
        <ul style="list-style: none; padding: 0; line-height: 1.9;">
          <li><strong>Cliente:</strong> ${info.clientName}</li>
          <li><strong>Venta:</strong> #${shortOrder}</li>
          <li><strong>Monto:</strong> $${info.amount.toLocaleString('es-AR')}</li>
          <li><strong>Método:</strong> ${info.method}</li>
          ${info.reference ? `<li><strong>Referencia:</strong> ${info.reference}</li>` : ''}
        </ul>
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
        to: toEmail,
        subject: `📎 Comprobante subido: $${info.amount.toLocaleString('es-AR')} - ${info.clientName} (#${shortOrder})`,
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
