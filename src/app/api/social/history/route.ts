import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const platform = searchParams.get('platform');
        const status = searchParams.get('status');
        const limit = parseInt(searchParams.get('limit') || '20');

        const where: any = {};
        if (platform) where.platform = platform;
        if (status) where.status = status;

        const contents = await prisma.socialContent.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: Math.min(limit, 50)
        });

        // Parse publishTips JSON for each content
        const parsed = contents.map(c => ({
            ...c,
            publishTips: c.publishTips ? JSON.parse(c.publishTips) : null
        }));

        return NextResponse.json(parsed);
    } catch (error: any) {
        console.error('[API Social History] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Error al obtener historial' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
        }

        await prisma.socialContent.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[API Social Delete] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Error al eliminar' },
            { status: 500 }
        );
    }
}
