import { NextResponse } from 'next/server';
import { ContactService } from '@/services/contact.service';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const prescriptions = await ContactService.getPrescriptions(id);
        return NextResponse.json(prescriptions);
    } catch (error) {
        return NextResponse.json({ error: 'Error al obtener recetas' }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        const prescription = await ContactService.addPrescription(id, body);
        return NextResponse.json(prescription);
    } catch (error: any) {
        console.error('Error in prescriptions POST:', error);
        return NextResponse.json({
            error: 'Error al crear receta',
            details: error.message
        }, { status: 500 });
    }
}
