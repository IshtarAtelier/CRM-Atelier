import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { headers } from 'next/headers';

export async function GET(request: NextRequest) {
    try {
        const headersList = await headers();
        const tags = await prisma.tag.findMany({
            orderBy: { name: 'asc' },
            include: {
                _count: {
                    select: { clients: true, orders: true }
                }
            }
        });
        return NextResponse.json(tags);
    } catch (error) {
        return NextResponse.json({ error: 'Unauthorized or Server Error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const headersList = await headers();
        const body = await request.json();
        
        const newTag = await prisma.tag.create({
            data: {
                name: body.name,
                color: body.color || '#9e7f65',
                botAction: body.botAction || 'NONE',
                notifyPhone: body.notifyPhone || null
            }
        });
        
        return NextResponse.json(newTag);
    } catch (error: any) {
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Tag already exists' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
