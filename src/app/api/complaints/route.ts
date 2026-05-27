import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { prisma } from '@/lib/db';

const BOT_API_KEY = process.env.BOT_API_KEY;

export async function POST(req: Request) {
    try {
        const apiKey = req.headers.get('x-api-key');
        if (apiKey !== BOT_API_KEY) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { clientId, details } = body;

        if (!clientId || !details) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Fetch client info to include in the email
        const client = await prisma.client.findUnique({
            where: { id: clientId },
        });

        if (!client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }

        // The default email from env or the one we decided
        const adminEmail = process.env.ADMIN_EMAIL || 'crm.atelier.optica@gmail.com';

        const subject = `🚨 NUEVO RECLAMO POST-VENTA - Cliente: ${client.name}`;
        
        const html = `
            <h2>Reclamo Post-Venta Registrado por Ishtar</h2>
            <p><strong>Cliente:</strong> ${client.name}</p>
            <p><strong>Teléfono:</strong> ${client.phone || 'No registrado'}</p>
            <hr />
            <h3>Detalles del inconveniente:</h3>
            <p style="white-space: pre-wrap;">${details}</p>
            <hr />
            <p><em>Este mensaje fue generado automáticamente por el asistente virtual. Por favor, comunícate con el cliente a la brevedad.</em></p>
        `;

        const result = await sendEmail({
            to: adminEmail,
            subject,
            html,
        });

        if (!result.success) {
            throw new Error('Failed to send email');
        }

        return NextResponse.json({ success: true, message: 'Complaint reported successfully' });
    } catch (error: any) {
        console.error('Error reporting complaint:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
