import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendOrderConfirmationEmail } from '@/lib/services/email-service';

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

    // 4. Enviar email de confirmación (asincrónico)
    const isTransfer = customer.paymentMethod === 'TRANSFER';
    const emailTotal = isTransfer ? total * 0.85 : total;
    
    // No usamos await acá para no demorar la respuesta de la API al cliente web
    sendOrderConfirmationEmail({
      orderId: order.id,
      customerName: customer.firstName,
      items: items,
      total: emailTotal,
      isTransfer: isTransfer
    }, customer.email).catch(err => console.error("Error trigger email:", err));

    // Email de notificación al administrador
    import('@/lib/email').then(({ sendEmail }) => {
      sendEmail({
        to: 'pisano.ishtar@gmail.com',
        subject: `🛒 Nueva Compra Web - $${emailTotal.toLocaleString('es-AR')}`,
        text: `Se ha registrado una nueva venta en la web.\n\n` +
              `Cliente: ${customer.firstName} ${customer.lastName} (${customer.email})\n` +
              `Total: $${emailTotal.toLocaleString('es-AR')} (${isTransfer ? 'Transferencia' : 'Tarjeta'})\n` +
              `Items: ${items.length} producto(s)\n\n` +
              `Ingresá al CRM para ver el detalle de la Ficha #${order.id.slice(-4).toUpperCase()}`
      }).catch(err => console.error("Error admin email:", err));
    });

    // Función para descontar stock (ignorando cristales a medida o productos sin ID válido)
    const decrementStock = async () => {
      for (const item of items) {
        if (item.productId && item.productId !== "unknown") {
          // Chequear primero si es un producto físico (no un servicio o cristal genérico)
          const dbProd = await prisma.product.findUnique({ where: { id: item.productId } });
          if (dbProd && dbProd.category !== "Cristal" && dbProd.stock > 0) {
            await prisma.product.update({
              where: { id: item.productId },
              data: { stock: { decrement: item.quantity || 1 } }
            });
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
