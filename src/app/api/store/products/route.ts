import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getProductAttributes } from '@/utils/product-controllers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const channel = request.nextUrl.searchParams.get('channel');
        const isWholesale = channel === 'wholesale';
        const page = Number(request.nextUrl.searchParams.get('page') || 1);
        const limit = Number(request.nextUrl.searchParams.get('limit') || 24);
        const category = request.nextUrl.searchParams.get('category') || 'Todo';
        const brand = request.nextUrl.searchParams.get('brand') || '';
        const shape = request.nextUrl.searchParams.get('shape') || '';
        const material = request.nextUrl.searchParams.get('material') || '';
        const gender = request.nextUrl.searchParams.get('gender') || '';
        const sort = request.nextUrl.searchParams.get('sort') || 'recientes';
        const search = request.nextUrl.searchParams.get('search') || '';

        const webProducts = await prisma.webProduct.findMany({
            where: {
                isActive: true,
                product: {
                    ...(isWholesale
                        ? { publishToWholesale: true }
                        : { publishToWeb: true }),
                    category: { not: 'Cristal' }
                }
            },
            include: {
                product: true
            },
            orderBy: { createdAt: 'desc' }
        });

        const mappedProducts = webProducts.map(wp => {
            const modelCode = wp.product.model || wp.name || '';
            const { shape: productShape, material: productMaterial } = getProductAttributes(modelCode, wp.product.seoTags);
            
            const isXl = ["9004M C3", "9004M C2", "TL3684 C4", "91501 C6"].some(code => modelCode.toUpperCase().includes(code)) ||
                         ["dionisio", "poseidon", "selene-c4", "atelier-athena-3ytl", "poseidon-c3", "poseidon-c2"].includes(wp.slug);
            
            return {
                id: wp.product.id,
                brand: wp.product.brand || 'ATELIER',
                model: wp.name || modelCode, // WebProduct name mapped to model (matches page.tsx)
                modelCode: modelCode,
                category: wp.category,
                price: wp.product.price,
                ...(isWholesale ? { wholesalePrice: wp.product.wholesalePrice } : {}),
                stock: wp.product.stock,
                slug: wp.slug,
                imagenesCatalogo: wp.images.length > 0 ? wp.images : (wp.product.imagenesCatalogo || []),
                shape: isXl ? "XL" : (productShape || "Otros"),
                material: productMaterial || "Acetato",
                gender: wp.product.gender || "Unisex"
            };
        });

        let filtered = mappedProducts;

        // 1) Filtrado por Categoría
        if (category && category !== 'Todo') {
            const active = category.toLowerCase();
            filtered = filtered.filter(p => {
                const cat = (p.category || "").toLowerCase();
                if (active === "receta") return cat.includes("receta") || cat.includes("armazón");
                if (active === "sol") return cat.includes("sol");
                if (active === "clip-on") return cat.includes("clip");
                if (active === "contacto") return cat.includes("contacto");
                if (active === "cristales") return cat.includes("cristal");
                return cat.includes(active);
            });
        }

        // 2) Filtrado por Marca
        if (brand) {
            filtered = filtered.filter(p => (p.brand || '').toUpperCase() === brand.toUpperCase());
        }

        // 3) Filtrado por Forma
        if (shape) {
            filtered = filtered.filter(p => (p.shape || '').toUpperCase() === shape.toUpperCase());
        }

        // 4) Filtrado por Material
        if (material) {
            filtered = filtered.filter(p => (p.material || '').toUpperCase() === material.toUpperCase());
        }

        // 5) Filtrado por Género
        if (gender) {
            const fg = gender.toLowerCase();
            filtered = filtered.filter(p => {
                if (!p.gender) return true;
                const g = p.gender.toLowerCase();
                if (fg === 'femme') {
                    return g.includes('femenino') || g.includes('mujer') || g.includes('femme') || g.includes('unisex') || g.includes('sin_genero') || g.includes('no_gender');
                } else if (fg === 'homme') {
                    return g.includes('masculino') || g.includes('hombre') || g.includes('homme') || g.includes('unisex') || g.includes('sin_genero') || g.includes('no_gender');
                } else if (fg === 'no_gender') {
                    return g.includes('unisex') || g.includes('sin_genero') || g.includes('no_gender');
                }
                return true;
            });
        }

        // 6) Filtrado por Búsqueda (Search)
        if (search) {
            const query = search.toLowerCase().trim();
            filtered = filtered.filter(p => 
                (p.model || '').toLowerCase().includes(query) ||
                (p.modelCode || '').toLowerCase().includes(query) ||
                (p.category || '').toLowerCase().includes(query)
            );
        }

        // 7) Orden (Sort)
        if (sort === 'menor-precio') {
            filtered.sort((a, b) => (a.price || 0) - (b.price || 0));
        } else if (sort === 'mayor-precio') {
            filtered.sort((a, b) => (b.price || 0) - (a.price || 0));
        }

        // 8) Paginación
        const totalCount = filtered.length;
        const totalPages = Math.ceil(totalCount / limit);
        const skip = (page - 1) * limit;
        const paginatedProducts = filtered.slice(skip, skip + limit);

        return NextResponse.json({
            products: paginatedProducts,
            totalPages,
            totalCount
        });
    } catch (error) {
        console.error('Error fetching store products:', error);
        return NextResponse.json({ error: 'Error al obtener productos' }, { status: 500 });
    }
}
