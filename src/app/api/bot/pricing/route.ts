import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

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
    const search = searchParams.get('search')?.trim();

    // ── Fuente 1: Productos del inventario ──────────────────────────────────
    const productWhere: any = {};
    if (onlyBotRecommended) productWhere.botRecommended = true;

    if (search) {
        let sanitizedSearch = search;
        const clean = search.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (clean.includes('clipon') || clean.includes('clip')) {
            sanitizedSearch = 'clip';
        }
        productWhere.OR = [
            { name: { contains: sanitizedSearch, mode: 'insensitive' } },
            { brand: { contains: sanitizedSearch, mode: 'insensitive' } },
            { model: { contains: sanitizedSearch, mode: 'insensitive' } }
        ];
    } else if (category) {
        if (category === 'CLIPON') {
            productWhere.OR = [
                { name: { contains: 'clip', mode: 'insensitive' } },
                { brand: { contains: 'clip', mode: 'insensitive' } },
                { model: { contains: 'clip', mode: 'insensitive' } }
            ];
        } else {
            productWhere.type = { contains: category, mode: 'insensitive' };
        }
    }

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
            rawImageUrls: true,
            webProducts: {
                select: { slug: true, imageUrl: true }
            }
        },
        orderBy: { name: 'asc' },
    });

    // ── Fuente 2: ServicePricing (servicios de lab) ─────────────────────────
    const servicePricingWhere: any = {};
    if (!all) servicePricingWhere.active = true;
    if (category) {
        if (category === 'CLIPON') {
            servicePricingWhere.category = 'NONE';
        } else {
            servicePricingWhere.category = category;
        }
    }

    const services = await prisma.servicePricing.findMany({
        where: servicePricingWhere,
        orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });

    // Normalizar formato para el bot
    const productsMapped = products.map(p => {
        const webProd = p.webProducts && p.webProducts.length > 0 ? p.webProducts[0] : null;
        const finalImageUrl = webProd?.imageUrl || (p.rawImageUrls && p.rawImageUrls.length > 0 ? p.rawImageUrls[0] : null);
        
        return {
            id: p.id,
            source: 'PRODUCT' as const,
            name: p.botLabel || `${p.brand ?? ''} ${p.name ?? ''}`.trim(),
            category: p.type || p.category,
            priceCash: p.price,
            priceCredit: null, // Se calcula en el bot si no está
            creditMonths: 6,
            is2x1: p.is2x1,
            lensIndex: p.lensIndex,
            laboratory: p.laboratory,
            botRecommended: p.botRecommended,
            imageUrl: finalImageUrl,
            link: webProd?.slug ? `https://atelieroptica.com.ar/producto/${webProd.slug}` : null,
        };
    });

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

    // Instrucción inyectada para forzar el formato del bot externo
    const formattingInstruction = {
        id: 'SYSTEM_INSTRUCTION',
        source: 'SERVICE',
        name: 'REGLA DE FORMATO DE VENTAS (OBLIGATORIA)',
        category: 'SYSTEM',
        priceCash: 0,
        priceCredit: 0,
        creditMonths: 6,
        notes: '⚠️ INSTRUCCIÓN CRÍTICA PARA EL BOT: Al enviar opciones al cliente, SIEMPRE ordenalas destacando primero el pago en EFECTIVO/TRANSFERENCIA. Para la opción de tarjeta, calculá y mostrá EXPLÍCITAMENTE el valor de cada una de las 6 cuotas fijas (Ej: "💳 6 cuotas fijas de $X"), no des el precio total de tarjeta a secas.'
    };

    return NextResponse.json([formattingInstruction, ...productsMapped, ...servicesMapped]);
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
