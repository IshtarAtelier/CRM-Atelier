import { NextResponse } from 'next/server';
import { ContactService } from '@/services/contact.service';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const validation = await ContactService.canCloseSale(id);
        return NextResponse.json(validation);
    } catch (error) {
        return NextResponse.json({ error: 'Error al validar cierre de venta' }, { status: 500 });
    }
}
