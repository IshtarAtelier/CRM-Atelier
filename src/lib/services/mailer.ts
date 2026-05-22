import nodemailer from 'nodemailer';

// Configuración genérica SMTP. 
// Para producción, se recomienda usar Resend (smtp.resend.com) o SendGrid.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.example.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const MailerService = {
  /**
   * Envía un email de confirmación de orden con diseño premium "Atelier".
   */
  async sendOrderConfirmation(
    to: string, 
    orderData: { 
      orderId: string; 
      clientName: string; 
      total: number;
      items: { name: string; quantity: number; price: number }[];
    }
  ) {
    if (!process.env.SMTP_USER) {
      console.warn('[Mailer] SMTP credentials not configured. Skipping email sent.');
      return false;
    }

    const itemsHtml = orderData.items.map(item => `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #333; color: #fff;">
          ${item.quantity}x ${item.name}
        </td>
        <td style="padding: 12px 0; border-bottom: 1px solid #333; text-align: right; color: #fff;">
          $${item.price.toLocaleString()}
        </td>
      </tr>
    `).join('');

    const htmlTemplate = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #111; color: #fff; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 40px;">
          <h1 style="font-family: Georgia, serif; font-size: 28px; font-weight: normal; letter-spacing: 2px; margin: 0;">ATELIER</h1>
          <p style="font-size: 10px; letter-spacing: 4px; text-transform: uppercase; color: #999; margin-top: 5px;">Óptica Boutique</p>
        </div>
        
        <p style="font-size: 16px; line-height: 1.6;">Hola ${orderData.clientName},</p>
        <p style="font-size: 16px; line-height: 1.6; color: #ccc;">
          Gracias por elegir Atelier Óptica. Hemos recibido tu pedido correctamente y ya estamos procesándolo.
        </p>

        <div style="margin: 40px 0; padding: 30px; border: 1px solid #333; background-color: #1a1a1a;">
          <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #999; margin-top: 0;">Orden #${orderData.orderId.slice(-6).toUpperCase()}</p>
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            ${itemsHtml}
            <tr>
              <td style="padding: 20px 0 0; font-weight: bold; color: #fff;">Total</td>
              <td style="padding: 20px 0 0; text-align: right; font-weight: bold; font-size: 18px; color: #fff;">
                $${orderData.total.toLocaleString()}
              </td>
            </tr>
          </table>
        </div>

        <p style="font-size: 14px; line-height: 1.6; color: #999; text-align: center;">
          Si tenés alguna consulta sobre tu pedido, podés responder a este correo o escribirnos a nuestro WhatsApp.
        </p>

        <div style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #333; text-align: center;">
          <p style="font-size: 12px; color: #666;">
            José Luis de Tejeda 4380, Cerro de las Rosas<br>
            Córdoba, Argentina
          </p>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: '"Atelier Óptica" <no-reply@atelieroptica.com.ar>',
        to,
        subject: `Confirmación de tu pedido en Atelier Óptica (#${orderData.orderId.slice(-6).toUpperCase()})`,
        html: htmlTemplate,
      });
      return true;
    } catch (error) {
      console.error('[Mailer] Error sending order confirmation:', error);
      return false;
    }
  }
};
