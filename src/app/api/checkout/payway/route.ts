import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { WHATSAPP_PHONE } from '@/lib/constants';
import { ContactService, normalizeArgentinePhone } from '@/services/contact.service';
import { getWebSettings } from '@/lib/web-settings';
import { CrystalMapping } from '@/lib/config/crystal-mapping';
import { generateReceiptPDF } from '@/lib/receipt-pdf-generator';
import { getAdminHtml, getAdminWholesaleHtml, getClientTransferHtml, getClientWholesaleHtml, getConfirmationHtml } from '@/lib/checkout/checkout-emails';
import { recalculateItemPrice } from '@/lib/checkout/checkout-pricing';

function getArgentineStateCode(stateName: string): string {
  if (!stateName) return "C"; // fallback to CABA
  const normalized = stateName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  
  switch (normalized) {
    case "caba":
    case "ciudad autonoma de buenos aires":
    case "capital federal":
    case "capital":
      return "C";
    case "buenos aires":
    case "provincia de buenos aires":
    case "pba":
      return "B";
    case "catamarca":
      return "K";
    case "chaco":
      return "H";
    case "chubut":
      return "U";
    case "cordoba":
      return "X";
    case "corrientes":
      return "W";
    case "entre rios":
      return "E";
    case "formosa":
      return "P";
    case "jujuy":
      return "Y";
    case "la pampa":
      return "L";
    case "la rioja":
      return "F";
    case "mendoza":
      return "M";
    case "misiones":
      return "N";
    case "neuquen":
      return "Q";
    case "rio negro":
      return "R";
    case "salta":
      return "A";
    case "san juan":
      return "J";
    case "san luis":
      return "D";
    case "santa cruz":
      return "Z";
    case "santa fe":
      return "S";
    case "santiago del estero":
      return "G";
    case "tierra del fuego":
    case "tierra del fuego, antartida e islas del atlantico sur":
      return "V";
    case "tucuman":
      return "T";
    default:
      if (stateName.length === 1 && /^[a-zA-Z]$/.test(stateName)) {
        return stateName.toUpperCase();
      }
      return "C";
  }
}

