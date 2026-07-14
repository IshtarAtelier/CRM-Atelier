import { prisma } from '@/lib/db';
import { PricingService } from '@/services/PricingService';
import { resolveMonthlyTargets } from '@/lib/targets';

// ═══════════════════════════════════════════════════
// Tipos
// ═══════════════════════════════════════════════════

export interface CopilotTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>, context: ToolContext) => Promise<string>;
}

interface ToolContext {
  userId: string;
  userRole: string;
  userName: string;
}

// ═══════════════════════════════════════════════════
// STAFF TOOLS (Vendedores + Admin)
// ═══════════════════════════════════════════════════

const lookupClient: CopilotTool = {
  name: 'lookup_client',
  description: 'Busca un cliente/contacto por nombre o teléfono. Devuelve datos básicos: nombre, teléfono, estado, doctor, obra social, tags.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Nombre, teléfono o email del cliente a buscar' },
    },
    required: ['query'],
  },
  execute: async (args) => {
    const q = (args.query as string).toLowerCase();
    const clients = await prisma.client.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true, name: true, phone: true, email: true, status: true,
        doctor: true, insurance: true, interest: true, contactSource: true,
        tags: { select: { name: true } },
      },
      take: 5,
      orderBy: { updatedAt: 'desc' },
    });
    if (!clients.length) return 'No se encontró ningún cliente con ese criterio.';
    return JSON.stringify(clients.map(c => ({
      id: c.id, nombre: c.name, telefono: c.phone, email: c.email,
      estado: c.status, doctor: c.doctor, obraSocial: c.insurance,
      interes: c.interest, origen: c.contactSource,
      tags: c.tags.map(t => t.name),
    })));
  },
};

const getClientBalance: CopilotTool = {
  name: 'get_client_balance',
  description: 'Obtiene el saldo pendiente (deuda) de un cliente específico. Necesita el clientId.',
  parameters: {
    type: 'object',
    properties: {
      clientId: { type: 'string', description: 'ID del cliente' },
    },
    required: ['clientId'],
  },
  execute: async (args) => {
    const client = await prisma.client.findUnique({
      where: { id: args.clientId as string },
      select: {
        name: true,
        orders: {
          where: { isDeleted: false },
          select: {
            orderType: true, total: true, subtotalWithMarkup: true, paid: true,
            discountCash: true, discountTransfer: true,
            payments: { select: { amount: true, method: true } },
          },
        },
      },
    });
    if (!client) return 'Cliente no encontrado.';

    let totalSales = 0;
    let totalPaid = 0;
    let totalBalance = 0;
    for (const order of client.orders) {
      if (order.orderType === 'SALE') {
        const financials = PricingService.calculateOrderFinancials(order);
        totalSales += financials.totalCash;
        totalPaid += financials.paidReal;
        totalBalance += financials.remainingCash;
      }
    }
    return `${client.name}: Saldo pendiente $${Math.round(totalBalance).toLocaleString('es-AR')}. Total vendido (Efectivo): $${Math.round(totalSales).toLocaleString('es-AR')}. Total pagado: $${Math.round(totalPaid).toLocaleString('es-AR')}.`;
  },
};

const getOrderStatus: CopilotTool = {
  name: 'get_order_status',
  description: 'Consulta el estado de un pedido/venta. Puede buscar por nombre de cliente o por ID de orden (últimos 6 caracteres).',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Nombre del cliente o ID parcial del pedido' },
    },
    required: ['query'],
  },
  execute: async (args) => {
    const q = (args.query as string).trim();
    const orders = await prisma.order.findMany({
      where: {
        isDeleted: false,
        orderType: 'SALE',
        OR: [
          { id: { endsWith: q } },
          { client: { name: { contains: q, mode: 'insensitive' } } },
        ],
      },
      select: {
        id: true, status: true, labStatus: true, total: true, paid: true,
        discountCash: true, discountTransfer: true, subtotalWithMarkup: true,
        payments: { select: { amount: true, method: true } },
        labOrderNumber: true, createdAt: true,
        client: { select: { name: true } },
        items: { select: { productNameSnapshot: true, productBrandSnapshot: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });
    if (!orders.length) return 'No se encontraron pedidos con ese criterio.';
    return JSON.stringify(orders.map(o => {
      const financials = PricingService.calculateOrderFinancials(o);
      return {
        id: o.id.slice(-6), cliente: o.client.name,
        estado: o.status, estadoLab: o.labStatus,
        nroLab: o.labOrderNumber,
        total: financials.totalCash, pagado: financials.paidReal,
        saldoPendiente: financials.remainingCash,
        fecha: o.createdAt.toISOString().split('T')[0],
        productos: o.items.map(i => `${i.productBrandSnapshot || ''} ${i.productNameSnapshot || ''}`.trim()),
      };
    }));
  },
};

const getProductStock: CopilotTool = {
  name: 'get_product_stock',
  description: 'Consulta el stock disponible y precio de un producto por nombre o marca.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Nombre, marca o modelo del producto' },
    },
    required: ['query'],
  },
  execute: async (args) => {
    const q = (args.query as string).toLowerCase();
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { brand: { contains: q, mode: 'insensitive' } },
          { model: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, brand: true, type: true, stock: true, price: true },
      take: 8,
      orderBy: { updatedAt: 'desc' },
    });
    if (!products.length) return 'No se encontraron productos con ese criterio.';
    return JSON.stringify(products.map(p => ({
      nombre: `${p.brand || ''} ${p.name || ''}`.trim(),
      tipo: p.type, stock: p.stock,
      precio: `$${p.price.toLocaleString('es-AR')}`,
    })));
  },
};

