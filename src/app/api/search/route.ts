import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const q = searchParams.get('q')?.trim();

        if (!q || q.length < 2) {
            return NextResponse.json({ contacts: [], products: [], orders: [] });
        }

        const searchTerm = q.toLowerCase();

        // Search contacts
        const contacts = await prisma.client.findMany({
            where: {
                OR: [
                    { name: { contains: searchTerm } },
                    { phone: { contains: searchTerm } },
                    { email: { contains: searchTerm } },
                ]
            },
            select: { id: true, name: true, phone: true, status: true, doctor: true },
            take: 8,
            orderBy: { updatedAt: 'desc' }
        });

        // Search products
        const products = await prisma.product.findMany({
            where: {
                OR: [
                    { name: { contains: searchTerm } },
                    { brand: { contains: searchTerm } },
                    { model: { contains: searchTerm } },
                ]
            },
            select: { id: true, name: true, brand: true, type: true, price: true, stock: true },
            take: 8,
            orderBy: { updatedAt: 'desc' }
        });

        // Search orders (by client name)
        const orders = await prisma.order.findMany({
            where: {
                isDeleted: false,
                client: {
                    name: { contains: searchTerm }
                }
            },
            select: {
                id: true,
                total: true,
                orderType: true,
                createdAt: true,
                client: { select: { name: true } }
            },
            take: 6,
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({
            contacts: contacts.map(c => ({
                id: c.id,
                name: c.name,
                phone: c.phone,
                status: c.status,
                doctor: c.doctor,
                type: 'contact' as const,
            })),
            products: products.map(p => ({
                id: p.id,
                name: `${p.brand || ''} ${p.name}`.trim(),
                type: p.type,
                price: p.price,
                stock: p.stock,
                category: 'product' as const,
            })),
            orders: orders.map((o: any) => ({
                id: o.id,
                clientName: o.client.name,
                total: o.total,
                orderType: o.orderType,
                date: o.createdAt,
                category: 'order' as const,
            })),
        });
    } catch (error: any) {
        console.error('Search error:', error);
        return NextResponse.json({ contacts: [], products: [], orders: [] });
    }
}
