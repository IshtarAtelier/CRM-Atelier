import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { to, subject, text, html } = body;

        if (!to || !subject || (!text && !html)) {
            return NextResponse.json({ error: 'Faltan parámetros requeridos (to, subject, text/html)' }, { status: 400 });
        }

        const result = await sendEmail({ to, subject, text, html });

        if (result.success) {
            return NextResponse.json({ success: true, messageId: result.messageId });
        } else {
            return NextResponse.json({ error: 'Error al enviar el correo', details: result.error }, { status: 500 });
        }
    } catch (error: any) {
        console.error('Error in /api/email:', error);
        return NextResponse.json({ error: 'Error del servidor al procesar el correo' }, { status: 500 });
    }
}