const getPriceList: CopilotTool = {
  name: 'get_price_list',
  description: 'Obtiene precios del catálogo. Filtra opcionalmente por categoría (MULTIFOCAL, MONOFOCAL, CONTACTO, ARMAZON).',
  parameters: {
    type: 'object',
    properties: {
      category: { type: 'string', description: 'Categoría del producto (opcional)' },
    },
  },
  execute: async (args) => {
    const where: Record<string, unknown> = {};
    if (args.category) where.type = { contains: args.category as string, mode: 'insensitive' };
    const products = await prisma.product.findMany({
      where, select: { name: true, brand: true, type: true, price: true, stock: true },
      take: 15, orderBy: { price: 'asc' },
    });
    if (!products.length) return 'No se encontraron productos con esa categoría.';
    return JSON.stringify(products.map(p => ({
      nombre: `${p.brand || ''} ${p.name || ''}`.trim(),
      tipo: p.type, precio: p.price, stock: p.stock,
    })));
  },
};

const getMySalesToday: CopilotTool = {
  name: 'get_my_sales_today',
  description: 'Muestra cuánto vendió el vendedor actual hoy y esta semana.',
  parameters: { type: 'object', properties: {} },
  execute: async (_args, ctx) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const [todaySales, weekSales] = await Promise.all([
      prisma.order.findMany({
        where: { userId: ctx.userId, orderType: 'SALE', isDeleted: false, createdAt: { gte: todayStart } },
        select: { total: true },
      }),
      prisma.order.findMany({
        where: { userId: ctx.userId, orderType: 'SALE', isDeleted: false, createdAt: { gte: weekStart } },
        select: { total: true },
      }),
    ]);

    const todayTotal = todaySales.reduce((s, o) => s + (o.total || 0), 0);
    const weekTotal = weekSales.reduce((s, o) => s + (o.total || 0), 0);
    return `${ctx.userName}: Hoy vendiste $${todayTotal.toLocaleString('es-AR')} (${todaySales.length} ventas). Esta semana: $${weekTotal.toLocaleString('es-AR')} (${weekSales.length} ventas).`;
  },
};

