import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const posts = await prisma.blogPost.findMany({
            orderBy: {
                date: 'desc'
            }
        });
        return NextResponse.json(posts);
    } catch (error: any) {
        console.error('Error fetching admin blog posts:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { title, slug, excerpt, content, category, imageUrl, status, metaTitle, metaDescription } = body;

        if (!title || !slug || !content || !category) {
            return NextResponse.json({ error: 'Faltan campos obligatorios (título, slug, contenido o categoría)' }, { status: 400 });
        }

        // Validate unique slug
        const existing = await prisma.blogPost.findUnique({
            where: { slug }
        });
        if (existing) {
            return NextResponse.json({ error: 'El slug ya está en uso' }, { status: 400 });
        }

        const newPost = await prisma.blogPost.create({
            data: {
                title,
                slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                excerpt: excerpt || '',
                content,
                category,
                imageUrl: imageUrl || null,
                status: status || 'DRAFT',
                metaTitle: metaTitle || null,
                metaDescription: metaDescription || null,
                date: new Date(),
            }
        });

        return NextResponse.json({ success: true, post: newPost });
    } catch (error: any) {
        console.error('Error creating blog post:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
