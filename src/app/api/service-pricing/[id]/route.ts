import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const body = await request.json();
        const { id } = await params;

        const updatedService = await prisma.servicePricing.update({
            where: { id },
            data: {
                name: body.name,
                description: body.description,
                category: body.category,
                subcategory: body.subcategory,
                priceCash: body.priceCash !== undefined ? parseFloat(body.priceCash) : undefined,
                priceCredit: body.priceCredit !== undefined ? parseFloat(body.priceCredit) : undefined,
                creditMonths: body.creditMonths !== undefined ? parseInt(body.creditMonths) : undefined,
                active: body.active,
                notes: body.notes,
                sortOrder: body.sortOrder !== undefined ? parseInt(body.sortOrder) : undefined,
            }
        });
        return NextResponse.json(updatedService);
    } catch (error) {
        console.error('Error updating service pricing:', error);
        return NextResponse.json({ error: 'Error updating service' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await prisma.servicePricing.delete({
            where: { id }
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting service pricing:', error);
        return NextResponse.json({ error: 'Error deleting service' }, { status: 500 });
    }
}
