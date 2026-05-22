import { prisma } from '@/lib/db';

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
            orderType: true, total: true, subtotalWithMarkup: true,
            payments: { select: { amount: true } },
          },
        },
      },
    });
    if (!client) return 'Cliente no encontrado.';

    let totalSales = 0;
    let totalPaid = 0;
    for (const order of client.orders) {
      if (order.orderType === 'SALE') {
        totalSales += order.total || order.subtotalWithMarkup || 0;
      }
      for (const p of order.payments) totalPaid += p.amount || 0;
    }
    const balance = Math.max(0, totalSales - totalPaid);
    return `${client.name}: Saldo pendiente $${balance.toLocaleString('es-AR')}. Total vendido: $${totalSales.toLocaleString('es-AR')}. Total pagado: $${totalPaid.toLocaleString('es-AR')}.`;
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
        labOrderNumber: true, createdAt: true,
        client: { select: { name: true } },
        items: { select: { productNameSnapshot: true, productBrandSnapshot: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });
    if (!orders.length) return 'No se encontraron pedidos con ese criterio.';
    return JSON.stringify(orders.map(o => ({
      id: o.id.slice(-6), cliente: o.client.name,
      estado: o.status, estadoLab: o.labStatus,
      nroLab: o.labOrderNumber,
      total: o.total, pagado: o.paid,
      saldoPendiente: Math.max(0, (o.total || 0) - (o.paid || 0)),
      fecha: o.createdAt.toISOString().split('T')[0],
      productos: o.items.map(i => `${i.productBrandSnapshot || ''} ${i.productNameSnapshot || ''}`.trim()),
    })));
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
  description: 'Actualiza el estado de laboratorio o el número de operación de un pedido. Útil cuando te piden "pasá el pedido a listo para retirar" o "cargale el número de operación 1234". Estados válidos: NONE (Pendiente), SENT (Procesado), READY (Listo para retirar), DELIVERED (Entregado).',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Nombre del cliente o últimos 6 caracteres del ID del pedido' },
      newStatus: { type: 'string', description: 'El nuevo estado (NONE, SENT, READY, DELIVERED) - Opcional' },
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

    if (newStatus && !['NONE', 'SENT', 'READY', 'DELIVERED'].includes(newStatus)) {
        return 'Estado inválido. Debe ser NONE, SENT, READY o DELIVERED.';
    }

    const order = await prisma.order.findFirst({
      where: {
        isDeleted: false,
        OR: [
          { id: { endsWith: q } },
          { client: { name: { contains: q, mode: 'insensitive' } } },
        ],
      },
      include: { client: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!order) return 'No se encontró ningún pedido reciente que coincida con esa búsqueda.';

    const dataToUpdate: any = {};
    let willChangeStatus = false;

    if (labOrderNumber) {
        dataToUpdate.labOrderNumber = labOrderNumber;
        // Auto-advance to SENT if it's currently NONE
        if (!newStatus && (!order.labStatus || order.labStatus === 'NONE')) {
            dataToUpdate.labStatus = 'SENT';
            dataToUpdate.labSentAt = new Date();
            willChangeStatus = true;
        }
    }

    let finalStatus = order.labStatus;
    if (newStatus && order.labStatus !== newStatus) {
        dataToUpdate.labStatus = newStatus;
        if (newStatus === 'SENT') dataToUpdate.labSentAt = new Date();
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
            await BotService.notifyOrderReady(order as any);
            sideEffectMsg = '\n(Se le envió automáticamente un WhatsApp al cliente avisándole del retiro y su saldo)';
        } catch (e) {
            console.error('Error auto-notifying from Copilot tool:', e);
        }
    }

    if (willChangeStatus && finalStatus === 'DELIVERED') {
        try {
            const { ContactService } = await import('@/services/contact.service');
            const taskDesc = `Solicitar comentario a ${order.client.name}`;
            await ContactService.addTask(order.clientId, taskDesc);
            sideEffectMsg = '\n(Se generó la tarea automática para pedirle una reseña)';
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
        total: true, paid: true,
        items: { select: { price: true, quantity: true, product: { select: { cost: true, unitType: true, category: true } } } },
        payments: { select: { amount: true, method: true } },
      },
    });

    let revenue = 0, totalCost = 0, totalPaid = 0;
    for (const order of orders) {
      revenue += order.total || 0;
      for (const p of order.payments) totalPaid += p.amount || 0;
      for (const item of order.items) {
        if (!item.product) continue;
        let cost = (item.product.cost || 0) * item.quantity;
        if (item.product.unitType === 'PAR' && item.price === 0) cost = 0;
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
            orderType: true, total: true, subtotalWithMarkup: true,
            payments: { select: { amount: true } },
          },
        },
      },
    });

    const balances: { name: string; balance: number }[] = [];
    let globalTotal = 0;
    for (const c of clients) {
      let sales = 0, paid = 0;
      for (const o of c.orders) {
        if (o.orderType === 'SALE') sales += o.total || o.subtotalWithMarkup || 0;
        for (const p of o.payments) paid += p.amount || 0;
      }
      const balance = Math.max(0, sales - paid);
      if (balance > 0) {
        balances.push({ name: c.name, balance });
        globalTotal += balance;
      }
    }

    balances.sort((a, b) => b.balance - a.balance);
    const top = balances.slice(0, 10).map((b, i) =>
      `${i + 1}. ${b.name}: $${b.balance.toLocaleString('es-AR')}`
    );
    return `Saldos pendientes globales: $${globalTotal.toLocaleString('es-AR')} (${balances.length} clientes)\n\nTop deudores:\n${top.join('\n')}`;
  },
};

// ═══════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════

export const STAFF_TOOLS: CopilotTool[] = [
  lookupClient, getClientBalance, getOrderStatus,
  getProductStock, getPriceList, getMySalesToday, getLabStatus, updateLabOrder
];

export const ADMIN_TOOLS: CopilotTool[] = [
  getFinancialReport, getAllSalesStats, getBillingStats,
  getExpenseSummary, getProductCost, getProductSalesCount, getPendingBalances,
];

export function getToolsForRole(role: string): CopilotTool[] {
  if (role === 'ADMIN') return [...STAFF_TOOLS, ...ADMIN_TOOLS];
  return [...STAFF_TOOLS];
}
