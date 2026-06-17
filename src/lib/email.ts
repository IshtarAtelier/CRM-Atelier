import nodemailer from 'nodemailer';

// Create a transporter using Gmail with SMTP
export const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
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
