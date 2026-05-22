import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
    try {
        const services = await prisma.servicePricing.findMany({
            orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }]
        });
        return NextResponse.json(services);
    } catch (error) {
        console.error('Error fetching service pricing:', error);
        return NextResponse.json({ error: 'Error fetching services' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
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
        return NextResponse.json(newService);
    } catch (error) {
        console.error('Error creating service pricing:', error);
        return NextResponse.json({ error: 'Error creating service' }, { status: 500 });
    }
}