export async function POST(req: Request) {
  let globalRestoreStock: (() => Promise<void>) | null = null;
  try {
    const body = await req.json();
    const { customer, items, total } = body;

    // Check if the user is a wholesale client (OPTICA role)
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    let isWholesaleUser = false;
    if (sessionToken) {
      try {
        const { decrypt } = await import('@/lib/auth');
        const payload = await decrypt(sessionToken);
        if (payload && payload.role === 'OPTICA') {
          isWholesaleUser = true;
        }
      } catch (err) {
        console.error("Error decrypting wholesale session token:", err);
      }
    }

    if (customer.paymentMethod === 'MAYORISTA' && !isWholesaleUser) {
      return NextResponse.json({ error: "Método de pago no autorizado." }, { status: 403 });
    }
    if (isWholesaleUser) {
      customer.paymentMethod = 'MAYORISTA';
    }

    const shippingMethodLabel = (() => {
      switch (customer.shippingMethod) {
        case 'LOCAL': return 'Cadetería Local (Cba/Carlos Paz)';
        case 'CORREO_DOMICILIO': return 'Envío a Domicilio (Correo Argentino)';
        case 'CORREO_SUCURSAL': return 'Envío a Sucursal (Correo Argentino)';
        default: return customer.shippingMethod || 'No especificado';
      }
    })();

    console.log("[PAYWAY CHECKOUT] Recibido pedido de:", customer.email);
    console.log("[PAYWAY CHECKOUT] Total a procesar: $", total);

    // Fetch web settings for dynamic discount rate
    const webSettings = await getWebSettings();
    const cashDiscountRate = (webSettings.web_promo_cash_discount ?? 15) / 100;
    const transferMultiplier = 1 - cashDiscountRate;

    // Fetch all crystals and treatments from DB to recalculate pricing on backend
    const crystals = await prisma.product.findMany({
      where: { category: 'Cristal' }
    });
    const treatments = await prisma.product.findMany({
      where: { category: 'Tratamientos y Accesorios' }
    });

    const findTintPrice = () => {
      const tintProduct = treatments.find(p => p.name?.toLowerCase().includes('teñido') || p.name?.toLowerCase().includes('tenido'));
      if (tintProduct && tintProduct.price) return tintProduct.price;
      return CrystalMapping.EXTRAS.TINT;
    };

    const findPrice = (config: any) => {
      let matches = crystals;
      if (config.type) {
        matches = matches.filter(p => p.type === config.type);
      }
      if (config.exactMatchName) {
        const exactMatch = matches.find(p => p.name?.toLowerCase() === config.exactMatchName.toLowerCase());
        if (exactMatch && exactMatch.price) return exactMatch.price;
      }
      if (config.matchKeywords && config.matchKeywords.length > 0) {
        matches = matches.filter(p => 
          config.matchKeywords.some((kw: string) => p.name?.toLowerCase().includes(kw))
        );
      } else if (config.matchKeywords && config.matchKeywords.length === 0 && config.type === "Cristal Monofocal") {
        matches = matches.filter(p => 
          !p.name?.toLowerCase().includes('blue') && 
          !p.name?.toLowerCase().includes('foto') &&
          !p.name?.toLowerCase().includes('transitions')
        );
      }
      if (matches.length === 0) return 0;
      return Math.min(...matches.map(p => p.price || 0));
    };

    const PRICING = {
      MONOFOCAL: {
        ORGANICO_BLANCO: findPrice(CrystalMapping.MONOFOCAL.ORGANICO_BLANCO) || 20000,
        ORGANICO_AR: findPrice(CrystalMapping.MONOFOCAL.ORGANICO_AR) || 45000,
        ORGANICO_BLUE: findPrice(CrystalMapping.MONOFOCAL.ORGANICO_BLUE) || 68000,
        POLI_BLUE: findPrice(CrystalMapping.MONOFOCAL.POLI_BLUE) || 120000,
        ORGANICO_FOTOCROMATICO: findPrice(CrystalMapping.MONOFOCAL.ORGANICO_FOTOCROMATICO) || 105000,
        ORGANICO_BLANCO_TENIDO: findPrice(CrystalMapping.MONOFOCAL.ORGANICO_BLANCO_TENIDO) || 68000,
      },
      BIFOCAL: {
        ORGANICO_BLANCO: findPrice(CrystalMapping.BIFOCAL.ORGANICO_BLANCO) || 45000,
      },
      MULTIFOCAL: {
        SMART_FREE: findPrice(CrystalMapping.MULTIFOCAL.SMART_FREE) || 120000,
        VARILUX: findPrice(CrystalMapping.MULTIFOCAL.VARILUX) || 350000,
        FOTOCROMATICO: findPrice(CrystalMapping.MULTIFOCAL.FOTOCROMATICO) || 180000,
      },
      EXTRAS: {
        TINT: findTintPrice()
      }
    };

    // Recalculate prices and verify total
    let recalculatedItemsTotal = 0;
    const sanitizedItems = [];

    for (const item of items) {
      const safeProductId = item.productId && item.productId !== "unknown"
        ? item.productId.replace(/[^a-zA-Z0-9_-]/g, '')
        : undefined;

      let dbProduct = null;
      if (safeProductId) {
        dbProduct = await prisma.product.findUnique({
          where: { id: safeProductId }
        });
      }

      if (!dbProduct) {
        throw new Error(`Producto no encontrado en la base de datos: ${item.model}`);
      }

      const calculatedPrice = recalculateItemPrice(item, dbProduct, isWholesaleUser, PRICING);

      recalculatedItemsTotal += calculatedPrice * item.quantity;

      sanitizedItems.push({
        ...item,
        productId: safeProductId,
        price: calculatedPrice
      });
    }

    console.log("[PAYWAY CHECKOUT] Precio recalculado backend:", recalculatedItemsTotal, "| Total frontend:", total, "| Diferencia:", Math.abs(recalculatedItemsTotal - total));
    for (const si of sanitizedItems) {
      console.log(`[PAYWAY CHECKOUT] Item: ${si.model} | Precio calculado: ${si.price} | Qty: ${si.quantity} | ProductId: ${si.productId}`);
    }

    if (Math.abs(recalculatedItemsTotal - total) > 5) {
      console.error("[PAYWAY CHECKOUT] DISCREPANCIA DETECTADA - Backend:", recalculatedItemsTotal, "Frontend:", total);
      return NextResponse.json({ error: "Discrepancia de precio detectada. Por favor, reintente." }, { status: 400 });
    }

    // 1. Encontrar o crear cliente
    const normalizedPhone = normalizeArgentinePhone(customer.phone);
    
    let client = await prisma.client.findFirst({
      where: {
        OR: [
          { phone: normalizedPhone },
          { email: customer.email },
          ...(customer.dni ? [{ dni: customer.dni }] : [])
        ]
      }
    });

    if (!client) {
      try {
        client = await ContactService.create({
          name: `${customer.firstName} ${customer.lastName}`,
          email: customer.email,
          phone: normalizedPhone,
          dni: customer.dni,
          address: `${customer.address}, ${customer.city}, ${customer.state} ${customer.zip}`,
          contactSource: "WEB_STOREFRONT",
        });
      } catch (error: any) {
        let isHandled = false;
        try {
          if (error?.message && (error.message.trim().startsWith('{') || error.message.trim().startsWith('['))) {
            const parsedError = JSON.parse(error.message);
            if (parsedError?.isDuplicate && parsedError?.existingClient?.id) {
              client = await ContactService.update(parsedError.existingClient.id, {
                address: `${customer.address}, ${customer.city}, ${customer.state} ${customer.zip}`,
                contactSource: "WEB_STOREFRONT"
              });
              isHandled = true;
            }
          }
        } catch (e) {
          console.error("[DUPLICATE PARSE ERROR]", e);
        }
        if (!isHandled) {
          throw error;
        }
      }
    }

    if (!client) {
      throw new Error("No se pudo obtener o crear el cliente.");
    }

    // 2. Encontrar usuario de sistema (o el primer admin disponible) para asignar la venta
    const systemUser = await prisma.user.findFirst();
    if (!systemUser) throw new Error("No system user found to assign order.");

    // Perform stock check before creating anything or charging card
    for (const item of sanitizedItems) {
      if (item.productId) {
        const dbProduct = await prisma.product.findUnique({
          where: { id: item.productId }
        });
        if (dbProduct && dbProduct.category !== "Cristal" && dbProduct.category !== "Tratamiento" && dbProduct.stock < item.quantity) {
          return NextResponse.json({ error: `Stock insuficiente para ${item.model}. Disponible: ${dbProduct.stock}` }, { status: 400 });
        }
      }
    }

    // Decrement stock in preparation
    const decrementedProducts: { id: string, quantity: number }[] = [];
    globalRestoreStock = async () => {
      for (const dp of decrementedProducts) {
        try {
          await prisma.product.update({
            where: { id: dp.id },
            data: { stock: { increment: dp.quantity } }
          });
        } catch (err) {
          console.error(`Error restoring stock for product ${dp.id}:`, err);
        }
      }
    };

    try {
      for (const item of sanitizedItems) {
        if (item.productId) {
          const dbProduct = await prisma.product.findUnique({
            where: { id: item.productId }
          });
          if (dbProduct && dbProduct.category !== "Cristal" && dbProduct.category !== "Tratamiento") {
            await prisma.product.update({
              where: { id: item.productId },
              data: { stock: { decrement: item.quantity } }
            });
            decrementedProducts.push({ id: item.productId, quantity: item.quantity });
          }
        }
      }
    } catch (err) {
      if (globalRestoreStock) await globalRestoreStock();
      throw err;
    }

    // 2.5 Preparar items de la orden desglosando cristales OD/OI si aplica
    const orderItemsToCreate: any[] = [];
    for (const item of sanitizedItems) {
      const isCustomLens = item.lensConfig && (item.lensConfig.lensType !== "NONE" || item.lensConfig.color);
      
      if (isCustomLens) {
        let dbProduct = null;
        if (item.productId) {
          dbProduct = await prisma.product.findUnique({
            where: { id: item.productId }
          });
        }
        
        const framePrice = dbProduct ? dbProduct.price : item.price;
        const totalLensPrice = Math.max(0, item.price - framePrice);
        const lensPricePerEye = Math.round(totalLensPrice / 2);
        
        // 1. Agregar el armazón
        orderItemsToCreate.push({
          productId: item.productId || undefined,
          productNameSnapshot: item.model,
          productBrandSnapshot: item.brand,
          productCategorySnapshot: dbProduct?.category || "Armazón",
          quantity: item.quantity,
          price: framePrice,
          eye: null
        });
        
        // Describir el cristal
        const lensTypeDesc = item.lensConfig.lensType === "NONE" || !item.lensConfig.lensType
          ? "Cristal Neutro" 
          : `Cristal ${item.lensConfig.lensType}`;
        const treatmentDesc = item.lensConfig.treatment 
          ? ` - ${item.lensConfig.treatment.replace(/_/g, ' ')}` 
          : '';
        const lensName = `${lensTypeDesc}${treatmentDesc}`;
        
        // 2. Agregar cristal Ojo Derecho (OD)
        orderItemsToCreate.push({
          productId: undefined,
          productNameSnapshot: lensName,
          productBrandSnapshot: "Laboratorio",
          productCategorySnapshot: "Cristal",
          quantity: item.quantity,
          price: lensPricePerEye,
          eye: "OD",
          prismVal: item.lensConfig.prescriptionFile || null,
          crystalColor: item.lensConfig.color || null
        });
        
        // 3. Agregar cristal Ojo Izquierdo (OI)
        orderItemsToCreate.push({
          productId: undefined,
          productNameSnapshot: lensName,
          productBrandSnapshot: "Laboratorio",
          productCategorySnapshot: "Cristal",
          quantity: item.quantity,
          price: lensPricePerEye,
          eye: "OI",
          prismVal: item.lensConfig.prescriptionFile || null,
          crystalColor: item.lensConfig.color || null
        });
      } else {
        // Producto estándar sin cristales customizados
        let dbProduct = null;
        if (item.productId) {
          dbProduct = await prisma.product.findUnique({
            where: { id: item.productId }
          });
        }
        
        orderItemsToCreate.push({
          productId: item.productId || undefined,
          productNameSnapshot: item.model,
          productBrandSnapshot: item.brand,
          productCategorySnapshot: dbProduct?.category || null,
          quantity: item.quantity,
          price: item.price,
          eye: null
        });
      }
    }

    // 3. Crear la Orden (Ficha)
    let order;
    try {
      order = await prisma.order.create({
        data: {
          clientId: client.id,
          userId: systemUser.id,
          status: "WEB_PENDING",
          orderType: "SALE",
          total: customer.paymentMethod === 'TRANSFER' ? recalculatedItemsTotal * transferMultiplier : recalculatedItemsTotal,
          labNotes: `Método de envío: ${shippingMethodLabel}${customer.shippingBranch ? ` (Sucursal: ${customer.shippingBranch})` : ''}. Método de pago: ${customer.paymentMethod}. Dirección: ${customer.address}, ${customer.city}, ${customer.state} ${customer.zip}`,
          items: {
            create: orderItemsToCreate
          }
        }
      });
    } catch (createErr) {
      if (globalRestoreStock) await globalRestoreStock();
      throw createErr;
    }

    console.log("[PAYWAY CHECKOUT] Ficha de venta creada en CRM:", order.id);

    // 4. Enviar email de confirmación (asincrónico, usando sendEmail centralizado)
    const isTransfer = customer.paymentMethod === 'TRANSFER';
    const emailTotal = isTransfer ? recalculatedItemsTotal * transferMultiplier : recalculatedItemsTotal;
    const hasCrystals = sanitizedItems.some((item: any) => item.lensConfig && (item.lensConfig.lensType !== "NONE" || item.lensConfig.color));
    const whatsappPhone = WHATSAPP_PHONE;
    
    const itemsHtml = sanitizedItems.map((item: any) => `
      <tr>
        <td style="padding: 15px 0; border-bottom: 1px solid #eeeeee;">
          <p style="margin: 0; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #333;">${item.brand || 'ATELIER'}</p>
          <p style="margin: 5px 0 0; font-size: 16px; color: #000;">${item.model}</p>
          ${item.lensConfig && (item.lensConfig.lensType !== "NONE" || item.lensConfig.color) ? `
            <p style="margin: 5px 0 0; font-size: 12px; color: #666;">
              Cristales: ${item.lensConfig.lensType === "NONE" ? "Sin Aumento" : item.lensConfig.lensType} 
              ${item.lensConfig.treatment ? `- ${item.lensConfig.treatment.replace(/_/g, ' ')}` : ''}
              ${item.lensConfig.color ? `<br/>Tinte: ${item.lensConfig.color}` : ''}
              ${item.lensConfig.prescriptionFile ? `<br/>Receta: ${item.lensConfig.prescriptionFile}` : ''}
            </p>
          ` : ''}
        </td>
        <td style="padding: 15px 0; border-bottom: 1px solid #eeeeee; text-align: right; font-size: 14px;">
          $${(item.price * item.quantity).toLocaleString("es-AR")}
        </td>
      </tr>
    `).join('');

    const confirmationHtml = getConfirmationHtml(customer, order.id, emailTotal, shippingMethodLabel, hasCrystals, itemsHtml);
    const adminEmails = 'pisano.ishtar@gmail.com, atelier.optica.cerro@gmail.com';
    const adminHtml = getAdminHtml(customer, order.id, emailTotal, shippingMethodLabel, isTransfer, itemsHtml);

    // Si eligió transferencia bancaria, enviar email al cliente con instrucciones y devolver exito
    if (isTransfer) {
      // 4a. Enviar email base de nueva compra
      sendEmail({
        to: customer.email,
        subject: `Confirmación de Orden #${order.id} - Atelier Óptica`,
        html: confirmationHtml
      }).catch(err => console.error("Error confirmation email:", err));

      sendEmail({
        to: adminEmails,
        subject: `🛒 Nueva Compra Web - $${emailTotal.toLocaleString('es-AR')} - ${customer.firstName} ${customer.lastName}`,
        html: adminHtml
      }).catch(err => console.error("Error admin email:", err));
       const clientTransferHtml = getClientTransferHtml(customer, order.id, emailTotal);

       sendEmail({
         to: customer.email,
         subject: `🛒 Instrucciones de Pago - Pedido #${order.id.slice(-4).toUpperCase()} - Atelier Óptica`,
         html: clientTransferHtml
       }).catch(err => console.error("Error client transfer email:", err));

        return NextResponse.json({ 
          success: true, 
          message: "Orden de transferencia generada",
          orderId: order.id
        });
    }

    // Si es un pedido mayorista, enviar email especial y finalizar sin cargo
    if (customer.paymentMethod === 'MAYORISTA') {
      sendEmail({
        to: customer.email,
        subject: `Confirmación de Pedido Mayorista #${order.id.slice(-4).toUpperCase()} - Atelier Óptica`,
        html: getClientWholesaleHtml(customer, order.id, emailTotal)
      }).catch(err => console.error("Error client wholesale email:", err));

      const adminWholesaleHtml = getAdminWholesaleHtml(customer, order.id, emailTotal, shippingMethodLabel, itemsHtml);

      sendEmail({
        to: adminEmails,
        subject: `💼 Compra Mayorista Web - $${emailTotal.toLocaleString('es-AR')} - ${customer.firstName} ${customer.lastName}`,
        html: adminWholesaleHtml
      }).catch(err => console.error("Error admin wholesale email:", err));

      return NextResponse.json({ 
        success: true, 
        message: "Pedido mayorista registrado",
        orderId: order.id
      });
    }

    // PAYWAY: Ejecutar el pago real
    const paymentToken = body.paymentToken;
    const bin = body.bin;
    const deviceUniqueIdentifier = body.deviceUniqueIdentifier;
    
    if (!paymentToken || !bin) {
      if (globalRestoreStock) await globalRestoreStock();
      throw new Error("Token de pago o BIN no proporcionado.");
    }

    let paymentMethodId = body.paymentMethodId ? parseInt(body.paymentMethodId, 10) : null;
    if (!paymentMethodId || isNaN(paymentMethodId)) {
      paymentMethodId = 1; // Default Visa
      if (bin.startsWith("58")) paymentMethodId = 63; // Cabal
      else if (bin.startsWith("5") || bin.startsWith("2")) paymentMethodId = 15; // Mastercard
      else if (bin.startsWith("34") || bin.startsWith("37")) paymentMethodId = 39; // Amex
    }

    const privateKey = process.env.PAYWAY_PRIVATE_KEY;
    const isProd = process.env.PAYWAY_ENVIRONMENT === 'production';
    
    const apiUrl = isProd 
      ? 'https://live.decidir.com/api/v2/payments'
      : 'https://developers.decidir.com/api/v2/payments';

    // PayWay/Decidir API requires amount in CENTS (integer, multiply by 100)
    const amountInCents = Math.round(total * 100);

    const paywayRequest = {
      site_transaction_id: `WEB-${order.id}`,
      token: paymentToken,
      payment_method_id: paymentMethodId,
      bin: bin,
      amount: amountInCents,
      currency: "ARS",
      installments: parseInt(customer.installments || "1", 10),
      description: "Compra Atelier Óptica Web",
      payment_type: "single",
      sub_payments: [],
      fraud_detection: {
        send_to_cs: true,
        channel: "Web",
        bill_to: {
          city: customer.city || "N/A",
          country: "AR",
          customer_id: client.id,
          email: customer.email,
          first_name: customer.firstName,
          last_name: customer.lastName,
          phone_number: customer.phone?.replace(/\D/g, '') || "",
          postal_code: customer.zip || "0000",
          state: getArgentineStateCode(customer.state),
          street1: customer.address || "N/A"
        },
        purchase_totals: {
          currency: "ARS",
          amount: amountInCents
        },
        customer: {
          id: client.id,
          email: customer.email
        },
        device_unique_identifier: deviceUniqueIdentifier || `WEB-${order.id}`,
        retail_transaction_data: {
          ship_to: {
            city: customer.city || "N/A",
            country: "AR",
            email: customer.email,
            first_name: customer.firstName,
            last_name: customer.lastName,
            phone_number: customer.phone?.replace(/\D/g, '') || "",
            postal_code: customer.zip || "0000",
            state: getArgentineStateCode(customer.state),
            street1: customer.address || "N/A"
          },
          items: sanitizedItems.map(item => ({
            code: item.productId || 'generic',
            name: item.model || 'Producto',
            qty: item.quantity,
            price: Math.round(item.price * 100)
          }))
        }
      }
    };

    console.log("[PAYWAY CHECKOUT] Request payload:", JSON.stringify({ ...paywayRequest, token: '***REDACTED***' }));

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
      
      // Restore reserved stock on payment failure
      if (globalRestoreStock) await globalRestoreStock();

      let errorMessage = "Contactá al emisor de tu tarjeta o reintentá.";
      if (paywayData.status_details?.error?.reason?.description) {
        errorMessage = paywayData.status_details.error.reason.description;
      } else if (paywayData.validation_errors && paywayData.validation_errors.length > 0) {
        errorMessage = `Error de validación: ${paywayData.validation_errors.map((e: any) => `${e.param || 'parámetro'} (${e.code || 'código'})`).join(', ')}`;
      } else if (paywayData.message) {
        errorMessage = paywayData.message;
      } else if (paywayData.error_type) {
        errorMessage = `Error: ${paywayData.error_type}`;
      }

      // Actualizar orden a fallida/rechazada
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "CANCELED", labNotes: `[PAGO RECHAZADO PAYWAY]: ${errorMessage}\n\n` + order.labNotes }
      });

      return NextResponse.json(
        { error: `Pago rechazado: ${errorMessage}` },
        { status: 400 }
      );
    }

    // PAGO APROBADO
    console.log("[PAYWAY APPROVED] Transacción exitosa:", paywayData.id);

    // Wrap approved card payments in a Prisma transaction
    await prisma.$transaction(async (tx) => {
      // 1. Update order status and paid amount
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "PAID",
          paid: total
        }
      });

      // 2. Create the payment record
      await tx.payment.create({
        data: {
          orderId: order.id,
          amount: total,
          method: "TARJETA",
          notes: `Pago aprobado por Payway. Transacción ID: ${paywayData.id}`
        }
      });

      // 3. Create the notification request
      await tx.notification.create({
        data: {
          type: "INVOICE_REQUEST",
          message: `Factura solicitada automáticamente para la Venta #${order.id.slice(-4).toUpperCase()} por un total de $${total.toLocaleString('es-AR')}`,
          orderId: order.id,
          requestedBy: "Sistema (Payway)",
          status: "PENDING"
        }
      });
    });

    try {
      const updatedOrder = await prisma.order.findUnique({
        where: { id: order.id },
        include: { client: true, payments: true }
      });
      const paymentRecord = updatedOrder?.payments?.[updatedOrder.payments.length - 1];

      if (updatedOrder && paymentRecord) {
        const pdfData = await generateReceiptPDF(paymentRecord, updatedOrder, updatedOrder.client);
        
        const attachments = [{
          filename: pdfData.filename,
          content: pdfData.base64.split('base64,')[1] || pdfData.base64,
          encoding: 'base64'
        }];

        // Enviar a cliente
        await sendEmail({
          to: customer.email,
          subject: `Confirmación de Orden #${order.id} - Atelier Óptica`,
          html: confirmationHtml,
          attachments
        });

        // Adjuntar PDF también al admin re-enviando un update o usando un mail nuevo
        await sendEmail({
          to: adminEmails,
          subject: `🛒 Nueva Compra Web - $${emailTotal.toLocaleString('es-AR')} - ${customer.firstName} ${customer.lastName}`,
          html: adminHtml,
          attachments
        });
      }
    } catch (pdfErr) {
      console.error("Error generando/enviando PDF de Payway:", pdfErr);
    }

    return NextResponse.json({ 
      success: true, 
      transactionId: paywayData.id,
      message: "Pago procesado con éxito",
      orderId: order.id
    });

  } catch (error: any) {
    console.error("[PAYWAY API ERROR]", error);
    // Asegurarse de liberar stock si ocurre CUALQUIER error en la función
    if (globalRestoreStock) {
      await globalRestoreStock();
    }
    return NextResponse.json(
      { error: error?.message || 'Error procesando solicitud de pago o creando la ficha' },
      { status: 500 }
    );
  }
}
