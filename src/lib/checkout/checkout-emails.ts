import { WHATSAPP_PHONE } from '@/lib/constants';

// atelieroptica.com.ar apunta hoy a Tienda Nube y no sirve /images/* — usar el dominio Railway de la app
const LOGO_URL = 'https://crm-atelier-production-ae72.up.railway.app/images/logo-blanco.png';
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const GOLD = '#c9a227';
const GOLD_SOFT = '#e6c65c';
const BG = '#000000';
const CARD = '#0b0b0b';
const IVORY = '#f5f0e6';
const MUTED = '#b3aca0';
const HAIRLINE = '#2b2417';

function waLink(message: string) {
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
}

function whatsappButton(label: string, message: string) {
  return `
    <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto;">
      <tr>
        <td bgcolor="${GOLD}" style="border-radius: 2px; box-shadow: 0 0 24px rgba(201,162,39,0.35);">
          <a href="${waLink(message)}" target="_blank"
             style="display: inline-block; padding: 18px 48px; font-family: ${SANS}; font-size: 14px; font-weight: bold; letter-spacing: 3px; text-transform: uppercase; color: #000000; text-decoration: none;">
            ${label}
          </a>
        </td>
      </tr>
    </table>
  `;
}

function emailShell(content: string) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BG}" style="background-color: ${BG}; padding: 32px 12px;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${CARD}" style="background-color: ${CARD}; max-width: 600px; width: 100%; border: 1px solid ${HAIRLINE};">
            <tr><td height="5" bgcolor="${GOLD}" style="font-size: 0; line-height: 0;">&nbsp;</td></tr>
            <tr>
              <td align="center" style="padding: 48px 40px 0;">
                <img src="${LOGO_URL}" alt="ATELIER ÓPTICA" width="190" style="display: block; max-width: 190px; font-family: ${SERIF}; font-size: 22px; color: ${IVORY};" />
              </td>
            </tr>
            <tr>
              <td align="center" style="padding: 24px 40px 0;">
                <table cellpadding="0" cellspacing="0" border="0" width="80"><tr><td height="1" bgcolor="${GOLD}" style="font-size: 0; line-height: 0;">&nbsp;</td></tr></table>
              </td>
            </tr>
            ${content}
            <tr>
              <td align="center" style="padding: 0 40px 40px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#14120c" style="background-color: #14120c; border: 1px solid ${HAIRLINE};">
                  <tr>
                    <td align="center" style="padding: 28px 24px;">
                      <p style="margin: 0; font-family: ${SANS}; font-size: 11px; font-weight: bold; letter-spacing: 5px; text-transform: uppercase; color: ${GOLD};">Seguinos en Instagram</p>
                      <a href="https://www.instagram.com/atelieroptica_" target="_blank" style="display: inline-block; margin: 12px 0 0; font-family: ${SERIF}; font-size: 22px; font-style: italic; color: ${GOLD_SOFT}; text-decoration: none;">@atelieroptica_</a>
                      <p style="margin: 10px 0 0; font-family: ${SANS}; font-size: 13px; line-height: 1.7; color: ${MUTED};">Lo nuevo del atelier, antes que nadie.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding: 0 40px;">
                <span style="font-family: ${SERIF}; font-size: 14px; color: ${GOLD};">&#10022;</span>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding: 18px 40px 40px;">
                <p style="margin: 0; font-family: ${SANS}; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #6f6a5e; line-height: 2;">
                  Atelier &Oacute;ptica &mdash; Cerro de las Rosas, C&oacute;rdoba<br/>
                  <a href="https://www.atelieroptica.com.ar" style="color: ${GOLD}; text-decoration: none;">atelieroptica.com.ar</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

