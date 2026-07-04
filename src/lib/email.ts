import nodemailer from 'nodemailer';

// Transporte Gmail por puerto 587 (STARTTLS): el 465 (implícito en service:'gmail')
// está dando timeout desde la red de Railway. El 587 es el puerto de submission
// estándar y suele pasar firewalls donde el 465 no.
export const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,       // STARTTLS: arranca en claro y sube a TLS
    requireTLS: true,    // exige TLS antes de autenticar (nunca manda credenciales en claro)
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,   // 10 seconds
    socketTimeout: 15000      // 15 seconds
});

interface SendEmailOptions {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    attachments?: Array<{
        filename: string;
        content: string | Buffer;
        encoding?: string;
    }>;
}

/**
 * Utility to send an email to a client
 */
export async function sendEmail({ to, subject, text, html, attachments }: SendEmailOptions) {
    try {
        const info = await transporter.sendMail({
            from: `"Atelier Óptica" <${process.env.EMAIL_USER || 'noreply@atelier.com'}>`,
            to,
            subject,
            text,
            html,
            attachments
        });
        console.log(`[Email] Correo enviado exitosamente a ${to}. ID: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`[Email] Error enviando correo a ${to}:`, error);
        return { success: false, error };
    }
}
