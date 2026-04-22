import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ── GET /api/bot/pricing ──────────────────────────────────────────────────────
// Unifica dos fuentes:
//   1. Products con botRecommended=true (inventario real con precios reales)
//   2. ServicePricing (servicios de laboratorio sin stock propio)
// Query params: ?category=MULTIFOCAL|MONOFOCAL|etc  &botRecommended=true
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category')?.toUpperCase();
    const onlyBotRecommended = searchParams.get('botRecommended') === 'true';
    const all = searchParams.get('all'); // admin: incluye inactivos

    // ── Fuente 1: Productos del inventario ──────────────────────────────────
    const productWhere: Record<string, unknown> = {};
    if (onlyBotRecommended) productWhere.botRecommended = true;
    if (category) productWhere.type = category; // Product usa "type" para MULTIFOCAL etc.

    const products = await prisma.product.findMany({
        where: productWhere,
        select: {
            id: true,
            name: true,
            brand: true,
            model: true,
            type: true,       // MULTIFOCAL, MONOFOCAL, etc.
            category: true,   // LENS, FRAME, etc.
            price: true,
            lensIndex: true,
            is2x1: true,
            botRecommended: true,
            botLabel: true,
            laboratory: true,
        },
        orderBy: { name: 'asc' },
    });

    // ── Fuente 2: ServicePricing (servicios de lab) ─────────────────────────
    const servicePricingWhere: Record<string, unknown> = {};
    if (!all) servicePricingWhere.active = true;
    if (category) servicePricingWhere.category = category;

    const services = await prisma.servicePricing.findMany({
        where: servicePricingWhere,
        orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });

    // Normalizar formato para el bot
    const productsMapped = products.map(p => ({
        id: p.id,
        source: 'PRODUCT' as const,
        name: p.botLabel || `${p.brand ?? ''} ${p.model ?? p.name ?? ''}`.trim(),
        category: p.type || p.category,
        priceCash: p.price,
        priceCredit: null, // Se calcula en el bot si no está
        creditMonths: 6,
        is2x1: p.is2x1,
        lensIndex: p.lensIndex,
        laboratory: p.laboratory,
        botRecommended: p.botRecommended,
    }));

    const servicesMapped = services.map(s => ({
        id: s.id,
        source: 'SERVICE' as const,
        name: s.name,
        category: s.category,
        subcategory: s.subcategory,
        priceCash: s.priceCash,
        priceCredit: s.priceCredit,
        creditMonths: s.creditMonths,
        notes: s.notes,
        botRecommended: true,
        is2x1: false,
    }));

    return NextResponse.json([...productsMapped, ...servicesMapped]);
}

// ── POST /api/bot/pricing ─────────────────────────────────────────────────────
// Crear entrada en ServicePricing (para servicios sin stock)
export async function POST(req: NextRequest) {
    const body = await req.json();
    const { name, description, category, subcategory, priceCash, priceCredit, creditMonths, notes, sortOrder } = body;

    if (!name || !category || priceCash === undefined || priceCredit === undefined) {
        return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const pricing = await prisma.servicePricing.create({
        data: {
            name,
            description,
            category: category.toUpperCase(),
            subcategory: subcategory?.toUpperCase(),
            priceCash: Number(priceCash),
            priceCredit: Number(priceCredit),
            creditMonths: Number(creditMonths) || 6,
            notes,
            sortOrder: Number(sortOrder) || 0,
        },
    });

    return NextResponse.json(pricing, { status: 201 });
}

// ── PUT /api/bot/pricing ──────────────────────────────────────────────────────
// Actualiza precio en ServicePricing o marca botRecommended en Product
export async function PUT(req: NextRequest) {
    const body = await req.json();
    const { id, source, ...data } = body;

    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    if (source === 'PRODUCT') {
        // Actualiza botRecommended / botLabel en el producto del inventario
        const updated = await prisma.product.update({
            where: { id },
            data: {
                botRecommended: data.botRecommended,
                botLabel: data.botLabel,
            },
        });
        return NextResponse.json(updated);
    }

    // Default: ServicePricing
    if (data.category) data.category = data.category.toUpperCase();
    if (data.subcategory) data.subcategory = data.subcategory.toUpperCase();
    if (data.priceCash !== undefined) data.priceCash = Number(data.priceCash);
    if (data.priceCredit !== undefined) data.priceCredit = Number(data.priceCredit);

    const updated = await prisma.servicePricing.update({ where: { id }, data });
    return NextResponse.json(updated);
}

// ── DELETE /api/bot/pricing ───────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const source = searchParams.get('source');

    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    if (source === 'PRODUCT') {
        // Solo desactiva el flag botRecommended, no borra el producto
        const updated = await prisma.product.update({
            where: { id },
            data: { botRecommended: false },
        });
        return NextResponse.json(updated);
    }

    const updated = await prisma.servicePricing.update({
        where: { id },
        data: { active: false },
    });
    return NextResponse.json(updated);
}
