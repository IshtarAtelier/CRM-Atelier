import nodemailer from 'nodemailer';

// Configuración del transporter usando variables de entorno
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: process.env.SMTP_PORT === '465' || true, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendOrderConfirmationEmail = async (orderData: any, customerEmail: string) => {
  // Solo intentamos enviar si hay credenciales configuradas
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("[EMAIL SERVICE] Credenciales SMTP no configuradas. Correo de confirmación simulado en consola.");
    console.log(`[EMAIL SIMULADO] Destino: ${customerEmail} | Asunto: Tu orden en Atelier Óptica | Total: $${orderData.total}`);
    return { success: true, simulated: true };
  }

  const { orderId, customerName, items, total, isTransfer } = orderData;
  const hasCrystals = items.some((item: any) => item.lensConfig?.lensType && item.lensConfig.lensType !== "NONE");

  const itemsHtml = items.map((item: any) => `
    <tr>
      <td style="padding: 15px 0; border-bottom: 1px solid #eeeeee;">
        <p style="margin: 0; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #333;">${item.brand || 'ATELIER'}</p>
        <p style="margin: 5px 0 0; font-size: 16px; color: #000;">${item.model}</p>
        ${item.lensConfig ? `<p style="margin: 5px 0 0; font-size: 12px; color: #666;">Cristales: ${item.lensConfig.lensType} - ${item.lensConfig.treatment}</p>` : ''}
      </td>
      <td style="padding: 15px 0; border-bottom: 1px solid #eeeeee; text-align: right; font-size: 14px;">
        $${(item.price * item.quantity).toLocaleString("es-AR")}
      </td>
    </tr>
  `).join('');

  const transferInstructions = isTransfer ? `
    <div style="background-color: #f9f9f9; border-left: 4px solid #000; padding: 20px; margin-top: 30px;">
      <h3 style="margin-top: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">Instrucciones de Pago</h3>
      <p style="font-size: 14px; line-height: 1.6; color: #333;">Para confirmar definitivamente tu orden, por favor realizá la transferencia a los siguientes datos bancarios:</p>
      <ul style="list-style: none; padding: 0; font-family: monospace; font-size: 14px; margin-bottom: 20px;">
        <li><strong>Banco:</strong> Galicia</li>
        <li><strong>Titular:</strong> Atelier Óptica SAS</li>
        <li><strong>CUIT:</strong> 30-71234567-8</li>
        <li><strong>CBU:</strong> 0070000000000000000000</li>
        <li><strong>Alias:</strong> ATELIER.OPTICA</li>
      </ul>
      <p style="font-size: 14px; line-height: 1.6; color: #333;">Monto a transferir (incluye 20% OFF): <strong>$${total.toLocaleString("es-AR")}</strong></p>
      <p style="font-size: 14px; line-height: 1.6; color: #333; margin-bottom: 0;">Una vez realizada, envianos el comprobante respondiendo a este correo o a nuestro WhatsApp.</p>
    </div>
  ` : '';

  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Tu orden en Atelier Óptica</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;700&family=Georgia&display=swap');
      </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: #ffffff; font-family: 'Inter', Helvetica, Arial, sans-serif; color: #000000;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; padding: 40px; border: 1px solid #e5e5e5; max-width: 600px; width: 100%;">
              
              <!-- Header -->
              <tr>
                <td align="center" style="padding-bottom: 40px; border-bottom: 2px solid #000000;">
                  <h1 style="font-family: 'Georgia', serif; font-size: 32px; font-weight: normal; margin: 0; letter-spacing: -0.5px;">ATELIER ÓPTICA</h1>
                  <p style="margin: 10px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 3px; color: #666666;">Boutique Visual</p>
                </td>
              </tr>

              <!-- Greeting -->
              <tr>
                <td style="padding: 40px 0 20px;">
                  <h2 style="font-size: 18px; font-weight: normal; margin: 0 0 10px;">Hola ${customerName},</h2>
                  <p style="font-size: 15px; line-height: 1.6; color: #333333; margin: 0;">Gracias por elegir a Atelier Óptica. Hemos recibido tu pedido con el número de orden <strong>#${orderId}</strong>.</p>
                </td>
              </tr>

              <!-- Order Summary -->
              <tr>
                <td style="padding: 20px 0;">
                  <h3 style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 20px; border-bottom: 1px solid #000; padding-bottom: 10px;">Resumen del Pedido</h3>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    ${itemsHtml}
                  </table>
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 20px;">
                    <tr>
                      <td style="font-size: 16px; font-weight: bold; text-align: right; text-transform: uppercase;">
                        Total: $${total.toLocaleString("es-AR")}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Delivery Time -->
              <tr>
                <td style="padding: 10px 0 20px;">
                  <div style="background-color: #f9f9f9; border-left: 4px solid #000; padding: 15px;">
                    <p style="margin: 0; font-size: 14px; color: #333;">
                      <strong>Tiempo de entrega estimado:</strong><br/>
                      ${hasCrystals ? '7 a 10 días hábiles por trabajo de laboratorio.' : 'Despacho rápido dentro de las 24/48hs hábiles.'}
                    </p>
                  </div>
                </td>
              </tr>

              <!-- Transfer Instructions -->
              <tr>
                <td>
                  ${transferInstructions}
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding-top: 40px; margin-top: 40px; border-top: 1px solid #eeeeee; text-align: center;">
                  <p style="font-size: 12px; color: #666666; margin: 0 0 10px;">Atelier Óptica - Cerro de las Rosas, Córdoba.</p>
                  <p style="font-size: 12px; color: #666666; margin: 0;">Si tenés alguna duda, contactanos a nuestro WhatsApp: <a href="https://wa.me/5493541215971" style="color: #000000; font-weight: bold; text-decoration: none;">+54 9 3541 215971</a></p>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: `"Atelier Óptica" <${process.env.SMTP_USER}>`,
      to: customerEmail,
      subject: `Confirmación de Orden #${orderId} - Atelier Óptica`,
      html: htmlTemplate,
    });
    console.log(`[EMAIL SERVICE] Correo de confirmación enviado exitosamente a ${customerEmail}`);
    return { success: true };
  } catch (error) {
    console.error("[EMAIL SERVICE] Error enviando correo:", error);
    return { success: false, error };
  }
};
