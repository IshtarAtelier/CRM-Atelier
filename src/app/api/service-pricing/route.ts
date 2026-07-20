import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';

import { unstable_cache } from 'next/cache';

const getCachedServices = unstable_cache(
    async () => {
        return await prisma.servicePricing.findMany({
            orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }]
        });
    },
    ['service-pricing-list'],
    { tags: ['service-pricing'], revalidate: 300 }
);

export async function GET() {
    try {
        const services = await getCachedServices();
        return NextResponse.json(services);
    } catch (error) {
        console.error('Error fetching service pricing:', error);
        return NextResponse.json({ error: 'Error fetching services' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        // Config de precios: solo ADMIN (igual que fixed-costs/targets/billing/products).
        if (request.headers.get('x-user-role') !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const body = await request.json();
        const { name, description, category, subcategory, priceCash, priceCredit, creditMonths, active, notes, sortOrder } = body;

        if (!name || !category || priceCash === undefined || priceCredit === undefined) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const newService = await prisma.servicePricing.create({
            data: {
                name,
                description,
                category,
                subcategory,
                priceCash: parseFloat(priceCash),
                priceCredit: parseFloat(priceCredit),
                creditMonths: parseInt(creditMonths) || 6,
                active: active !== undefined ? active : true,
                notes,
                sortOrder: parseInt(sortOrder) || 0,
            }
        });

        const actor = getActor(request);
        await logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'CREATE',
            entityType: 'SETTING',
            entityId: newService.id,
            details: {
                descripcion: `Precio de servicio "${newService.name}" creado`,
                name: newService.name,
                category: newService.category,
                priceCash: newService.priceCash,
                priceCredit: newService.priceCredit,
            },
        });

        return NextResponse.json(newService);
    } catch (error) {
        console.error('Error creating service pricing:', error);
        return NextResponse.json({ error: 'Error creating service' }, { status: 500 });
    }
}