const getLabStatus: CopilotTool = {
  name: 'get_lab_status',
  description: 'Consulta el estado de laboratorio de los pedidos de un cliente.',
  parameters: {
    type: 'object',
    properties: {
      clientName: { type: 'string', description: 'Nombre del cliente' },
    },
    required: ['clientName'],
  },
  execute: async (args) => {
    const orders = await prisma.order.findMany({
      where: {
        isDeleted: false, orderType: 'SALE',
        labStatus: { not: 'NONE' },
        client: { name: { contains: args.clientName as string, mode: 'insensitive' } },
      },
      select: {
        id: true, labStatus: true, labOrderNumber: true, labSentAt: true, labNotes: true,
        client: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });
    if (!orders.length) return 'No se encontraron pedidos en laboratorio para ese cliente.';
    return JSON.stringify(orders.map(o => ({
      id: o.id.slice(-6), cliente: o.client.name,
      estadoLab: o.labStatus, nroOrden: o.labOrderNumber,
      fechaEnvio: o.labSentAt?.toISOString().split('T')[0] || null,
      notas: o.labNotes,
    })));
  },
};

const updateLabOrder: CopilotTool = {
  name: 'update_lab_order',
  description: 'Actualiza el estado de laboratorio o el número de operación de un pedido. Útil cuando te piden "pasá el pedido a listo para retirar" o "cargale el número de operación 1234". Estados válidos: NONE (Pendiente), SENT (Falta procesar), IN_PROGRESS (Procesado), READY (Listo para retirar), DELIVERED (Entregado).',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Nombre del cliente o últimos 6 caracteres del ID del pedido' },
      newStatus: { type: 'string', description: 'El nuevo estado (NONE, SENT, IN_PROGRESS, READY, DELIVERED) - Opcional' },
      labOrderNumber: { type: 'string', description: 'El número de operación de laboratorio - Opcional' },
    },
    required: ['query'],
  },
  execute: async (args) => {
    const q = (args.query as string).trim();
    const newStatus = args.newStatus as string | undefined;
    const labOrderNumber = args.labOrderNumber as string | undefined;
    
    if (!newStatus && !labOrderNumber) {
        return 'Debes proveer al menos un nuevo estado o un número de operación para actualizar.';
    }

    if (newStatus && !['NONE', 'SENT', 'IN_PROGRESS', 'READY', 'DELIVERED'].includes(newStatus)) {
        return 'Estado inválido. Debe ser NONE, SENT, IN_PROGRESS, READY o DELIVERED.';
    }

    const order = await prisma.order.findFirst({
      where: {
        isDeleted: false,
        OR: [
          { id: { endsWith: q } },
          { client: { name: { contains: q, mode: 'insensitive' } } },
        ],
      },
      include: { client: true, payments: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!order) return 'No se encontró ningún pedido reciente que coincida con esa búsqueda.';

    const dataToUpdate: any = {};
    let willChangeStatus = false;

    if (labOrderNumber) {
        dataToUpdate.labOrderNumber = labOrderNumber;
        // Auto-advance to IN_PROGRESS (Procesado) if it's currently NONE or SENT
        if (!newStatus && (!order.labStatus || order.labStatus === 'NONE' || order.labStatus === 'SENT')) {
            dataToUpdate.labStatus = 'IN_PROGRESS';
            if (!order.labSentAt) {
                dataToUpdate.labSentAt = new Date();
            }
            willChangeStatus = true;
        }
    }

    let finalStatus = order.labStatus;
    if (newStatus && order.labStatus !== newStatus) {
        dataToUpdate.labStatus = newStatus;
        if ((newStatus === 'SENT' || newStatus === 'IN_PROGRESS') && !order.labSentAt) {
            dataToUpdate.labSentAt = new Date();
        }
        willChangeStatus = true;
        finalStatus = newStatus;
    } else if (dataToUpdate.labStatus) {
        finalStatus = dataToUpdate.labStatus;
    }

    if (Object.keys(dataToUpdate).length === 0) {
        return `El pedido de ${order.client.name} ya tenía esos datos. No se hicieron cambios.`;
    }

    await prisma.order.update({
        where: { id: order.id },
        data: dataToUpdate
    });

    let sideEffectMsg = '';
    
    if (willChangeStatus && finalStatus === 'READY' && order.client.phone) {
        try {
            const { BotService } = await import('@/services/bot.service');
            const sent = await BotService.notifyOrderReady(order as any);
            if (sent) {
                sideEffectMsg = '\n(Se le envió automáticamente un WhatsApp al cliente avisándole del retiro y su saldo)';
            } else {
                sideEffectMsg = '\n⚠️ No se pudo enviar el WhatsApp automático (el cliente puede no tener teléfono válido o el servidor WA no respondió). Envialo manualmente desde Pedidos.';
            }
        } catch (e: any) {
            console.error('Error auto-notifying from Copilot tool:', e);
            sideEffectMsg = `\n⚠️ Error al enviar WhatsApp automático: ${e.message || 'Error desconocido'}. Envialo manualmente desde Pedidos.`;
        }
    }

    if (willChangeStatus && finalStatus === 'DELIVERED') {
        // Auto-complete order when lab marks as delivered
        await prisma.order.update({
            where: { id: order.id },
            data: { status: 'COMPLETED' }
        });
        try {
            const { ContactService } = await import('@/services/contact.service');
            const taskDesc = `Solicitar comentario a ${order.client.name}`;
            await ContactService.addReviewRequest(order.clientId, taskDesc);
            sideEffectMsg = '\n(Se generó la solicitud automática de reseña y se marcó como completado)';
        } catch (e) {
            console.error('Error creating task from Copilot tool:', e);
        }
    }

    let responseMsg = `Pedido de ${order.client.name} actualizado exitosamente.`;
    if (labOrderNumber) responseMsg += ` Se asignó el N° de operación: ${labOrderNumber}.`;
    if (willChangeStatus) responseMsg += ` El estado pasó a: ${finalStatus}.`;
    
    return responseMsg + sideEffectMsg;
  },
};

const getClientPrescriptions: CopilotTool = {
  name: 'get_client_prescriptions',
  description: 'Obtiene las recetas (graduaciones médicas) asociadas a un cliente específico. Necesita el clientId.',
  parameters: {
    type: 'object',
    properties: {
      clientId: { type: 'string', description: 'ID del cliente' },
    },
    required: ['clientId'],
  },
  execute: async (args) => {
    const prescriptions = await prisma.prescription.findMany({
      where: { clientId: args.clientId as string },
      orderBy: { date: 'desc' },
      take: 5,
    });
    if (!prescriptions.length) return 'No se encontraron recetas para este cliente.';
    
    return JSON.stringify(prescriptions.map(p => {
      const parts = [];
      if (p.sphereOD !== null || p.cylinderOD !== null || p.axisOD !== null) {
        parts.push(`Lejos OD: Esf ${p.sphereOD || 0}, Cil ${p.cylinderOD || 0}, Eje ${p.axisOD || 0}°`);
      }
      if (p.sphereOI !== null || p.cylinderOI !== null || p.axisOI !== null) {
        parts.push(`Lejos OI: Esf ${p.sphereOI || 0}, Cil ${p.cylinderOI || 0}, Eje ${p.axisOI || 0}°`);
      }
      if (p.nearSphereOD !== null || p.nearCylinderOD !== null || p.nearAxisOD !== null) {
        parts.push(`Cerca OD: Esf ${p.nearSphereOD || 0}, Cil ${p.nearCylinderOD || 0}, Eje ${p.nearAxisOD || 0}°`);
      }
      if (p.nearSphereOI !== null || p.nearCylinderOI !== null || p.nearAxisOI !== null) {
        parts.push(`Cerca OI: Esf ${p.nearSphereOI || 0}, Cil ${p.nearCylinderOI || 0}, Eje ${p.nearAxisOI || 0}°`);
      }
      if (p.addition !== null || p.additionOD !== null || p.additionOI !== null) {
        parts.push(`Adición: General ${p.addition || 'N/A'}, OD ${p.additionOD || 'N/A'}, OI ${p.additionOI || 'N/A'}`);
      }
      if (p.pd !== null || p.distanceOD !== null || p.distanceOI !== null) {
        parts.push(`DIP: General ${p.pd || 'N/A'}, OD ${p.distanceOD || 'N/A'}, OI ${p.distanceOI || 'N/A'}`);
      }
      return {
        id: p.id,
        fecha: p.date.toISOString().split('T')[0],
        tipo: p.prescriptionType,
        graduacion: parts.join(' | '),
        notas: p.notes,
        imagenUrl: p.imageUrl,
      };
    }));
  },
};

const updateClientInfo: CopilotTool = {
  name: 'update_client_info',
  description: 'Actualiza los datos personales, de contacto u obra social de un cliente. Necesita clientId.',
  parameters: {
    type: 'object',
    properties: {
      clientId: { type: 'string', description: 'ID del cliente' },
      dni: { type: 'string', description: 'DNI del cliente (opcional)' },
      insurance: { type: 'string', description: 'Obra social / Prepaga (opcional)' },
      doctor: { type: 'string', description: 'Oftalmólogo / Doctor de cabecera (opcional)' },
      phone: { type: 'string', description: 'Número de teléfono (opcional)' },
      email: { type: 'string', description: 'Dirección de correo electrónico (opcional)' },
      address: { type: 'string', description: 'Dirección física / Domicilio (opcional)' },
      interest: { type: 'string', description: 'Interés del cliente, ej: Multifocal, Monofocal, Contacto (opcional)' },
      status: { type: 'string', description: 'Estado del cliente, ej: LEAD, CONTACT, CUSTOMER, CONFIRMED (opcional)' },
    },
    required: ['clientId'],
  },
  execute: async (args) => {
    const { clientId, ...data } = args;
    
    const updateData: Record<string, any> = {};
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined && val !== null && val !== '') {
        updateData[key] = val;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return 'No se especificaron datos para actualizar.';
    }

    const updated = await prisma.client.update({
      where: { id: clientId as string },
      data: updateData,
      select: { name: true, phone: true, email: true, dni: true, insurance: true, doctor: true },
    });

    return `Datos de ${updated.name} actualizados exitosamente: ` + JSON.stringify(updated);
  },
};

