import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const webProducts = await prisma.webProduct.findMany({
            include: {
                product: {
                    select: {
                        brand: true,
                        model: true,
                        price: true,
                        salePrice: true,
                        stock: true,
                        imagenesCatalogo: true,
                        publishToWeb: true,
                        seoTags: true,
                        seoTitle: true,
                        seoDescription: true,
                        gender: true,
                    }
                }
            },
            orderBy: {
                updatedAt: 'desc'
            }
        });

        return NextResponse.json(webProducts);
    } catch (error: any) {
        console.error('Error fetching admin web products:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        // Vitrina pública en vivo (oferta/visibilidad/SEO): solo ADMIN.
        if (request.headers.get('x-user-role') !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }
        const body = await request.json();
        const {
            id, category, isFeatured, isActive, description, slug, seoTags, gender,
            images, imageAlts, salePrice, seoTitle, seoDescription,
        } = body;

        if (!id) {
            return NextResponse.json({ error: 'Falta el ID del WebProduct' }, { status: 400 });
        }

        // Traer el registro actual (necesario para validar salePrice contra el precio de lista)
        const current = await prisma.webProduct.findUnique({
            where: { id },
            include: { product: { select: { price: true, salePrice: true } } },
        });
        if (!current) {
            return NextResponse.json({ error: 'WebProduct no encontrado' }, { status: 404 });
        }

        // Validate slug unique if it is being changed
        if (slug) {
            const existing = await prisma.webProduct.findFirst({
                where: {
                    slug,
                    id: { not: id }
                }
            });
            if (existing) {
                return NextResponse.json({ error: 'El slug ya está en uso por otro producto' }, { status: 400 });
            }
        }

        // Normalizar galería: array de strings no vacíos. imageAlts se alinea por índice.
        let cleanImages: string[] | undefined;
        let cleanAlts: string[] | undefined;
        let mainImage: string | undefined;
        if (images !== undefined) {
            cleanImages = (Array.isArray(images) ? images : [])
                .map((s: unknown) => (typeof s === 'string' ? s.trim() : ''))
                .filter((s: string) => s.length > 0);
            const rawAlts = Array.isArray(imageAlts) ? imageAlts : [];
            cleanAlts = cleanImages.map((_, i) => (typeof rawAlts[i] === 'string' ? rawAlts[i].trim() : ''));
            mainImage = cleanImages[0]; // la principal es siempre la primera de la galería
        }

        // Validar precio de oferta: null limpia la oferta; si viene número debe ser > 0 y < precio de lista.
        let saleUpdate: { salePrice: number | null } | undefined;
        if (salePrice !== undefined) {
            if (salePrice === null || salePrice === '') {
                saleUpdate = { salePrice: null };
            } else {
                const n = Number(salePrice);
                if (!Number.isFinite(n) || n < 0) {
                    return NextResponse.json({ error: 'El precio de oferta no es un número válido.' }, { status: 400 });
                }
                if (n === 0) {
                    saleUpdate = { salePrice: null };
                } else if (n >= current.product.price) {
                    return NextResponse.json({ error: 'El precio de oferta debe ser menor al precio de lista.' }, { status: 400 });
                } else {
                    saleUpdate = { salePrice: n };
                }
            }
        }

        const productUpdate = {
            ...(seoTags !== undefined ? { seoTags } : {}),
            ...(gender !== undefined ? { gender } : {}),
            ...(seoTitle !== undefined ? { seoTitle: seoTitle || null } : {}),
            ...(seoDescription !== undefined ? { seoDescription: seoDescription || null } : {}),
            ...(saleUpdate !== undefined ? saleUpdate : {}),
        };

        const updated = await prisma.webProduct.update({
            where: { id },
            data: {
                ...(category !== undefined ? { category } : {}),
                ...(isFeatured !== undefined ? { isFeatured } : {}),
                ...(isActive !== undefined ? { isActive } : {}),
                ...(description !== undefined ? { description } : {}),
                ...(slug !== undefined ? { slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-') } : {}),
                ...(cleanImages !== undefined ? { images: cleanImages, imageAlts: cleanAlts, imageUrl: mainImage ?? null } : {}),
                ...(Object.keys(productUpdate).length > 0 ? { product: { update: productUpdate } } : {}),
            }
        });

        revalidatePath('/');
        revalidatePath('/tienda');
        revalidatePath('/lentes-de-sol');
        revalidatePath(`/producto/${updated.slug}`);

        // Trazabilidad: registrar solo los campos sensibles que cambiaron (oferta, visibilidad, destacado)
        const beforeChanged: Record<string, unknown> = {};
        const afterChanged: Record<string, unknown> = {};
        if (saleUpdate !== undefined && current.product.salePrice !== saleUpdate.salePrice) {
            beforeChanged.salePrice = current.product.salePrice;
            afterChanged.salePrice = saleUpdate.salePrice;
        }
        if (isActive !== undefined && current.isActive !== isActive) {
            beforeChanged.isActive = current.isActive;
            afterChanged.isActive = isActive;
        }
        if (isFeatured !== undefined && current.isFeatured !== isFeatured) {
            beforeChanged.isFeatured = current.isFeatured;
            afterChanged.isFeatured = isFeatured;
        }
        if (Object.keys(beforeChanged).length > 0) {
            const actor = getActor(request);
            await logAudit({
                userId: actor.id,
                userName: actor.name,
                action: 'UPDATE',
                entityType: 'PRODUCT',
                entityId: current.productId,
                details: { webProductId: id, slug: updated.slug, before: beforeChanged, after: afterChanged },
            });
        }

        return NextResponse.json({ success: true, webProduct: updated });
    } catch (error: any) {
        console.error('Error updating web product:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
