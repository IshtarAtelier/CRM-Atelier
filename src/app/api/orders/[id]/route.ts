import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { OrderService } from '@/services/order.service';

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const response = await OrderService.getOrder(id);
        return NextResponse.json(response);
    } catch (error: any) {
        console.error('Error fetching order:', error);
        return NextResponse.json({ error: error.message }, { status: error.message === 'Order not found' ? 404 : 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const reason = searchParams.get('reason') || 'Sin motivo especificado';
        
        const headersList = await headers();
        const role = headersList.get('x-user-role') || 'STAFF';
        const userId = headersList.get('x-user-id');
        const userName = headersList.get('x-user-name');

        const order = await OrderService.deleteOrder(id, reason, role, userId, userName);
        return NextResponse.json(order);
    } catch (error: any) {
        console.error('Error deleting order:', error);
        const status = error.message.includes('administrador puede eliminar') ? 403 : 500;
        return NextResponse.json({ error: error.message }, { status });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        
        const order = await OrderService.updateOrder(id, body);
        return NextResponse.json(order);
    } catch (error: any) {
        console.error('Error updating order:', error);
        
        let status = 500;
        if (error.message.includes('Datos inválidos') || 
            error.message.includes('No se puede revertir') || 
            error.message.includes('mínimo del 40%') || 
            error.message.includes('completa (nombre') ||
            error.message.includes('stock disponible') ||
            error.message.includes('receta') ||
            error.message.includes('armazón') ||
            error.message.includes('No se puede enviar a fábrica')) {
            status = 400;
        } else if (error.message.includes('No se pueden modificar los ítems de una venta')) {
            status = 403;
        } else if (error.message.includes('Pedido no encontrado')) {
            status = 404;
        } else if (error.message.includes('suficiente stock disponible')) {
            status = 409;
        }

        return NextResponse.json({ error: error.message }, { status });
    }
}
