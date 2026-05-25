import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { staticPosts } from '@/lib/static-blog-posts';

export async function GET() {
    try {
        const dbPosts = await prisma.blogPost.findMany({
            select: { id: true, title: true, category: true, slug: true, status: true },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        const mappedStatic = staticPosts.map(p => ({
            id: p.slug,
            title: p.title,
            category: p.category,
            slug: p.slug,
            status: 'PUBLISHED'
        }));

        const merged = [...dbPosts, ...mappedStatic];
        return NextResponse.json(merged);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