const createClientTask: CopilotTool = {
  name: 'create_client_task',
  description: 'Crea una tarea de seguimiento para un cliente específico (ej. reclamar saldo, consultar si está conforme, llamar para coordinar).',
  parameters: {
    type: 'object',
    properties: {
      clientId: { type: 'string', description: 'ID del cliente' },
      description: { type: 'string', description: 'Descripción de la tarea a realizar' },
      dueDate: { type: 'string', description: 'Fecha de vencimiento en formato AAAA-MM-DD (opcional)' },
    },
    required: ['clientId', 'description'],
  },
  execute: async (args, ctx) => {
    const due = args.dueDate ? new Date(args.dueDate as string) : null;
    const task = await prisma.clientTask.create({
      data: {
        clientId: args.clientId as string,
        description: args.description as string,
        dueDate: due,
        createdBy: ctx.userName || 'Copilot',
        status: 'PENDING',
        type: 'TASK',
      },
      include: { client: { select: { name: true } } },
    });
    return `Tarea creada con éxito para ${task.client.name}: "${task.description}" (Vence: ${task.dueDate ? task.dueDate.toISOString().split('T')[0] : 'Sin fecha límite'}).`;
  },
};

const getClientTasks: CopilotTool = {
  name: 'get_client_tasks',
  description: 'Obtiene las tareas pendientes o de revisión asociadas a un cliente específico. Necesita clientId.',
  parameters: {
    type: 'object',
    properties: {
      clientId: { type: 'string', description: 'ID del cliente' },
      status: { type: 'string', description: 'Estado de la tarea (PENDING, COMPLETED, ALL). Por defecto es PENDING.' },
    },
    required: ['clientId'],
  },
  execute: async (args) => {
    const statusFilter = (args.status as string || 'PENDING').toUpperCase();
    const whereClause: Record<string, any> = { clientId: args.clientId as string };
    if (statusFilter !== 'ALL') {
      whereClause.status = statusFilter;
    }
    const tasks = await prisma.clientTask.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    if (!tasks.length) return 'No se encontraron tareas con ese criterio.';
    return JSON.stringify(tasks.map(t => ({
      id: t.id,
      descripcion: t.description,
      estado: t.status,
      tipo: t.type,
      vencimiento: t.dueDate ? t.dueDate.toISOString().split('T')[0] : 'Sin fecha límite',
      creadaPor: t.createdBy,
      fechaCreacion: t.createdAt.toISOString().split('T')[0],
    })));
  },
};

