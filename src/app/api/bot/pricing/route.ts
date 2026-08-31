import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { STORE_ORIGIN } from '@/lib/constants';
import { resolveStorageUrl } from '@/lib/utils/storage';
import { getWebSettings } from '@/lib/web-settings';
import { PricingService } from '@/services/PricingService';

/**
 * La foto se entrega vía /api/store/product-image, que la convierte a JPEG: el
 * catálogo publica casi todo en AVIF y WhatsApp no lo soporta (le llegaría al
 * cliente como un archivo roto).
 *
 * 30/8/2026 — por qué se agregó el paso de "hacer absoluta la ruta": las fotos
 * de los armazones PUBLICADOS no viven en el host del proveedor, son rutas del
 * propio sitio (`/assets/products/acetato/BC3059-c1.avif`). El guarda
 * `if (!/^https:\/\//)` las devolvía tal cual, o sea relativas, y el bot las
 * emitía como `[IMAGE: /assets/...]`: el extractor de index.js solo matchea
 * `https?://`, así que la foto se descartaba en silencio. Medido contra la
 * base: de los 111 armazones con `publishToWeb`, los 106 que tienen foto la
 * tienen RELATIVA — es decir, el bot nunca pudo mandar la foto de un armazón
 * publicado, que es justo lo que la campaña le pide ("contanos qué modelito te
 * gustó"). Se resuelve igual que `urlAbsoluta()` de sale-confirmation.ts.
 *
 * Las `data:` quedan afuera a propósito: no son una URL que WhatsApp pueda
 * descargar (hay fichas con la imagen embebida en base64 en `imageUrl`).
 */
