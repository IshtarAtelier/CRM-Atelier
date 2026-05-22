import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { headers } from 'next/headers';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const headersList = await headers();
        const body = await request.json();
        const updatedTag = await prisma.tag.update({
            where: { id: id },
            data: {
                name: body.name,
                color: body.color,
                botAction: body.botAction,
                notifyPhone: body.notifyPhone
            }
        });
        return NextResponse.json(updatedTag);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update tag' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const headersList = await headers();
        await prisma.tag.delete({
            where: { id: id }
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 });
    }
}