const completeClientTask: CopilotTool = {
  name: 'complete_client_task',
  description: 'Marca una tarea específica de un cliente como completada. Necesita el taskId.',
  parameters: {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: 'ID de la tarea a completar' },
    },
    required: ['taskId'],
  },
  execute: async (args) => {
    const updated = await prisma.clientTask.update({
      where: { id: args.taskId as string },
      data: { status: 'COMPLETED' },
      include: { client: { select: { name: true } } },
    });
    return `Tarea "${updated.description}" de ${updated.client.name} marcada como COMPLETADA.`;
  },
};

const addClientInteraction: CopilotTool = {
  name: 'add_client_interaction',
  description: 'Agrega una nota, registro de llamada o visita al local en el historial de un cliente.',
  parameters: {
    type: 'object',
    properties: {
      clientId: { type: 'string', description: 'ID del cliente' },
      type: { type: 'string', description: 'Tipo de interacción (NOTE, CALL, STORE_VISIT, WHATSAPP, EMAIL). Por defecto es NOTE.' },
      content: { type: 'string', description: 'El contenido o detalles de la nota/interacción' },
    },
    required: ['clientId', 'content'],
  },
  execute: async (args) => {
    const type = (args.type as string || 'NOTE').toUpperCase();
    const interaction = await prisma.interaction.create({
      data: {
        clientId: args.clientId as string,
        type,
        content: args.content as string,
      },
      include: { client: { select: { name: true } } },
    });
    return `Interacción tipo ${interaction.type} agregada al cliente ${interaction.client.name}: "${interaction.content}".`;
  },
};

