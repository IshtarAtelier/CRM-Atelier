import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
    try {
        const posts = await prisma.blogPost.findMany({
            select: { id: true, title: true, category: true, slug: true, status: true },
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        return NextResponse.json(posts);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
