import { WHATSAPP_PHONE } from '@/lib/constants';

export function getConfirmationHtml(customer: any, orderId: string, emailTotal: number, shippingMethodLabel: string, hasCrystals: boolean, itemsHtml: string) {
  return `
    <div style="font-family: 'Inter', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #e5e5e5;">
      <h1 style="font-size: 32px; text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px;">ATELIER ÓPTICA</h1>
      <h2 style="font-size: 18px; font-weight: normal; margin-top: 30px;">Hola ${customer.firstName},</h2>
      <p>Gracias por elegir a Atelier Óptica. Hemos recibido tu pedido con el número de orden <strong>#${orderId}</strong>.</p>
      <table width="100%" cellpadding="0" cellspacing="0">${itemsHtml}</table>
      <p style="text-align: right; font-weight: bold; font-size: 16px; margin-top: 20px;">Total: $${emailTotal.toLocaleString("es-AR")}</p>
      <div style="background: #f9f9f9; border-left: 4px solid #000; padding: 15px; margin: 20px 0;">
        <strong>Método de envío:</strong> ${shippingMethodLabel} ${customer.shippingBranch ? `(Sucursal: ${customer.shippingBranch})` : ''}<br/>
        <strong>Tiempo de tránsito:</strong> ${customer.shippingMethod === 'LOCAL' ? 'Entrega express 24-48hs hábiles' : '3 a 5 días hábiles desde que se despacha.'}<br/>
        <strong>Tiempo de preparación / despacho:</strong><br/>
        ${hasCrystals ? '5 días hábiles por calibración y trabajo de laboratorio a medida.' : 'Despacho rápido dentro de los 2 días hábiles.'}
      </div>
      <p style="text-align: center; color: #666; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
        Atelier Óptica - Cerro de las Rosas, Córdoba.<br/>
        WhatsApp: <a href="https://wa.me/${WHATSAPP_PHONE}">${WHATSAPP_PHONE}</a>
      </p>
    </div>
  `;
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
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h2 style="color: #4caf50;">¡Hola ${customer.firstName}!</h2>
      <p>Hemos registrado tu pedido <strong>#${orderId.slice(-4).toUpperCase()}</strong> de forma exitosa.</p>
      <p>Elegiste abonar mediante transferencia bancaria con descuento. El total a transferir es de <strong>$${emailTotal.toLocaleString('es-AR')}</strong>.</p>
      
      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #ddd;">
        <h3 style="margin-top: 0;">Datos para la transferencia</h3>
        <ul style="list-style: none; padding: 0; margin: 0;">
          <li style="margin-bottom: 10px;"><strong>CVU:</strong> 0000069704088281149142</li>
          <li style="margin-bottom: 10px;"><strong>Alias:</strong> badaza.media.arq</li>
          <li><strong>Banco:</strong> Proveedor de Servicios de Pago - Garpa S.A.</li>
        </ul>
      </div>
      
      <p style="background: #e8f5e9; padding: 15px; border-left: 4px solid #4caf50; font-weight: bold;">
        IMPORTANTE: Una vez realizada la transferencia, respondé este correo o envianos el comprobante por WhatsApp al ${WHATSAPP_PHONE} para que empecemos a preparar tu pedido.
      </p>
      
      <p style="margin-top: 30px;">¡Gracias por elegir Atelier Óptica!</p>
    </div>
  `;
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