function fotoParaWhatsApp(url: string | null | undefined): string | null {
    if (!url) return null;
    const resuelta = resolveStorageUrl(url);
    if (!resuelta || resuelta.startsWith('data:')) return null;
    const absoluta = /^https?:\/\//i.test(resuelta)
        ? resuelta
        : `${STORE_ORIGIN}${resuelta.startsWith('/') ? '' : '/'}${resuelta}`;
    if (!/^https:\/\//i.test(absoluta)) return null;
    return `${STORE_ORIGIN}/api/store/product-image?url=${encodeURIComponent(absoluta)}`;
}

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

    // ── Categoría y búsqueda se combinan con AND, nunca uno u otro ──────────
    // Acá había un `if (search) … else if (category)`: cuando el bot mandaba los
    // dos (el caso normal, ej. {search:"Antirreflejo", category:"MULTIFOCAL"}),
    // la CATEGORÍA se ignoraba y el search barría todo el catálogo. En una
    // prueba real terminó cotizando cristales MONOFOCALES de $42.075 como si
    // fueran multifocales (los multifocales arrancan en $745.226). El filtro de
    // categoría es el que acota el universo; el search refina DENTRO de él.
    const filtros: any[] = [];

    if (category) {
        if (category === 'CLIPON') {
            filtros.push({
                OR: [
                    { name: { contains: 'clip', mode: 'insensitive' } },
                    { brand: { contains: 'clip', mode: 'insensitive' } },
                    { model: { contains: 'clip', mode: 'insensitive' } }
                ]
            });
        } else {
            // Los `type` del catálogo llevan tilde ("Armazón", "Armazón de
            // Receta") y la categoría llega sin ella: un ILIKE '%ARMAZON%' no
            // matchea nada. Se busca por un fragmento que no dependa del acento.
            const FRAGMENTO_POR_CATEGORIA: Record<string, string> = {
                ARMAZON: 'rmaz',
                SOL: 'sol',
            };
            const fragmento = FRAGMENTO_POR_CATEGORIA[category] || category;
            filtros.push({ type: { contains: fragmento, mode: 'insensitive' } });
        }
    }

    if (search) {
        let sanitizedSearch = search;
        const clean = search.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (clean.includes('clipon') || clean.includes('clip')) {
            sanitizedSearch = 'clip';
        }
        filtros.push({
            OR: [
                { name: { contains: sanitizedSearch, mode: 'insensitive' } },
                { brand: { contains: sanitizedSearch, mode: 'insensitive' } },
                { model: { contains: sanitizedSearch, mode: 'insensitive' } }
            ]
        });
    }

    if (filtros.length > 0) {
        productWhere.AND = filtros;
    }

    let products = await prisma.product.findMany({
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
            publishToWeb: true,
            rawImageUrls: true,
            webProducts: {
                select: { slug: true, imageUrl: true }
            }
        },
        orderBy: { name: 'asc' },
    });

    // Si no hay ninguno marcado como recomendado (hoy: 0 de 481 armazones), el
    // bot se quedaba sin nada que mostrar y tenía que salir del paso con texto.
    // Mejor ofrecer los de la categoría pedida que no ofrecer nada.
    if (products.length === 0 && productWhere.botRecommended) {
        const { botRecommended: _descartado, ...sinFiltroDeRecomendados } = productWhere;
        products = await prisma.product.findMany({
            where: sinFiltroDeRecomendados,
            select: {
                id: true,
                name: true,
                brand: true,
                model: true,
                type: true,
                category: true,
                price: true,
                lensIndex: true,
                is2x1: true,
                botRecommended: true,
                botLabel: true,
                laboratory: true,
                publishToWeb: true,
                rawImageUrls: true,
                webProducts: { select: { slug: true, imageUrl: true } },
            },
            orderBy: { name: 'asc' },
            take: 20,
        });
    }

    // Si el search no matcheó nada DENTRO de la categoría, se cae a la
    // categoría sola. Devolver los multifocales que sí existen es mucho mejor
    // que devolver vacío (el bot entra en bucle preguntando lo mismo) y sigue
    // siendo imposible que salga un precio de otra categoría.
    if (products.length === 0 && category && search) {
        products = await prisma.product.findMany({
            // Sin `botRecommended`: el tool ya ordena poniendo primero los
            // recomendados, así que no hace falta filtrarlos acá.
            where: { AND: [filtros[0]] },
            select: {
                id: true,
                name: true,
                brand: true,
                model: true,
                type: true,
                category: true,
                price: true,
                lensIndex: true,
                is2x1: true,
                botRecommended: true,
                botLabel: true,
                laboratory: true,
                publishToWeb: true,
                rawImageUrls: true,
                webProducts: { select: { slug: true, imageUrl: true } },
            },
            orderBy: { name: 'asc' },
            take: 20,
        });
    }

    // El descuento por contado sale de la MISMA configuración que usa la tienda
    // (`web_promo_cash_discount`), no de un número escrito acá. Si el dueño lo
    // cambia en el panel, el bot y la web cambian juntos.
    const settings = await getWebSettings().catch(() => null);
    const descuentoContadoPct = settings?.web_promo_cash_discount ?? 15;

    // Normalizar formato para el bot
    const productsMapped = products.map(p => {
        const webProd = p.webProducts && p.webProducts.length > 0 ? p.webProducts[0] : null;
        const finalImageUrl = webProd?.imageUrl || (p.rawImageUrls && p.rawImageUrls.length > 0 ? p.rawImageUrls[0] : null);

        // 🔴 TODOS los precios salen de PricingService.preciosVidriera(): es el
        // ÚNICO lugar donde se calcula plata (regla de CLAUDE.md). El bot NO
        // debe multiplicar, dividir ni redondear NADA — recibe cada número ya
        // resuelto y solo lo escribe.
        //
        // Antes acá vivía un `Math.round(price * (1 - descuentoContado))` a mano
        // y `creditMonths: 6` fijo, y del pago en 12 cuotas no salía ni un campo.
        // Como el prompt del bot (wa-service/prompts/context-modules.js) le
        // ordena cotizar 12 cuotas con el 10% de costo financiero, ante un "¿y en
        // 12?" el modelo terminaba haciendo `lista × 1,10 ÷ 12` en texto libre:
        // el precio en cuotas lo inventaba el LLM. Mismo incidente que el de los
        // cristales Varilux, que ya costó plata real.
        //
        // El factor de las cuotas largas (10% fijo de MP Ishtar) vive en
        // FACTOR_MP_CUOTAS_LARGAS y lo aplica PricingService — no se replica acá.
        const precios = PricingService.preciosVidriera(p.price ?? 0, descuentoContadoPct);

        return {
            id: p.id,
            source: 'PRODUCT' as const,
            name: p.botLabel || `${p.brand ?? ''} ${p.name ?? ''}`.trim(),
            category: p.type || p.category,
            // El precio de LISTA es el precio en cuotas; el contado lleva el
            // descuento de la tienda aplicado. Mismos números que ve el comprador
            // en la web para ese producto.
            priceCash: precios.contado,
            priceCredit: precios.lista,
            creditMonths: 6,
            // ── Cuotas YA calculadas (el bot las escribe tal cual) ──────────
            /** Cuota de 3 y 6 SIN interés: lista ÷ 6. */
            cuota6: precios.cuota6,
            /** Cuota de 12 por Mercado Pago: (lista × 1,10) ÷ 12. NUNCA "sin interés". */
            cuota12: precios.cuota12,
            /** Total financiado a 12 cuotas: lista × 1,10. El 10% se aclara SIEMPRE. */
            total12: precios.total12,
            is2x1: p.is2x1,
            lensIndex: p.lensIndex,
            laboratory: p.laboratory,
            botRecommended: p.botRecommended,
            // Publicado en la tienda = precio real y foto que resuelve en el
            // sitio. Los 336 armazones sin publicar tienen precios de carga
            // ($6,36 / $34,14) que no son de venta: el que manda fotos ordena
            // por este campo para no ponerle un precio absurdo al pie de una foto.
            publishToWeb: p.publishToWeb,
            imageUrl: fotoParaWhatsApp(finalImageUrl),
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
        cuota6: 0,
        cuota12: 0,
        total12: 0,
        notes: '⚠️ INSTRUCCIÓN CRÍTICA PARA EL BOT: Al enviar opciones al cliente, SIEMPRE ordenalas destacando primero el pago en EFECTIVO/TRANSFERENCIA. 🔴 PROHIBIDO CALCULAR: todos los importes vienen resueltos en este mismo payload y se escriben TAL CUAL, sin multiplicar, dividir ni redondear nada. Usá "priceCash" para el contado, "cuota6" para las 6 cuotas sin interés (total "priceCredit"), y "cuota12"/"total12" para las 12 cuotas de Mercado Pago — estas ÚLTIMAS llevan 10% de costo financiero y hay que aclararlo SIEMPRE; jamás digas "12 cuotas sin interés".'
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

