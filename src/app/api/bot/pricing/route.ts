import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// ── GET /api/bot/pricing ──────────────────────────────────────────────────────
// Obtiene los productos del inventario real con precios reales recomendados para el bot
// Query params: ?category=MULTIFOCAL|MONOFOCAL|etc &botRecommended=true &search=...
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category')?.toUpperCase();
    const onlyBotRecommended = searchParams.get('botRecommended') === 'true';
    const search = searchParams.get('search')?.trim();

    // ── Fuente 1: Productos del inventario ──────────────────────────────────
    const productWhere: any = {};
    if (onlyBotRecommended || !search) {
        productWhere.botRecommended = true;
    }

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

    return NextResponse.json([formattingInstruction, ...productsMapped]);
}

// ── POST /api/bot/pricing ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    return NextResponse.json({ error: 'Carga manual deshabilitada. Seleccione productos del inventario.' }, { status: 400 });
}

// ── PUT /api/bot/pricing ──────────────────────────────────────────────────────
// Actualiza botRecommended / botLabel en el producto del inventario
export async function PUT(req: NextRequest) {
    const body = await req.json();
    const { id, source, ...data } = body;

    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    if (source === 'PRODUCT') {
        const updated = await prisma.product.update({
            where: { id },
            data: {
                botRecommended: data.botRecommended !== undefined ? data.botRecommended : undefined,
                botLabel: data.botLabel !== undefined ? data.botLabel : undefined,
            },
        });
        return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'Operación no soportada' }, { status: 400 });
}

// ── DELETE /api/bot/pricing ───────────────────────────────────────────────────
// Quita el producto de los recomendados
export async function DELETE(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const source = searchParams.get('source');

    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    if (source === 'PRODUCT') {
        const updated = await prisma.product.update({
            where: { id },
            data: { botRecommended: false },
        });
        return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'Operación no soportada' }, { status: 400 });
}