const getClientHistory: CopilotTool = {
  name: 'get_client_history',
  description: 'Obtiene el historial de compras y presupuestos (cotizaciones) de un cliente específico. Necesita clientId.',
  parameters: {
    type: 'object',
    properties: {
      clientId: { type: 'string', description: 'ID del cliente' },
    },
    required: ['clientId'],
  },
  execute: async (args) => {
    const orders = await prisma.order.findMany({
      where: { clientId: args.clientId as string, isDeleted: false },
      select: {
        id: true,
        orderType: true,
        status: true,
        total: true,
        paid: true,
        createdAt: true,
        items: {
          select: {
            productNameSnapshot: true,
            productBrandSnapshot: true,
            productCategorySnapshot: true,
            quantity: true,
            price: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    if (!orders.length) return 'No hay historial de compras o presupuestos para este cliente.';
    return JSON.stringify(orders.map(o => ({
      id: o.id.slice(-6),
      tipo: o.orderType === 'SALE' ? 'COMPRA' : 'PRESUPUESTO',
      estado: o.status,
      total: `$${o.total.toLocaleString('es-AR')}`,
      pagado: `$${o.paid.toLocaleString('es-AR')}`,
      saldo: `$${Math.max(0, o.total - o.paid).toLocaleString('es-AR')}`,
      fecha: o.createdAt.toISOString().split('T')[0],
      items: o.items.map(i => `${i.quantity}x ${i.productBrandSnapshot || ''} ${i.productNameSnapshot || ''} (${i.productCategorySnapshot || ''}) - $${i.price.toLocaleString('es-AR')}`),
    })));
  },
};

const getSalesVsTarget: CopilotTool = {
  name: 'get_sales_vs_target',
  description: 'Compara el total facturado y cobrado del mes en curso contra los objetivos mensuales (MonthlyTarget) configurados en el sistema.',
  parameters: {
    type: 'object',
    properties: {
      month: { type: 'number', description: 'Mes a consultar (1-12). Por defecto es el mes actual.' },
      year: { type: 'number', description: 'Año a consultar. Por defecto es el año actual.' },
    },
  },
  execute: async (args) => {
    const now = new Date();
    const month = (args.month as number) || now.getMonth() + 1;
    const year = (args.year as number) || now.getFullYear();
    
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0, 23, 59, 59, 999);

    const orders = await prisma.order.findMany({
      where: { orderType: 'SALE', isDeleted: false, createdAt: { gte: from, lte: to } },
      select: {
        total: true,
        paid: true,
        subtotalWithMarkup: true,
        payments: { select: { amount: true } },
      },
    });

    let totalSold = 0;
    let totalPaid = 0;
    for (const o of orders) {
      totalSold += o.subtotalWithMarkup || o.total || 0;
      for (const p of o.payments) {
        totalPaid += p.amount || 0;
      }
    }

    // Objetivos configurados en USD, resueltos a ARS con el blue del día.
    const target = await resolveMonthlyTargets(month, year);

    const monthNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    const monthStr = monthNames[month - 1];

    const goal1 = target.target1 || 0;
    const goal2 = target.target2 || 0;
    const goal3 = target.target3 || 0;

    const progressSoldPercent1 = goal1 > 0 ? ((totalSold / goal1) * 100).toFixed(1) : '0';
    const progressSoldPercent2 = goal2 > 0 ? ((totalSold / goal2) * 100).toFixed(1) : '0';
    const progressSoldPercent3 = goal3 > 0 ? ((totalSold / goal3) * 100).toFixed(1) : '0';

    let msg = `Progreso de Objetivos para ${monthStr} ${year}:\n`;
    msg += `- Facturado actual: $${totalSold.toLocaleString('es-AR')}\n`;
    msg += `- Cobrado actual: $${totalPaid.toLocaleString('es-AR')}\n\n`;
    msg += `🎯 **Metas Mensuales (Base en Facturación):**\n`;
    if (target.currency === 'USD' && target.usd1 && target.rate) {
      msg += `_(Configuradas en USD: ${target.usd1.toLocaleString('es-AR')} / ${target.usd2?.toLocaleString('es-AR')} / ${target.usd3?.toLocaleString('es-AR')} — blue $${target.rate.toLocaleString('es-AR')})_\n`;
    }
    msg += `1. **Meta 1 (Mínimo):** $${goal1.toLocaleString('es-AR')} | Progreso: ${progressSoldPercent1}% ${totalSold >= goal1 ? '✅ ¡Alcanzado!' : `(Falta $${(goal1 - totalSold).toLocaleString('es-AR')})`}\n`;
    msg += `2. **Meta 2 (Medio):** $${goal2.toLocaleString('es-AR')} | Progreso: ${progressSoldPercent2}% ${totalSold >= goal2 ? '✅ ¡Alcanzado!' : `(Falta $${(goal2 - totalSold).toLocaleString('es-AR')})`}\n`;
    if (goal3 > 0) {
      msg += `3. **Meta 3 (Ideal):** $${goal3.toLocaleString('es-AR')} | Progreso: ${progressSoldPercent3}% ${totalSold >= goal3 ? '✅ ¡Alcanzado!' : `(Falta $${(goal3 - totalSold).toLocaleString('es-AR')})`}\n`;
    }

    // Calcular días restantes y promedio necesario diario
    const isCurrentMonth = now.getMonth() + 1 === month && now.getFullYear() === year;
    const totalDaysInMonth = new Date(year, month, 0).getDate();
    const remainingDays = isCurrentMonth ? totalDaysInMonth - now.getDate() + 1 : 0;

    if (remainingDays > 0) {
      msg += `\n📅 **Para los ${remainingDays} días restantes del mes (promedio diario a vender):**\n`;
      if (totalSold < goal1) {
        const reqDaily1 = (goal1 - totalSold) / remainingDays;
        msg += `- **Para Meta 1:** promedio de **$${Math.round(reqDaily1).toLocaleString('es-AR')}/día**.\n`;
      } else {
        msg += `- **Para Meta 1:** ¡Alcanzado! 🎉\n`;
      }
      if (totalSold < goal2) {
        const reqDaily2 = (goal2 - totalSold) / remainingDays;
        msg += `- **Para Meta 2:** promedio de **$${Math.round(reqDaily2).toLocaleString('es-AR')}/día**.\n`;
      } else {
        msg += `- **Para Meta 2:** ¡Alcanzado! 🎉\n`;
      }
      if (goal3 > 0) {
        if (totalSold < goal3) {
          const reqDaily3 = (goal3 - totalSold) / remainingDays;
          msg += `- **Para Meta 3:** promedio de **$${Math.round(reqDaily3).toLocaleString('es-AR')}/día**.\n`;
        } else {
          msg += `- **Para Meta 3:** ¡Alcanzado! 🎉\n`;
        }
      }
    }

    return msg;
  },
};

// ═══════════════════════════════════════════════════
// ADMIN-ONLY TOOLS
// ═══════════════════════════════════════════════════

const getFinancialReport: CopilotTool = {
  name: 'get_financial_report',
  description: 'Reporte financiero: ingresos, costos, margen neto, top clientes. Puede filtrar por mes/año.',
  parameters: {
    type: 'object',
    properties: {
      month: { type: 'number', description: 'Mes (1-12). Si no se indica, se usa el actual.' },
      year: { type: 'number', description: 'Año. Si no se indica, se usa el actual.' },
    },
  },
  execute: async (args) => {
    const now = new Date();
    const month = (args.month as number) || now.getMonth() + 1;
    const year = (args.year as number) || now.getFullYear();
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0, 23, 59, 59, 999);

    const orders = await prisma.order.findMany({
      where: { orderType: 'SALE', isDeleted: false, createdAt: { gte: from, lte: to } },
      select: {
        total: true, paid: true, subtotalWithMarkup: true,
        items: { select: { price: true, quantity: true, productCostSnapshot: true, productUnitTypeSnapshot: true, product: { select: { cost: true, unitType: true, category: true } } } },
        payments: { select: { amount: true, method: true } },
      },
    });

    let revenue = 0, totalCost = 0, totalPaid = 0;
    for (const order of orders) {
      revenue += order.subtotalWithMarkup || order.total || 0;
      for (const p of order.payments) totalPaid += p.amount || 0;
      for (const item of order.items) {
        // Snapshot-first: la línea conserva costo/unidad aunque el producto haya sido borrado.
        const unitCost = item.productCostSnapshot ?? item.product?.cost ?? 0;
        const unitType = item.productUnitTypeSnapshot ?? item.product?.unitType ?? null;
        let cost = unitCost * item.quantity;
        if (unitType === 'PAR' && item.price === 0) cost = 0;
        totalCost += cost;
      }
    }
    const profit = totalPaid - totalCost;
    const margin = totalPaid > 0 ? ((profit / totalPaid) * 100).toFixed(1) : '0';

    const monthNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    return `Reporte ${monthNames[month-1]} ${year}: Facturado $${revenue.toLocaleString('es-AR')} | Cobrado $${totalPaid.toLocaleString('es-AR')} | Costo mercadería $${totalCost.toLocaleString('es-AR')} | Ganancia neta $${profit.toLocaleString('es-AR')} | Margen ${margin}% | ${orders.length} ventas.`;
  },
};

const getAllSalesStats: CopilotTool = {
  name: 'get_all_sales_stats',
  description: 'Ventas del equipo completo, ranking de vendedores con montos, para un mes específico.',
  parameters: {
    type: 'object',
    properties: {
      month: { type: 'number', description: 'Mes (1-12)' },
      year: { type: 'number', description: 'Año' },
    },
  },
  execute: async (args) => {
    const now = new Date();
    const month = (args.month as number) || now.getMonth() + 1;
    const year = (args.year as number) || now.getFullYear();
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0, 23, 59, 59, 999);

    const orders = await prisma.order.findMany({
      where: { orderType: 'SALE', isDeleted: false, createdAt: { gte: from, lte: to } },
      select: { total: true, user: { select: { name: true } } },
    });

    const byVendor: Record<string, { count: number; total: number }> = {};
    for (const o of orders) {
      const name = o.user?.name || 'Sin asignar';
      if (!byVendor[name]) byVendor[name] = { count: 0, total: 0 };
      byVendor[name].count++;
      byVendor[name].total += o.total || 0;
    }

    const ranking = Object.entries(byVendor)
      .sort(([, a], [, b]) => b.total - a.total)
      .map(([name, data], i) => `${i + 1}. ${name}: $${data.total.toLocaleString('es-AR')} (${data.count} ventas)`)
      .join('\n');
    return `Ranking de vendedores:\n${ranking}`;
  },
};

const getBillingStats: CopilotTool = {
  name: 'get_billing_stats',
  description: 'Estadísticas de facturación electrónica por cuenta (ISH/YANI). Totales facturados y cantidad de comprobantes.',
  parameters: {
    type: 'object',
    properties: {
      month: { type: 'number' },
      year: { type: 'number' },
    },
  },
  execute: async (args) => {
    const now = new Date();
    const month = (args.month as number) || now.getMonth() + 1;
    const year = (args.year as number) || now.getFullYear();
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0, 23, 59, 59, 999);

    const invoices = await prisma.invoice.findMany({
      where: { status: 'COMPLETED', createdAt: { gte: from, lte: to } },
      select: { billingAccount: true, totalAmount: true },
    });

    const stats: Record<string, { count: number; total: number }> = {};
    for (const inv of invoices) {
      const acc = inv.billingAccount;
      if (!stats[acc]) stats[acc] = { count: 0, total: 0 };
      stats[acc].count++;
      stats[acc].total += inv.totalAmount;
    }

    const lines = Object.entries(stats).map(([acc, d]) =>
      `${acc}: $${d.total.toLocaleString('es-AR')} (${d.count} comprobantes)`
    );
    const total = invoices.reduce((s, i) => s + i.totalAmount, 0);
    return `Facturación:\n${lines.join('\n')}\nTotal: $${total.toLocaleString('es-AR')}`;
  },
};

const getExpenseSummary: CopilotTool = {
  name: 'get_expense_summary',
  description: 'Resumen de gastos fijos, marketing y proveedores del mes.',
  parameters: {
    type: 'object',
    properties: {
      month: { type: 'number' },
      year: { type: 'number' },
    },
  },
  execute: async (args) => {
    const now = new Date();
    const month = (args.month as number) || now.getMonth() + 1;
    const year = (args.year as number) || now.getFullYear();

    const costs = await prisma.fixedCost.findMany({
      where: { month, year },
      select: { name: true, amount: true, type: true, category: true },
    });

    const byType: Record<string, number> = {};
    for (const c of costs) {
      const type = c.type || 'FIJO';
      byType[type] = (byType[type] || 0) + c.amount;
    }

    const lines = Object.entries(byType).map(([t, a]) => `${t}: $${a.toLocaleString('es-AR')}`);
    const total = costs.reduce((s, c) => s + c.amount, 0);
    return `Gastos del mes ${month}/${year}:\n${lines.join('\n')}\nTotal: $${total.toLocaleString('es-AR')}`;
  },
};

const getProductCost: CopilotTool = {
  name: 'get_product_cost',
  description: 'Muestra el costo de compra (precio de proveedor) de un producto. Solo disponible para admin.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Nombre o marca del producto' },
    },
    required: ['query'],
  },
  execute: async (args) => {
    const q = (args.query as string).toLowerCase();
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { brand: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { name: true, brand: true, cost: true, price: true, laboratory: true },
      take: 8,
    });
    if (!products.length) return 'No se encontró ese producto.';
    return JSON.stringify(products.map(p => ({
      nombre: `${p.brand || ''} ${p.name || ''}`.trim(),
      costo: `$${p.cost.toLocaleString('es-AR')}`,
      precio: `$${p.price.toLocaleString('es-AR')}`,
      margen: p.price > 0 ? `${(((p.price - p.cost) / p.price) * 100).toFixed(1)}%` : 'N/A',
      laboratorio: p.laboratory,
    })));
  },
};