export function getClientItemsHtml(items: any[]) {
  return items.map((item: any) => `
    <tr>
      <td style="padding: 16px 0; border-bottom: 1px solid ${HAIRLINE};">
        <p style="margin: 0; font-family: ${SANS}; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; color: ${GOLD};">${item.brand || 'ATELIER'}</p>
        <p style="margin: 6px 0 0; font-family: ${SERIF}; font-size: 17px; color: ${IVORY};">${item.model}</p>
        ${item.lensConfig && (item.lensConfig.lensType !== "NONE" || item.lensConfig.color) ? `
          <p style="margin: 6px 0 0; font-family: ${SANS}; font-size: 12px; line-height: 1.6; color: #8f897c;">
            Cristales: ${item.lensConfig.lensType === "NONE" ? "Sin Aumento" : item.lensConfig.lensType}
            ${item.lensConfig.treatment ? `- ${item.lensConfig.treatment.replace(/_/g, ' ')}` : ''}
            ${item.lensConfig.color ? `<br/>Tinte: ${item.lensConfig.color}` : ''}
            ${item.lensConfig.prescriptionFile ? `<br/>Receta: ${item.lensConfig.prescriptionFile}` : ''}
          </p>
        ` : ''}
      </td>
      <td valign="top" style="padding: 16px 0; border-bottom: 1px solid ${HAIRLINE}; text-align: right; font-family: ${SANS}; font-size: 14px; color: ${IVORY}; white-space: nowrap;">
        $${(item.price * item.quantity).toLocaleString("es-AR")}
      </td>
    </tr>
  `).join('');
}

