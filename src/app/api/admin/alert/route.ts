import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';

export async function POST(req: Request) {
    try {
        const { subject, message } = await req.json();
        await sendEmail({
            to: process.env.ADMIN_EMAIL || 'pisano.ishtar@gmail.com',
            subject: subject || 'Alerta del Sistema',
            text: message || 'Alerta desde el sistema Atelier sin detalles.'
        });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
