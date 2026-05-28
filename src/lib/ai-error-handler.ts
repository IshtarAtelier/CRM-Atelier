import { sendEmail } from '@/lib/email';
import { fetchWa } from '@/lib/wa-config';

/**
 * Global handler for AI processes to gracefully catch and alert on Quota/429 errors.
 * Usage:
 * try {
 *    // AI Code
 * } catch (error) {
 *    await handleAIError(error, 'OCR de Recetas');
 * }
 */
export async function handleAIError(error: any, context: string) {
    console.error(`[AI Error - ${context}]:`, error);

    const errorString = error?.message || error?.toString() || '';
    
    // Detect 429, RESOURCE_EXHAUSTED or Quota errors
    if (
        error?.status === 429 || 
        errorString.includes('429') || 
        errorString.includes('RESOURCE_EXHAUSTED') || 
        errorString.includes('quota')
    ) {
        // Send email alert
        const emailMessage = `El sistema ha intentado ejecutar un proceso de IA (${context}) pero la solicitud fue rechazada por falta de créditos (Error 429: RESOURCE_EXHAUSTED).\n\nPor favor, recargá saldo en tu cuenta de Google Cloud / AI Studio para que los procesos automatizados vuelvan a funcionar.\n\nLink: https://aistudio.google.com/app/billing`;
        
        try {
            await sendEmail({
                to: process.env.ADMIN_EMAIL || 'pisano.ishtar@gmail.com',
                subject: `🚨 ALERTA: Crédito Agotado en Google AI Studio (${context})`,
                text: emailMessage
            });
        } catch (emailErr) {
            console.error('Error enviando alerta por correo:', emailErr);
        }

        // Attempt to send WhatsApp alert via internal WhatsApp Bot API (if ADMIN_PHONE is set in the environment)
        const adminPhone = process.env.ADMIN_PHONE;
        if (adminPhone) {
            try {
                await fetchWa('/api/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chatId: adminPhone.includes('@c.us') ? adminPhone : `${adminPhone}@c.us`,
                        message: `🤖 *Alerta del Sistema*\n\nSe han agotado los créditos de Inteligencia Artificial al ejecutar el proceso: *${context}*.\n\nPor favor, recarga saldo en Google Cloud.`
                    }),
                });
            } catch (waErr) {
                console.error('Error enviando alerta por WhatsApp:', waErr);
            }
        }

        throw new Error(`Se agotaron los créditos de la IA al ejecutar ${context}. Se ha enviado una alerta al administrador.`);
    }

    // If it's not a quota error, rethrow it so the application handles it normally
    throw error;
}
