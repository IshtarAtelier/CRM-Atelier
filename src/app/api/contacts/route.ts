import { NextResponse } from 'next/server';
import { ContactService } from '@/services/contact.service';
import { cookies } from 'next/headers';
import { decrypt } from '@/lib/auth';
import { matchContactSource, CONTACT_SOURCES_SELECCIONABLES } from '@/lib/contact-source';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const search = searchParams.get('search');
        const favorites = searchParams.get('favorites') === 'true';
        const interest = searchParams.get('interest');
        const location = searchParams.get('location');
        const unattended = searchParams.get('unattended') === 'true';

        const contacts = await ContactService.getAll(status, search, favorites, interest, location, unattended);
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
        
        // Add createdBy from session if not provided
        if (!body.createdBy) {
            try {
                const cookieStore = await cookies();
                const session = cookieStore.get('session');
                if (session?.value) {
                    const payload = await decrypt(session.value);
                    if (payload && payload.name) {
                        body.createdBy = payload.name;
                    }
                }
            } catch (e) {
                console.error('Failed to get session for createdBy', e);
            }
        }

        if (!body.name || !body.name.trim()) {
            return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
        }

        // ── Origen obligatorio DE VERDAD ──────────────────────────────────────
        // Los tres formularios que pegan acá (ficha nueva en Contactos, alta
        // rápida del cotizador y "crear ficha" del buzón de WhatsApp) ya piden
        // el origen, pero solo del lado del navegador: bastaba un submit sin
        // pasar por el formulario para crear una ficha sin canal, y una ficha
        // sin canal no aparece en ningún reporte de atribución — la venta que
        // trajo el anuncio queda sin dueño.
        //
        // Solo se valida en ESTA ruta (altas hechas por una persona del equipo).
        // Los procesos automáticos NO pasan por acá: el bot, la extracción del
        // chat y el checkout web llaman a ContactService.create() directamente,
        // porque muchas veces todavía no se sabe de dónde vino el cliente y
        // forzar un valor sería inventarlo (el checkout es la excepción: ahí sí
        // se sabe, y escribe 'Tienda online' solo si la ficha no traía origen).
        const origen = matchContactSource(body.contactSource);
        if (!origen) {
            return NextResponse.json({
                error: 'Falta el origen del contacto',
                details: body.contactSource
                    ? `"${body.contactSource}" no es un canal conocido. Elegí uno de: ${CONTACT_SOURCES_SELECCIONABLES.join(', ')}.`
                    : `Elegí de dónde vino este contacto (Origen / Canal): ${CONTACT_SOURCES_SELECCIONABLES.join(', ')}.`,
                field: 'contactSource',
            }, { status: 400 });
        }
        // Se guarda ya en su forma canónica: "instagram", "IG" y "Meta" son el
        // mismo canal y tienen que contarse juntos.
        body.contactSource = origen;

        // Deduplication is handled entirely by ContactService.create() using raw SQL
        // with REGEXP_REPLACE for digit normalization — this correctly handles phones
        // stored with formatting (e.g. "+54 9 2216 73-6745" vs "5492216736745")

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
