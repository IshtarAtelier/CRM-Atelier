import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

function escapeCSV(val: any): string {
    if (val == null) return '';
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

function toCSV(headers: string[], rows: any[][]): string {
    const bom = '\uFEFF'; // UTF-8 BOM for Excel compatibility
    const headerLine = headers.map(escapeCSV).join(',');
    const dataLines = rows.map(row => row.map(escapeCSV).join(','));
    return bom + [headerLine, ...dataLines].join('\r\n');
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type'); // contacts, products, sales

        let csv = '';
        let filename = '';

        if (type === 'contacts') {
            const contacts = await prisma.client.findMany({
                orderBy: { createdAt: 'desc' },
                include: { tags: true, orders: { where: { isDeleted: false }, select: { total: true, orderType: true } } }
            });

            const headers = ['Nombre', 'Teléfono', 'Email', 'Estado', 'Etiqueta', 'Tipo Producto', 'Médico', 'Obra Social', 'Total Ventas', 'Fecha Creación'];
            const rows = contacts.map(c => {
                const salesTotal = (c.orders || [])
                    .filter(o => o.orderType === 'SALE')
                    .reduce((sum, o) => sum + o.total, 0);
                return [
                    c.name,
                    c.phone,
                    c.email || '',
                    c.status,
                    c.contactSource || '',
                    c.interest || '',
                    c.doctor || '',
                    c.insurance || '',
                    salesTotal,
                    new Date(c.createdAt).toLocaleDateString('es-AR'),
                ];
            });
            csv = toCSV(headers, rows);
            filename = `contactos_${Date.now()}.csv`;

        } else if (type === 'products') {
            const products = await prisma.product.findMany({ orderBy: { type: 'asc' } });

            const userRole = request.headers.get('x-user-role') || 'STAFF';
            const showCost = userRole === 'ADMIN';

            const headers = showCost
                ? ['Tipo', 'Marca', 'Nombre', 'Modelo', 'Índice', 'Precio', 'Costo', 'Stock', 'Unidad']
                : ['Tipo', 'Marca', 'Nombre', 'Modelo', 'Índice', 'Precio', 'Stock', 'Unidad'];
            const rows = products.map(p => showCost
                ? [p.type, p.brand || '', p.name, p.model || '', p.lensIndex || '', p.price, p.cost, p.stock, p.unitType || 'UNIDAD']
                : [p.type, p.brand || '', p.name, p.model || '', p.lensIndex || '', p.price, p.stock, p.unitType || 'UNIDAD']
            );
            csv = toCSV(headers, rows);
            filename = `inventario_${Date.now()}.csv`;

        } else if (type === 'sales') {
            const from = searchParams.get('from');
            const to = searchParams.get('to');
            const where: any = { orderType: 'SALE', isDeleted: false };
            if (from) where.createdAt = { ...where.createdAt, gte: new Date(from) };
            if (to) where.createdAt = { ...where.createdAt, lte: new Date(to + 'T23:59:59') };

            const orders = await prisma.order.findMany({
                where,
                include: {
                    client: { select: { name: true, doctor: true } },
                    payments: true,
                    items: { include: { product: true } },
                    user: { select: { name: true } },
                },
                orderBy: { createdAt: 'desc' }
            });

            const headers = ['Fecha', 'Cliente', 'Vendedor', 'Médico', 'Total', 'Pagado', 'Saldo', 'Métodos de Pago', 'Productos'];
            const rows = orders.map(o => [
                new Date(o.createdAt).toLocaleDateString('es-AR'),
                o.client.name,
                o.user.name,
                o.client.doctor || '',
                o.total,
                o.paid,
                o.total - o.paid,
                [...new Set(o.payments.map(p => p.method))].join(' / '),
                o.items.map(i => `${i.product?.brand || ''} ${i.product?.name || ''} x${i.quantity}`).join(' | '),
            ]);
            csv = toCSV(headers, rows);
            filename = `ventas_${Date.now()}.csv`;

        } else {
            return NextResponse.json({ error: 'Tipo inválido. Usar: contacts, products, sales' }, { status: 400 });
        }

        return new NextResponse(csv, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`,
            }
        });
    } catch (error: any) {
        console.error('Export error:', error);
        return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
    }
}
