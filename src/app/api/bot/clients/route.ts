import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

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
        let where: any = {};
        if (phone) {
            where.OR = [
                { phone: { contains: phone } },
                { whatsappChats: { some: { waId: { contains: phone } } } }
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

        // Dedup: if no ID, check if phone already exists
        if (!id && data.phone) {
            const existing = await prisma.client.findFirst({
                where: { phone: data.phone }
            });
            if (existing) {
                const updated = await prisma.client.update({
                    where: { id: existing.id },
                    data
                });
                return NextResponse.json({ action: 'UPDATED', client: updated });
            }
        }

        if (id) {
            // Update existing
            const updated = await prisma.client.update({
                where: { id },
                data
            });
            return NextResponse.json({ action: 'UPDATED', client: updated });
        } else {
            // Create new (Lead)
            const created = await prisma.client.create({
                data: {
                    ...data,
                    status: data.status || 'CONTACT'
                }
            });
            return NextResponse.json({ action: 'CREATED', client: created });
        }
    } catch (error: any) {
        console.error('[Bot Bridge Clients POST] Error:', error);
        return NextResponse.json({ error: 'Error al salvar cliente' }, { status: 500 });
    }
}
