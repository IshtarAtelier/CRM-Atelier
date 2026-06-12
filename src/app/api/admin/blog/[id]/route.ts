import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { title, slug, excerpt, content, category, imageUrl, status, metaTitle, metaDescription } = body;

        if (!id) {
            return NextResponse.json({ error: 'Falta el ID del artículo' }, { status: 400 });
        }

        // Validate slug unique if changed
        if (slug) {
            const existing = await prisma.blogPost.findFirst({
                where: {
                    slug,
                    id: { not: id }
                }
            });
            if (existing) {
                return NextResponse.json({ error: 'El slug ya está en uso por otro artículo' }, { status: 400 });
            }
        }

        const updated = await prisma.blogPost.update({
            where: { id },
            data: {
                ...(title !== undefined ? { title } : {}),
                ...(slug !== undefined ? { slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-') } : {}),
                ...(excerpt !== undefined ? { excerpt } : {}),
                ...(content !== undefined ? { content } : {}),
                ...(category !== undefined ? { category } : {}),
                ...(imageUrl !== undefined ? { imageUrl } : {}),
                ...(status !== undefined ? { status } : {}),
                ...(metaTitle !== undefined ? { metaTitle } : {}),
                ...(metaDescription !== undefined ? { metaDescription } : {}),
            }
        });

        return NextResponse.json({ success: true, post: updated });
    } catch (error: any) {
        console.error('Error updating blog post:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json({ error: 'Falta el ID del artículo' }, { status: 400 });
        }

        await prisma.blogPost.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting blog post:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