export function getConfirmationHtml(customer: any, orderId: string, emailTotal: number, shippingMethodLabel: string, hasCrystals: boolean, itemsHtml: string) {
  const shortId = orderId.slice(-4).toUpperCase();
  return emailShell(`
    <tr>
      <td align="center" style="padding: 40px 40px 0;">
        <p style="margin: 0; font-family: ${SANS}; font-size: 13px; font-weight: bold; letter-spacing: 6px; text-transform: uppercase; color: ${GOLD};">Pedido confirmado</p>
        <h1 style="margin: 20px 0 0; font-family: ${SERIF}; font-size: 42px; font-weight: normal; line-height: 1.15; color: ${IVORY};">Gracias, ${customer.firstName}.</h1>
        <p style="margin: 14px 0 0; font-family: ${SERIF}; font-size: 19px; font-style: italic; color: ${GOLD_SOFT};">Tu pedido ya est&aacute; en marcha.</p>
        <p style="margin: 18px 0 0; font-family: ${SANS}; font-size: 14px; line-height: 1.9; color: ${MUTED};">
          Cada detalle se prepara en nuestro atelier con el mismo cuidado<br/>
          con el que lo elegiste.
        </p>
        <p style="margin: 28px 0 0;">
          <span style="display: inline-block; padding: 10px 26px; background-color: ${GOLD}; font-family: ${SANS}; font-size: 13px; font-weight: bold; letter-spacing: 4px; color: #000000;">ORDEN #${shortId}</span>
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 44px 40px 0;">
        <p style="margin: 0 0 4px; font-family: ${SANS}; font-size: 11px; font-weight: bold; letter-spacing: 4px; text-transform: uppercase; color: ${GOLD};">Tu selecci&oacute;n</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 1px solid ${HAIRLINE};">${itemsHtml}</table>
      </td>
    </tr>
    <tr>
      <td style="padding: 24px 40px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${GOLD}" style="background-color: ${GOLD};">
          <tr>
            <td style="padding: 16px 24px; font-family: ${SANS}; font-size: 13px; font-weight: bold; letter-spacing: 4px; text-transform: uppercase; color: #000000;">Total</td>
            <td style="padding: 16px 24px; text-align: right; font-family: ${SERIF}; font-size: 28px; color: #000000;">$${emailTotal.toLocaleString("es-AR")}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px 40px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#14120c" style="background-color: #14120c; border-left: 3px solid ${GOLD};">
          <tr>
            <td style="padding: 22px 26px; font-family: ${SANS}; font-size: 13px; line-height: 2.1; color: #d8d2c4;">
              <span style="color: ${GOLD}; letter-spacing: 3px; font-size: 11px; text-transform: uppercase; font-weight: bold;">Tu env&iacute;o</span><br/>
              <strong style="color: ${IVORY};">M&eacute;todo:</strong> ${shippingMethodLabel} ${customer.shippingBranch ? `(Sucursal: ${customer.shippingBranch})` : ''}<br/>
              <strong style="color: ${IVORY};">Tiempo de tr&aacute;nsito:</strong> ${customer.shippingMethod === 'LOCAL' ? 'Entrega express 24-48hs hábiles.' : '3 a 5 días hábiles desde que se despacha.'}<br/>
              <strong style="color: ${IVORY};">Preparaci&oacute;n / despacho:</strong> ${hasCrystals ? '5 días hábiles por calibración y trabajo de laboratorio a medida.' : 'Despacho rápido dentro de los 2 días hábiles.'}
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 44px 40px 44px;">
        <h2 style="margin: 0; font-family: ${SERIF}; font-size: 26px; font-weight: normal; color: ${IVORY};">&iquest;Ten&eacute;s dudas?</h2>
        <p style="margin: 12px 0 26px; font-family: ${SANS}; font-size: 14px; line-height: 1.8; color: ${MUTED};">
          Estamos del otro lado para ayudarte con lo que necesites sobre tu pedido.
        </p>
        ${whatsappButton('Escribinos por WhatsApp', `Hola Atelier! Tengo una consulta sobre mi pedido #${shortId}.`)}
      </td>
    </tr>
  `);
}

export function getAdminHtml(customer: any, orderId: string, emailTotal: number, shippingMethodLabel: string, isTransfer: boolean, itemsHtml: string) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd;">
      <h2 style="color: #333; border-bottom: 2px solid #000; padding-bottom: 10px;">🚨 NUEVA VENTA WEB 🚨</h2>
      <p><strong>Orden ID:</strong> #${orderId}</p>
      <p><strong>Total:</strong> $${emailTotal.toLocaleString('es-AR')} (${isTransfer ? 'Transferencia' : 'Tarjeta'})</p>

      <h3 style="background: #f4f4f4; padding: 10px; margin-top: 20px;">Datos del Cliente</h3>
      <ul style="list-style: none; padding: 0;">
        <li><strong>Nombre:</strong> ${customer.firstName} ${customer.lastName}</li>
        <li><strong>Email:</strong> ${customer.email}</li>
        <li><strong>WhatsApp:</strong> ${customer.phone}</li>
        <li><strong>DNI:</strong> ${customer.dni}</li>
        <li><strong>Método de Envío:</strong> ${shippingMethodLabel} ${customer.shippingBranch ? `(Sucursal: ${customer.shippingBranch})` : ''}</li>
        <li><strong>Dirección:</strong> ${customer.address}, ${customer.city}, ${customer.state} ${customer.zip}</li>
      </ul>

      <h3 style="background: #f4f4f4; padding: 10px; margin-top: 20px;">Productos Comprados</h3>
      <table width="100%" cellpadding="10" cellspacing="0" style="border-collapse: collapse;">
        ${itemsHtml}
      </table>

      <div style="margin-top: 30px; padding: 15px; background: #e8f5e9; border-left: 5px solid #4caf50;">
        <p style="margin: 0;"><strong>Ingresá al CRM</strong> para ver y gestionar la ficha completa.</p>
      </div>
    </div>
  `;
}

export function getClientTransferHtml(customer: any, orderId: string, emailTotal: number) {
  const shortId = orderId.slice(-4).toUpperCase();
  return emailShell(`
    <tr>
      <td align="center" style="padding: 40px 40px 0;">
        <p style="margin: 0; font-family: ${SANS}; font-size: 13px; font-weight: bold; letter-spacing: 6px; text-transform: uppercase; color: ${GOLD};">Instrucciones de pago</p>
        <h1 style="margin: 20px 0 0; font-family: ${SERIF}; font-size: 38px; font-weight: normal; line-height: 1.15; color: ${IVORY};">Un &uacute;ltimo paso, ${customer.firstName}.</h1>
        <p style="margin: 18px 0 0; font-family: ${SANS}; font-size: 14px; line-height: 1.9; color: ${MUTED};">
          Registramos tu pedido <span style="color: ${GOLD_SOFT};">#${shortId}</span> con &eacute;xito.<br/>
          Elegiste abonar por transferencia bancaria con descuento: el total a transferir es de
        </p>
        <p style="margin: 18px 0 0;">
          <span style="display: inline-block; padding: 12px 30px; background-color: ${GOLD}; font-family: ${SERIF}; font-size: 28px; color: #000000;">$${emailTotal.toLocaleString('es-AR')}</span>
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px 40px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#14120c" style="background-color: #14120c; border: 1px solid ${HAIRLINE}; border-left: 3px solid ${GOLD};">
          <tr>
            <td style="padding: 22px 24px; font-family: ${SANS}; font-size: 13px; line-height: 2.1; color: #d8d2c4;">
              <span style="color: ${GOLD}; letter-spacing: 2px; font-size: 11px; text-transform: uppercase; font-weight: bold;">Datos para la transferencia</span><br/>
              <strong style="color: ${IVORY};">Titular:</strong> Ishtar Pissano<br/>
              <strong style="color: ${IVORY};">CVU:</strong> <span style="font-family: 'Courier New', monospace; color: ${IVORY};">0000069704088281149142</span><br/>
              <strong style="color: ${IVORY};">Alias:</strong> <span style="font-family: 'Courier New', monospace; color: ${IVORY};">badaza.media.arq</span><br/>
              <strong style="color: ${IVORY};">Banco:</strong> Proveedor de Servicios de Pago - Garpa S.A.
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 32px 40px 36px;">
        <p style="margin: 0 0 22px; font-family: ${SANS}; font-size: 13px; line-height: 1.8; color: ${MUTED};">
          Una vez realizada la transferencia, envianos el comprobante<br/>
          para que empecemos a preparar tu pedido.
        </p>
        ${whatsappButton('Enviar comprobante por WhatsApp', `Hola Atelier! Les envío el comprobante de mi pedido #${shortId}.`)}
        <p style="margin: 26px 0 0; font-family: ${SANS}; font-size: 13px; color: ${MUTED};">
          &iquest;Ten&eacute;s dudas? Respond&eacute; este correo o escribinos: estamos para ayudarte.
        </p>
      </td>
    </tr>
  `);
}

export function getClientWholesaleHtml(customer: any, orderId: string, emailTotal: number) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
      <h2 style="color: #1e3a8a; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-top: 0;">¡Hola ${customer.firstName}!</h2>
      <p>Hemos registrado tu pedido mayorista <strong>#${orderId.slice(-4).toUpperCase()}</strong> de forma exitosa.</p>
      <p>El total a coordinar de tu compra mayorista es de <strong>$${emailTotal.toLocaleString('es-AR')}</strong>.</p>

      <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #1e3a8a;">
        <h4 style="margin: 0 0 5px 0; color: #1e3a8a;">Coordinación de Pago y Despacho</h4>
        <p style="margin: 0; font-size: 13px; line-height: 1.4; color: #555;">
          Nos pondremos en contacto contigo por correo electrónico o WhatsApp a la brevedad para enviarte la factura proforma y coordinar la transferencia bancaria u otro medio de pago elegido, así como el despacho de la mercadería.
        </p>
      </div>

      <p style="font-size: 12px; color: #666; background: #eff6ff; padding: 10px; border-radius: 4px;">
        Nota: La mercadería ha sido reservada de nuestro stock para tu pedido.
      </p>

      <p style="margin-top: 25px; font-weight: bold;">Atelier Óptica - Área Mayorista</p>
    </div>
  `;
}

export function getAdminWholesaleHtml(customer: any, orderId: string, emailTotal: number, shippingMethodLabel: string, itemsHtml: string) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd;">
      <h2 style="color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-top: 0;">💼 NUEVO PEDIDO MAYORISTA WEB 💼</h2>
      <p><strong>Orden ID:</strong> #${orderId}</p>
      <p><strong>Total Mayorista:</strong> $${emailTotal.toLocaleString('es-AR')}</p>

      <h3 style="background: #f4f4f4; padding: 10px; margin-top: 20px;">Datos de la Óptica</h3>
      <ul style="list-style: none; padding: 0;">
        <li><strong>Nombre / Razón Social:</strong> ${customer.firstName} ${customer.lastName}</li>
        <li><strong>Email:</strong> ${customer.email}</li>
        <li><strong>WhatsApp:</strong> ${customer.phone}</li>
        <li><strong>DNI/CUIT:</strong> ${customer.dni}</li>
        <li><strong>Método de Envío:</strong> ${shippingMethodLabel} ${customer.shippingBranch ? `(Sucursal: ${customer.shippingBranch})` : ''}</li>
        <li><strong>Dirección:</strong> ${customer.address}, ${customer.city}, ${customer.state} ${customer.zip}</li>
      </ul>

      <h3 style="background: #f4f4f4; padding: 10px; margin-top: 20px;">Productos Comprados</h3>
      <table width="100%" cellpadding="10" cellspacing="0" style="border-collapse: collapse;">
        ${itemsHtml}
      </table>

      <div style="margin-top: 30px; padding: 15px; background: #eff6ff; border-left: 5px solid #3b82f6;">
        <p style="margin: 0; font-weight: bold;">Acción requerida:</p>
        <p style="margin: 5px 0 0 0; font-size: 13px;">Comunicate con el cliente para cobrar y acordar el despacho de la mercadería.</p>
      </div>
    </div>
  `;
}
