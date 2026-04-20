import nodemailer from 'nodemailer';

// Create a transporter using Gmail with SMTP
export const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'crm.atelier.optica@gmail.com',
        pass: process.env.EMAIL_PASS || 'Escarlata97*'
    }
});

interface SendEmailOptions {
    to: string;
    subject: string;
    text?: string;
    html?: string;
}

/**
 * Utility to send an email to a client
 */
export async function sendEmail({ to, subject, text, html }: SendEmailOptions) {
    try {
        const info = await transporter.sendMail({
            from: `"Atelier Óptica" <${process.env.EMAIL_USER || 'crm.atelier.optica@gmail.com'}>`,
            to,
            subject,
            text,
            html
        });
        console.log(`[Email] Correo enviado exitosamente a ${to}. ID: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`[Email] Error enviando correo a ${to}:`, error);
        return { success: false, error };
    }
}
