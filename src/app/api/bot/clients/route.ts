import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ContactService } from '@/services/contact.service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const phone = searchParams.get('phone');
        const name = searchParams.get('name');

        if (!phone && !name) {
            return NextResponse.json({ error: 'Teléfono o nombre es requerido' }, { status: 400 });
        }

        // Search primarily by phone
        const where: any = {};
        if (phone) {
            const phoneDigits = phone.replace(/\D/g, '');
            const searchStr = phoneDigits.length > 8 ? phoneDigits.slice(-8) : phoneDigits;

            let phoneMatchIds: string[] = [];
            if (searchStr.length >= 4) {
                const rawSearch: any[] = await prisma.$queryRawUnsafe(`
                    SELECT id 
                    FROM "Client" 
                    WHERE REGEXP_REPLACE(COALESCE(phone, ''), '\\D', '', 'g') LIKE '%${searchStr}%'
                `);
                phoneMatchIds = rawSearch.map(d => d.id);
            }

            where.OR = [
                { phone: { contains: phone } },
                { id: { in: phoneMatchIds } },
                { whatsappChats: { some: { waId: { contains: searchStr } } } }
            ];
        } else if (name) {
            where.name = { contains: name, mode: 'insensitive' };
        }

        const client = await prisma.client.findFirst({
            where,
            include: {
                orders: { orderBy: { createdAt: 'desc' }, take: 5 },
                interactions: { orderBy: { createdAt: 'desc' }, take: 5 }
            }
        });

        if (!client) {
            return NextResponse.json({ found: false });
        }

        return NextResponse.json({ found: true, client });
    } catch (error: any) {
        console.error('[Bot Bridge Clients GET] Error:', error);
        return NextResponse.json({ error: 'Error al consultar cliente' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, ...data } = body;

        if (id) {
            // Update existing
            const updated = await ContactService.update(id, data);
            return NextResponse.json({ action: 'UPDATED', client: updated });
        } else {
            // Create new (Lead) with Deduplication Logic
            try {
                const created = await ContactService.create({
                    createdBy: 'Agente Bot',
                    ...data,
                    status: data.status || 'CONTACT'
                });
                return NextResponse.json({ action: 'CREATED', client: created });
            } catch (error: any) {
                // Intercept ContactService deduplication error
                try {
                    const parsedError = JSON.parse(error.message);
                    if (parsedError.isDuplicate && parsedError.existingClient) {
                        console.log(`[Bot Bridge] Duplicate intercepted. Linking to existing client: ${parsedError.existingClient.id}`);
                        // Optionally update some data on the existing client
                        const updated = await ContactService.update(parsedError.existingClient.id, data);
                        return NextResponse.json({ action: 'UPDATED', client: updated });
                    }
                } catch (parseError) {
                    // Not a JSON duplicate error
                }
                throw error;
            }
        }
    } catch (error: any) {
        console.error('[Bot Bridge Clients POST] Error:', error);
        return NextResponse.json({ error: 'Error al salvar cliente' }, { status: 500 });
    }
}