const getProductSalesCount: CopilotTool = {
  name: 'get_product_sales_count',
  description: 'Cuántas unidades se vendieron de un producto en el mes actual o un período específico.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Nombre o marca del producto' },
      month: { type: 'number' },
      year: { type: 'number' },
    },
    required: ['query'],
  },
  execute: async (args) => {
    const now = new Date();
    const month = (args.month as number) || now.getMonth() + 1;
    const year = (args.year as number) || now.getFullYear();
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0, 23, 59, 59, 999);
    const q = (args.query as string).toLowerCase();

    const items = await prisma.orderItem.findMany({
      where: {
        order: { orderType: 'SALE', isDeleted: false, createdAt: { gte: from, lte: to } },
        product: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { brand: { contains: q, mode: 'insensitive' } },
          ],
        },
      },
      select: {
        quantity: true, price: true,
        product: { select: { name: true, brand: true } },
      },
    });

    if (!items.length) return `No se vendieron productos que coincidan con "${args.query}" en ese período.`;

    const grouped: Record<string, { qty: number; revenue: number }> = {};
    for (const item of items) {
      const name = `${item.product?.brand || ''} ${item.product?.name || ''}`.trim();
      if (!grouped[name]) grouped[name] = { qty: 0, revenue: 0 };
      grouped[name].qty += item.quantity;
      grouped[name].revenue += item.price * item.quantity;
    }
    const lines = Object.entries(grouped).map(([name, d]) =>
      `${name}: ${d.qty} unidades, $${d.revenue.toLocaleString('es-AR')}`
    );
    return `Ventas de "${args.query}" (${month}/${year}):\n${lines.join('\n')}`;
  },
};

