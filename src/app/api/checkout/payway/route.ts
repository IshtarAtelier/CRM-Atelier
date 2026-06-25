import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { WHATSAPP_PHONE } from '@/lib/constants';
import { ContactService, normalizeArgentinePhone } from '@/services/contact.service';
import { getWebSettings } from '@/lib/web-settings';
import { CrystalMapping } from '@/lib/config/crystal-mapping';
import { generateReceiptPDF } from '@/lib/receipt-pdf-generator';

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

      const framePrice = isWholesaleUser && dbProduct.wholesalePrice > 0 ? dbProduct.wholesalePrice : dbProduct.price;
      let calculatedPrice = framePrice;
      const isCustomLens = item.lensConfig && (item.lensConfig.lensType !== "NONE" || item.lensConfig.color);

      if (isCustomLens) {
        const { lensType, treatment, color } = item.lensConfig;
        if (color) {
          // SUN FLOW
          if (lensType === "NONE" || lensType === "MONOFOCAL") calculatedPrice += (PRICING.MONOFOCAL.ORGANICO_BLANCO || 0);
          else if (lensType === "BIFOCAL") calculatedPrice += (PRICING.BIFOCAL.ORGANICO_BLANCO || 0);
          else if (lensType === "MULTIFOCAL") calculatedPrice += (PRICING.MULTIFOCAL.SMART_FREE || 0);
          
          if (lensType !== null && lensType !== "NONE") {
            calculatedPrice += PRICING.EXTRAS.TINT;
          }
        } else {
          // CLEAR FLOW
          if (lensType === "MONOFOCAL") {
            const txPrice = treatment ? PRICING.MONOFOCAL[treatment as keyof typeof PRICING.MONOFOCAL] : undefined;
            if (txPrice === undefined) throw new Error("Tratamiento monofocal inválido o faltante.");
            calculatedPrice += txPrice;
          }
          else if (lensType === "BIFOCAL") {
            calculatedPrice += PRICING.BIFOCAL.ORGANICO_BLANCO;
          }
          else if (lensType === "MULTIFOCAL") {
            const txPrice = treatment ? PRICING.MULTIFOCAL[treatment as keyof typeof PRICING.MULTIFOCAL] : undefined;
            if (txPrice === undefined) throw new Error("Tratamiento multifocal inválido o faltante.");
            calculatedPrice += txPrice;
          }
        }
      }

      recalculatedItemsTotal += calculatedPrice * item.quantity;

      sanitizedItems.push({
        ...item,
        productId: safeProductId,
        price: calculatedPrice
      });
    }

    if (Math.abs(recalculatedItemsTotal - total) > 5) {
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

    const confirmationHtml = `
      <div style="font-family: 'Inter', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #e5e5e5;">
        <h1 style="font-size: 32px; text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px;">ATELIER ÓPTICA</h1>
        <h2 style="font-size: 18px; font-weight: normal; margin-top: 30px;">Hola ${customer.firstName},</h2>
        <p>Gracias por elegir a Atelier Óptica. Hemos recibido tu pedido con el número de orden <strong>#${order.id}</strong>.</p>
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
          WhatsApp: <a href="https://wa.me/${whatsappPhone}">${whatsappPhone}</a>
        </p>
      </div>
    `;

    const adminEmails = 'pisano.ishtar@gmail.com, atelier.optica.cerro@gmail.com';
    const adminHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd;">
        <h2 style="color: #333; border-bottom: 2px solid #000; padding-bottom: 10px;">🚨 NUEVA VENTA WEB 🚨</h2>
        <p><strong>Orden ID:</strong> #${order.id}</p>
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
       const clientTransferHtml = `
         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
           <h2 style="color: #4caf50;">¡Hola ${customer.firstName}!</h2>
           <p>Hemos registrado tu pedido <strong>#${order.id.slice(-4).toUpperCase()}</strong> de forma exitosa.</p>
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
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h2 style="color: #1e3a8a; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-top: 0;">¡Hola ${customer.firstName}!</h2>
            <p>Hemos registrado tu pedido mayorista <strong>#${order.id.slice(-4).toUpperCase()}</strong> de forma exitosa.</p>
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
        `
      }).catch(err => console.error("Error client wholesale email:", err));

      const adminWholesaleHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd;">
          <h2 style="color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-top: 0;">💼 NUEVO PEDIDO MAYORISTA WEB 💼</h2>
          <p><strong>Orden ID:</strong> #${order.id}</p>
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
    
    if (!paymentToken || !bin) {
      if (globalRestoreStock) await globalRestoreStock();
      throw new Error("Token de pago o BIN no proporcionado.");
    }

    let paymentMethodId = 1; // Default Visa
    if (bin.startsWith("58")) paymentMethodId = 63; // Cabal
    else if (bin.startsWith("5") || bin.startsWith("2")) paymentMethodId = 15; // Mastercard
    else if (bin.startsWith("34") || bin.startsWith("37")) paymentMethodId = 39; // Amex

    const privateKey = process.env.PAYWAY_PRIVATE_KEY;
    const isProd = process.env.PAYWAY_ENVIRONMENT === 'production';
    
    const apiUrl = isProd 
      ? 'https://live.decidir.com/api/v2/payments'
      : 'https://developers.decidir.com/api/v2/payments';

    const paywayRequest = {
      site_transaction_id: `WEB-${order.id}`,
      token: paymentToken,
      payment_method_id: paymentMethodId,
      bin: bin,
      amount: total,
      currency: "ARS",
      installments: parseInt(customer.installments || "1", 10),
      description: "Compra Atelier Óptica Web",
      payment_type: "single"
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
      
      // Restore reserved stock on payment failure
      if (globalRestoreStock) await globalRestoreStock();

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
