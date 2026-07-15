import nodemailer from 'nodemailer';

// ============================================================================
// ENVÍO DE EMAILS
//
// Railway bloquea el tráfico SMTP saliente (puertos 465/587), por lo que en
// producción se usa la API HTTPS de Resend (RESEND_API_KEY). Si la key no
// está configurada, se cae al SMTP de Gmail (útil en local/dev).
//
// Variables de entorno:
//   RESEND_API_KEY  → activa el envío vía Resend (recomendado en producción)
//   EMAIL_FROM      → remitente para Resend (debe ser de un dominio verificado
//                     en Resend, ej: "Atelier Óptica <pedidos@atelieroptica.com.ar>")
//   EMAIL_USER/PASS → credenciales del SMTP de Gmail (fallback)
// ============================================================================

// Transporte SMTP (fallback / desarrollo local)
export const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,       // STARTTLS
    requireTLS: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
});

interface SendEmailOptions {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    /** Remitente alternativo (debe ser de un dominio verificado en Resend). */
    from?: string;
    /** Dirección a la que llegan las respuestas (puede ser cualquier casilla, ej. Gmail). */
    replyTo?: string;
    attachments?: Array<{
        filename: string;
        content: string | Buffer;
        encoding?: string;
        contentType?: string;
        cid?: string; // para embeber imágenes inline con <img src="cid:...">
    }>;
}

/**
 * Envía un email vía la API HTTPS de Resend.
 */
async function sendViaResend({ to, subject, text, html, attachments, from, replyTo }: SendEmailOptions) {
    const sender = from || process.env.EMAIL_FROM || 'Atelier Óptica <onboarding@resend.dev>';
    const recipients = to.split(',').map(r => r.trim()).filter(Boolean);

    const payload: any = {
        from: sender,
        to: recipients,
        subject,
        ...(html ? { html } : {}),
        ...(text ? { text } : {}),
        ...(replyTo ? { reply_to: replyTo } : {})
    };

    if (attachments && attachments.length > 0) {
        payload.attachments = attachments.map(a => ({
            filename: a.filename,
            // Resend espera el contenido como base64 string
            content: Buffer.isBuffer(a.content)
                ? a.content.toString('base64')
                : a.content,
            ...(a.contentType ? { content_type: a.contentType } : {}),
            ...(a.cid ? { content_id: a.cid } : {})
        }));
    }

    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(`Resend ${res.status}: ${data?.message || JSON.stringify(data)}`);
    }
    return data.id as string;
}

/**
 * Utility to send an email to a client.
 * Usa Resend (HTTPS) si hay RESEND_API_KEY; si no, SMTP de Gmail.
 */
export async function sendEmail({ to, subject, text, html, attachments, from, replyTo }: SendEmailOptions) {
    try {
        if (process.env.RESEND_API_KEY) {
            const id = await sendViaResend({ to, subject, text, html, attachments, from, replyTo });
            console.log(`[Email] Correo enviado vía Resend a ${to}. ID: ${id}`);
            return { success: true, messageId: id };
        }

        const info = await transporter.sendMail({
            from: from || `"Atelier Óptica" <${process.env.EMAIL_USER || 'noreply@atelier.com'}>`,
            to,
            subject,
            text,
            html,
            attachments,
            ...(replyTo ? { replyTo } : {})
        });
        console.log(`[Email] Correo enviado exitosamente a ${to}. ID: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`[Email] Error enviando correo a ${to}:`, error);
        return { success: false, error };
    }
}
