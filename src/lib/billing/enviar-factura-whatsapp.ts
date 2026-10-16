/**
 * Mandarle al cliente su factura electrónica por WhatsApp, desde el navegador.
 * Lo usan la pantalla de Facturación (facturas emitidas) y el modal de emisión
 * apenas sale el comprobante (Ishtar, 16/10/2026: sin ir hasta "facturas
 * emitidas"). Un solo lugar para el texto y la plantilla.
 */
import { generateInvoicePDF } from '@/lib/invoice-generator';
import { formatPhoneForWhatsApp } from '@/lib/phone-utils';

export interface ClienteParaFactura {
    name: string;
    phone?: string | null;
}

/** Lanza con un mensaje para mostrar; resuelve si el envío salió. */
export async function enviarFacturaPorWhatsApp(cliente: ClienteParaFactura, invoiceId: string): Promise<void> {
    const phone = formatPhoneForWhatsApp(cliente.phone);
    if (!phone || phone === '549') {
        throw new Error('El cliente no tiene teléfono registrado.');
    }

    const res = await fetch(`/api/billing/invoice/${invoiceId}/pdf-data`);
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al obtener datos de la factura');
    }
    const data = await res.json();
    const pdfResult = await generateInvoicePDF(data, true);
    if (!pdfResult) throw new Error('Error generando PDF');

    const text = `✨ *ATELIER ÓPTICA* ✨\n\nHola ${cliente.name},\nTe enviamos adjunta tu factura electrónica de compra.\n\n¡Gracias por elegirnos!`;

    const sendRes = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chatId: `${phone}@c.us`,
            message: text,
            media: { base64: pdfResult.base64, mimetype: 'application/pdf', filename: pdfResult.fileName },
            // API oficial: si el cliente no escribió en 24 h, sale la
            // plantilla "factura_electronica" (A11) con el PDF adjunto.
            template: { name: 'factura_electronica', bodyParams: [cliente.name.split(' ')[0]] },
        }),
    });
    if (!sendRes.ok) {
        const errData = await sendRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Error de conexión con el bot de WhatsApp');
    }
}
