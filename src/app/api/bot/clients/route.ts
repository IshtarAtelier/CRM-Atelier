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
            // Los últimos 10 dígitos (código de área + número) identifican unívocamente
            // en Argentina. Antes se usaban 8 con LIKE %..%, que matcheaba clientes de
            // distinta provincia que compartían esos dígitos → cruce de fichas y fuga de PII.
            const searchStr = phoneDigits.length >= 10 ? phoneDigits.slice(-10) : phoneDigits;

            let phoneMatchIds: string[] = [];
            if (searchStr.length >= 8) {
                const rawSearch: any[] = await prisma.$queryRaw`
                    SELECT id
                    FROM "Client"
                    WHERE RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '\\D', '', 'g'), ${searchStr.length}) = ${searchStr}
                `;
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
                        const existingName = parsedError.existingClient.name || '';
                        const newName = data.name || '';
                        
                        const cleanStr = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
                        const cleanExisting = cleanStr(existingName);
                        const cleanNew = cleanStr(newName);
                        
                        // Si los nombres son distintos, forzar la creación de la nueva ficha en lugar de sobrescribir
                        if (cleanExisting !== cleanNew && !cleanExisting.includes(cleanNew) && !cleanNew.includes(cleanExisting)) {
                            console.log(`[Bot Bridge] Shared phone but different names: "${existingName}" vs "${newName}". Force creating new client.`);
                            const created = await ContactService.create({
                                createdBy: 'Agente Bot',
                                ...data,
                                forceCreate: true,
                                status: data.status || 'CONTACT'
                            });
                            return NextResponse.json({ action: 'CREATED', client: created });
                        }

                        console.log(`[Bot Bridge] Duplicate intercepted. Linking to existing client: ${parsedError.existingClient.id}`);
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
