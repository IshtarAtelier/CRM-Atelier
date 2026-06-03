import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { WHATSAPP_PHONE } from '@/lib/constants';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { customer, items, total } = body;

    console.log("[PAYWAY CHECKOUT] Recibido pedido de:", customer.email);
    console.log("[PAYWAY CHECKOUT] Total a procesar: $", total);

    // 1. Encontrar o crear cliente
    let client = await prisma.client.findFirst({
      where: {
        OR: [
          { email: customer.email },
          { dni: customer.dni }
        ]
      }
    });

    if (!client) {
      client = await prisma.client.create({
        data: {
          name: `${customer.firstName} ${customer.lastName}`,
          email: customer.email,
          phone: customer.phone,
          dni: customer.dni,
          address: `${customer.address}, ${customer.city}, ${customer.state} ${customer.zip}`,
          contactSource: "WEB_STOREFRONT",
          status: "CONTACT"
        }
      });
    }

    // 2. Encontrar usuario de sistema (o el primer admin disponible) para asignar la venta
    const systemUser = await prisma.user.findFirst();
    if (!systemUser) throw new Error("No system user found to assign order.");

    // 3. Crear la Orden (Ficha)
    const order = await prisma.order.create({
      data: {
        clientId: client.id,
        userId: systemUser.id,
        status: "WEB_PENDING",
        orderType: "WEB",
        total: customer.paymentMethod === 'TRANSFER' ? total * 0.85 : total,
        labNotes: `Método de envío: ${customer.shippingMethod}. Método de pago: ${customer.paymentMethod}. Dirección: ${customer.address}, ${customer.city}, ${customer.state} ${customer.zip}`,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId !== "unknown" ? item.productId : undefined,
            productNameSnapshot: item.model,
            productBrandSnapshot: item.brand,
            quantity: item.quantity,
            price: item.price,
            // Guardamos la info del cristal en notas si tiene config
            prismVal: item.lensConfig ? JSON.stringify(item.lensConfig) : null
          }))
        }
      }
    });

    console.log("[PAYWAY CHECKOUT] Ficha de venta creada en CRM:", order.id);

    // 4. Enviar email de confirmación (asincrónico, usando sendEmail centralizado)
    const isTransfer = customer.paymentMethod === 'TRANSFER';
    const emailTotal = isTransfer ? total * 0.85 : total;
    const hasCrystals = items.some((item: any) => item.lensConfig?.lensType && item.lensConfig.lensType !== "NONE");
    const whatsappPhone = WHATSAPP_PHONE;
    
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

    const confirmationHtml = `
      <div style="font-family: 'Inter', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #e5e5e5;">
        <h1 style="font-size: 32px; text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px;">ATELIER ÓPTICA</h1>
        <h2 style="font-size: 18px; font-weight: normal; margin-top: 30px;">Hola ${customer.firstName},</h2>
        <p>Gracias por elegir a Atelier Óptica. Hemos recibido tu pedido con el número de orden <strong>#${order.id}</strong>.</p>
        <table width="100%" cellpadding="0" cellspacing="0">${itemsHtml}</table>
        <p style="text-align: right; font-weight: bold; font-size: 16px; margin-top: 20px;">Total: $${emailTotal.toLocaleString("es-AR")}</p>
        <div style="background: #f9f9f9; border-left: 4px solid #000; padding: 15px; margin: 20px 0;">
          <strong>Tiempo de entrega estimado:</strong><br/>
          ${hasCrystals ? '7 a 10 días hábiles por trabajo de laboratorio.' : 'Despacho rápido dentro de las 24/48hs hábiles.'}
        </div>
        <p style="text-align: center; color: #666; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
          Atelier Óptica - Cerro de las Rosas, Córdoba.<br/>
          WhatsApp: <a href="https://wa.me/${whatsappPhone}">${whatsappPhone}</a>
        </p>
      </div>
    `;

    // No usamos await acá para no demorar la respuesta de la API al cliente web
    sendEmail({
      to: customer.email,
      subject: `Confirmación de Orden #${order.id} - Atelier Óptica`,
      html: confirmationHtml
    }).catch(err => console.error("Error confirmation email:", err));

    // Email de notificación al administrador
    const adminEmail = process.env.ADMIN_EMAIL || 'pisano.ishtar@gmail.com';
    sendEmail({
      to: adminEmail,
      subject: `🛒 Nueva Compra Web - $${emailTotal.toLocaleString('es-AR')}`,
      text: `Se ha registrado una nueva venta en la web.\n\n` +
            `Cliente: ${customer.firstName} ${customer.lastName} (${customer.email})\n` +
            `Total: $${emailTotal.toLocaleString('es-AR')} (${isTransfer ? 'Transferencia' : 'Tarjeta'})\n` +
            `Items: ${items.length} producto(s)\n\n` +
            `Ingresá al CRM para ver el detalle de la Ficha #${order.id.slice(-4).toUpperCase()}`
    }).catch(err => console.error("Error admin email:", err));

    // Función para descontar stock (ignorando cristales a medida o productos sin ID válido)
    const decrementStock = async () => {
      for (const item of items) {
        if (item.productId && item.productId !== "unknown") {
          try {
            await prisma.product.update({
              where: {
                id: item.productId,
                category: { not: "Cristal" },
                stock: { gte: item.quantity || 1 }
              },
              data: { stock: { decrement: item.quantity || 1 } }
            });
          } catch (err) {
            console.warn(`[STOCK DECREMENT FAILED] Atomic stock decrement failed for product ${item.productId}:`, err);
          }
        }
      }
    };

    // Si eligió transferencia bancaria, procesar como orden pendiente y devolver exito
    if (isTransfer) {
       await decrementStock(); // Reservar stock para la transferencia
       return NextResponse.json({ 
         success: true, 
         message: "Orden de transferencia generada",
         orderId: order.id
       });
    }

    // PAYWAY: Ejecutar el pago real
    const paymentToken = body.paymentToken;
    const bin = body.bin;
    
    if (!paymentToken || !bin) {
      throw new Error("Token de pago o BIN no proporcionado.");
    }

    // Determinar la marca de la tarjeta (Visa=1, Mastercard=15, Amex=39) basándonos en el BIN
    let paymentMethodId = 1; // Default Visa
    if (bin.startsWith("5") || bin.startsWith("2")) paymentMethodId = 15; // Mastercard
    if (bin.startsWith("34") || bin.startsWith("37")) paymentMethodId = 39; // Amex

    const siteId = process.env.PAYWAY_SITE_ID;
    const privateKey = process.env.PAYWAY_PRIVATE_KEY;
    const isProd = process.env.PAYWAY_ENVIRONMENT === 'production';
    
    const apiUrl = isProd 
      ? 'https://live.decidir.com/api/v2/payments'
      : 'https://developers.decidir.com/api/v2/payments';

    const paywayRequest = {
      site_transaction_id: `WEB-${order.id}-${Date.now()}`,
      token: paymentToken,
      payment_method_id: paymentMethodId,
      bin: bin,
      amount: total,
      currency: "ARS",
      installments: parseInt(customer.installments || "1", 10),
      description: "Compra Atelier Óptica Web",
      payment_type: "single",
      establishment_name: "Atelier Optica",
      sub_payments: []
    };

    const paywayRes = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'apikey': privateKey || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paywayRequest)
    });

    const paywayData = await paywayRes.json();

    if (!paywayRes.ok || paywayData.status !== 'approved') {
      console.error("[PAYWAY DECLINED]", paywayData);
      
      // Actualizar orden a fallida/rechazada
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "CANCELED", labNotes: `[PAGO RECHAZADO PAYWAY]: ${paywayData.status_details?.error?.reason?.description || 'Fondos insuficientes o tarjeta rechazada.'}\n\n` + order.labNotes }
      });

      return NextResponse.json(
        { error: `Pago rechazado: ${paywayData.status_details?.error?.reason?.description || 'Contactá al emisor de tu tarjeta.'}` },
        { status: 400 }
      );
    }

    // PAGO APROBADO
    console.log("[PAYWAY APPROVED] Transacción exitosa:", paywayData.id);

    // Actualizamos la orden a pagada
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "PAID" }
    });

    await decrementStock(); // Descontar stock tras pago exitoso con tarjeta

    return NextResponse.json({ 
      success: true, 
      transactionId: paywayData.id,
      message: "Pago procesado con éxito",
      orderId: order.id
    });

  } catch (error) {
    console.error("[PAYWAY API ERROR]", error);
    return NextResponse.json(
      { error: 'Error procesando solicitud de pago o creando la ficha' },
      { status: 500 }
    );
  }
}
