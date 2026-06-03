import { NextResponse } from 'next/server';
import { ContactService } from '@/services/contact.service';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const search = searchParams.get('search');
        const favorites = searchParams.get('favorites') === 'true';
        const interest = searchParams.get('interest');
        const location = searchParams.get('location');

        const contacts = await ContactService.getAll(status, search, favorites, interest, location);
        return NextResponse.json(contacts);
    } catch (error: any) {
        console.error('[API Contacts] Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        return NextResponse.json({ 
            error: 'Error al obtener contactos', 
            details: error.message,
            prismaCode: error.code
        }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        if (!body.name || !body.name.trim()) {
            return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
        }

        // Deduplication: Check if a contact with the same phone already exists
        if (body.phone) {
            const normalizedPhone = body.phone.replace(/\D/g, '');
            if (normalizedPhone.length >= 8) {
                const existingByPhone = await prisma.client.findFirst({
                    where: { phone: { contains: normalizedPhone } },
                });
                if (existingByPhone) {
                    // Check that the normalized digits actually match (suffix match)
                    const existingNormalized = (existingByPhone.phone || '').replace(/\D/g, '');
                    if (existingNormalized.endsWith(normalizedPhone) || normalizedPhone.endsWith(existingNormalized)) {
                        return NextResponse.json(existingByPhone);
                    }
                }
            }
        }

        const contact = await ContactService.create(body);
        return NextResponse.json(contact);
    } catch (error: any) {
        console.error('Error creating contact:', error);
        
        let detail = error.message;
        
        try {
            const parsedError = JSON.parse(error.message);
            if (parsedError.isDuplicate) {
                return NextResponse.json({
                    error: 'Conflicto de Duplicidad',
                    details: parsedError.message,
                    isDuplicate: true,
                    existingClient: parsedError.existingClient
                }, { status: 409 });
            }
            if (parsedError.isBlocked) {
                return NextResponse.json({
                    error: 'Bloqueo de Seguridad',
                    details: parsedError.message,
                    isBlocked: true
                }, { status: 400 });
            }
        } catch (e) {
            // No es un JSON, ignorar
        }

        if (detail.includes('Unique constraint failed')) {
            detail = 'El Email o DNI ya están registrados para otro contacto.';
        }

        return NextResponse.json({
            error: 'Error al crear contacto',
            details: detail
        }, { status: 500 });
    }
}
