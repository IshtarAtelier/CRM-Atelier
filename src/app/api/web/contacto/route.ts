import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { normalizeArgentinePhone } from '@/services/contact.service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, phone, subject, message } = body;

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Nombre, email y consulta son requeridos.' }, { status: 400 });
    }

    const normalizedPhone = phone ? normalizeArgentinePhone(phone) : null;

    // Try to find client by email or phone
    let client = await prisma.client.findFirst({
      where: {
        OR: [
          { email: email },
          ...(normalizedPhone ? [{ phone: normalizedPhone }] : [])
        ]
      }
    });

    if (!client) {
      client = await prisma.client.create({
        data: {
          name,
          email,
          phone: normalizedPhone,
          status: 'CONTACT',
          contactSource: 'WEB_CONTACT'
        }
      });
    }

    // Save interaction
    await prisma.interaction.create({
      data: {
        clientId: client.id,
        type: 'WEB_INQUIRY',
        content: `📬 Nueva consulta web:\nAsunto: ${subject || 'Sin asunto'}\n\nMensaje:\n${message}`
      }
    });

    // Send email alert to admins
    const adminEmails = 'pisano.ishtar@gmail.com, atelier.optica.cerro@gmail.com';
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #333; border-bottom: 2px solid #000; padding-bottom: 10px; margin-top: 0;">📬 Nueva Consulta Web</h2>
        <p><strong>De:</strong> ${name}</p>
        <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
        ${phone ? `<p><strong>Teléfono/WhatsApp:</strong> <a href="https://wa.me/${normalizedPhone?.replace(/\D/g, '')}">${phone}</a></p>` : ''}
        <p><strong>Asunto:</strong> ${subject || 'Sin asunto'}</p>
        
        <h3 style="background: #f4f4f4; padding: 10px; margin-top: 20px;">Mensaje / Consulta</h3>
        <p style="white-space: pre-wrap; line-height: 1.6; color: #555; background: #fafafa; padding: 15px; border-radius: 4px; border: 1px solid #eee;">${message}</p>
        
        <div style="margin-top: 25px; font-size: 11px; color: #666; border-top: 1px solid #eee; padding-top: 15px;">
          Ficha del contacto creada/actualizada automáticamente en el CRM.
        </div>
      </div>
    `;

    await sendEmail({
      to: adminEmails,
      subject: `📬 Nueva Consulta Web - ${subject || 'Contacto'} - ${name}`,
      html: emailHtml
    }).catch(err => console.error('Error sending contact inquiry email:', err));

    return NextResponse.json({ success: true, message: 'Consulta enviada con éxito.' });
  } catch (error: any) {
    console.error('Error processing contact inquiry:', error);
    return NextResponse.json({ error: 'Error al enviar la consulta.' }, { status: 500 });
  }
}
