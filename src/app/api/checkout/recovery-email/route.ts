import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { prisma } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID requerido' }, { status: 400 });
    }

    const session = await prisma.checkoutSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 });
    }

    if (!session.email) {
      return NextResponse.json({ error: 'El cliente no tiene email registrado' }, { status: 400 });
    }

    const customerName = session.firstName || 'Cliente';
    const cartItems = Array.isArray(session.cartData) ? session.cartData as any[] : [];
    const total = session.total || 0;
    const siteUrl = 'https://www.atelieroptica.com.ar';

    const itemsHtml = cartItems.map((item: any) => `
      <tr>
        <td style="padding: 16px 0; border-bottom: 1px solid #e8e5e0;">
          <p style="margin: 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #a39382;">${item.brand || 'ATELIER'}</p>
          <p style="margin: 4px 0 0; font-size: 15px; color: #1a1a1a; font-weight: 500;">${item.model || 'Producto'}</p>
          ${item.quantity > 1 ? `<p style="margin: 2px 0 0; font-size: 12px; color: #999;">Cantidad: ${item.quantity}</p>` : ''}
        </td>
        <td style="padding: 16px 0; border-bottom: 1px solid #e8e5e0; text-align: right; font-size: 15px; font-weight: 600; color: #1a1a1a;">
          $${((item.price || 0) * (item.quantity || 1)).toLocaleString('es-AR')}
        </td>
      </tr>
    `).join('');

    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Tu carrito te espera — Atelier Óptica</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f3f0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1a1a1a;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f3f0; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; max-width: 600px; width: 100%; border-radius: 4px; overflow: hidden; box-shadow: 0 2px 20px rgba(0,0,0,0.06);">
                
                <!-- Header -->
                <tr>
                  <td style="background-color: #1a1a1a; padding: 35px 40px; text-align: center;">
                    <h1 style="font-family: Georgia, 'Times New Roman', serif; font-size: 28px; font-weight: normal; margin: 0; color: #ffffff; letter-spacing: 3px;">ATELIER</h1>
                    <p style="margin: 6px 0 0; font-size: 9px; text-transform: uppercase; letter-spacing: 4px; color: #a39382;">Óptica Boutique</p>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">

                    <!-- Greeting -->
                    <p style="font-size: 16px; line-height: 1.5; margin: 0 0 8px; font-weight: 400;">Hola ${customerName},</p>
                    <p style="font-size: 15px; line-height: 1.7; color: #555555; margin: 0 0 30px;">
                      Notamos que dejaste algunos productos increíbles en tu carrito. Los guardamos para vos porque sabemos que encontrar el anteojo perfecto lleva tiempo.
                    </p>

                    <!-- Cart Items -->
                    <div style="margin: 30px 0;">
                      <p style="font-size: 10px; text-transform: uppercase; letter-spacing: 3px; color: #a39382; margin: 0 0 16px; font-weight: 700;">Tu selección</p>
                      <table width="100%" cellpadding="0" cellspacing="0" style="border-top: 2px solid #1a1a1a;">
                        ${itemsHtml || `
                          <tr>
                            <td style="padding: 16px 0; color: #999; font-size: 14px;">Productos seleccionados</td>
                          </tr>
                        `}
                      </table>
                      <table width="100%" cellpadding="0" cellspacing="0" style="border-top: 2px solid #1a1a1a; margin-top: 0;">
                        <tr>
                          <td style="padding: 16px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #a39382; font-weight: 700;">Total</td>
                          <td style="padding: 16px 0; text-align: right; font-size: 20px; font-weight: 700; color: #1a1a1a;">$${total.toLocaleString('es-AR')}</td>
                        </tr>
                      </table>
                    </div>

                    <!-- CTA Button -->
                    <div style="text-align: center; margin: 35px 0;">
                      <a href="${siteUrl}/tienda" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; text-decoration: none; padding: 16px 48px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; border-radius: 0;">
                        Completar mi compra
                      </a>
                    </div>

                    <!-- Separator -->
                    <div style="border-top: 1px solid #e8e5e0; margin: 30px 0;"></div>

                    <!-- Benefits -->
                    <p style="font-size: 10px; text-transform: uppercase; letter-spacing: 3px; color: #a39382; margin: 0 0 16px; font-weight: 700;">¿Por qué elegir Atelier?</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; font-size: 13px; color: #555; line-height: 1.5;">✦ &nbsp; Envío a todo el país</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; font-size: 13px; color: #555; line-height: 1.5;">✦ &nbsp; 6 cuotas sin interés</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; font-size: 13px; color: #555; line-height: 1.5;">✦ &nbsp; Garantía oficial en todos los armazones</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; font-size: 13px; color: #555; line-height: 1.5;">✦ &nbsp; Asesoramiento personalizado por WhatsApp</td>
                      </tr>
                    </table>

                    <!-- Help -->
                    <div style="margin-top: 30px; background-color: #faf9f7; border-left: 3px solid #a39382; padding: 20px;">
                      <p style="margin: 0; font-size: 14px; color: #555; line-height: 1.6;">
                        ¿Necesitás ayuda o tenés alguna duda? Respondé este correo o escribinos a nuestro 
                        <a href="https://wa.me/5493541215971" style="color: #1a1a1a; font-weight: 600; text-decoration: none;">WhatsApp</a>.
                      </p>
                    </div>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #faf9f7; padding: 30px 40px; text-align: center; border-top: 1px solid #e8e5e0;">
                    <p style="font-size: 12px; color: #999; margin: 0 0 8px;">Atelier Óptica — Cerro de las Rosas, Córdoba</p>
                    <p style="font-size: 11px; color: #bbb; margin: 0;">
                      <a href="${siteUrl}" style="color: #a39382; text-decoration: none;">www.atelieroptica.com.ar</a> · 
                      <a href="https://instagram.com/atelieroptica_" style="color: #a39382; text-decoration: none;">@atelieroptica_</a>
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const result = await sendEmail({
      to: session.email,
      subject: `${customerName}, tu carrito te espera ✦ Atelier Óptica`,
      html: htmlTemplate,
    });

    if (result.success) {
      // Mark session as email-sent 
      await prisma.checkoutSession.update({
        where: { id: sessionId },
        data: { status: 'EMAIL_SENT' },
      });

      return NextResponse.json({ success: true, messageId: result.messageId });
    } else {
      return NextResponse.json({ error: 'Error al enviar el email' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('[Recovery Email] Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