const getPendingBalances: CopilotTool = {
  name: 'get_pending_balances',
  description: 'Muestra los saldos pendientes globales (cuentas por cobrar). Lista los clientes que más deben.',
  parameters: { type: 'object', properties: {} },
  execute: async () => {
    const clients = await prisma.client.findMany({
      where: { orders: { some: { orderType: 'SALE', isDeleted: false } } },
      select: {
        name: true,
        orders: {
          where: { isDeleted: false },
          select: {
            orderType: true, total: true, subtotalWithMarkup: true, paid: true,
            discountCash: true, discountTransfer: true,
            payments: { select: { amount: true, method: true } },
          },
        },
      },
    });

    const balances: { name: string; balance: number }[] = [];
    let globalTotal = 0;
    for (const c of clients) {
      let balance = 0;
      for (const o of c.orders) {
        if (o.orderType === 'SALE') {
          const financials = PricingService.calculateOrderFinancials(o);
          balance += financials.remainingCash;
        }
      }
      if (balance > 1000) {
        balances.push({ name: c.name, balance });
        globalTotal += balance;
      }
    }

    balances.sort((a, b) => b.balance - a.balance);
    const top = balances.slice(0, 10).map((b, i) =>
      `${i + 1}. ${b.name}: $${Math.round(b.balance).toLocaleString('es-AR')}`
    );
    return `Saldos pendientes globales: $${Math.round(globalTotal).toLocaleString('es-AR')} (${balances.length} clientes)\n\nTop deudores:\n${top.join('\n')}`;
  },
};

// ═══════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════

const STAFF_TOOLS: CopilotTool[] = [
  lookupClient, getClientBalance, getOrderStatus,
  getProductStock, getPriceList, getMySalesToday, getLabStatus, updateLabOrder,
  getClientPrescriptions, updateClientInfo, createClientTask, getClientTasks,
  completeClientTask, addClientInteraction, getClientHistory, getSalesVsTarget
];

const ADMIN_TOOLS: CopilotTool[] = [
  getFinancialReport, getAllSalesStats, getBillingStats,
  getExpenseSummary, getProductCost, getProductSalesCount, getPendingBalances,
];

export function getToolsForRole(role: string): CopilotTool[] {
  if (role === 'ADMIN') return [...STAFF_TOOLS, ...ADMIN_TOOLS];
  return [...STAFF_TOOLS];
}
