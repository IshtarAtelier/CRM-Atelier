import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getProductAttributes } from '@/utils/product-controllers';
import { serverCache } from '@/lib/cache';
import { getMappedWebCatalog } from '@/lib/catalog/tienda-map';
import { canSeeWholesalePrices } from '@/lib/wholesale-access';
import { normalizarTexto } from '@/lib/text-normalize';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const channel = request.nextUrl.searchParams.get('channel');
        const isWholesale = channel === 'wholesale';

        // El canal mayorista devuelve precios netos: solo con sesión. Sin este
        // control, `?channel=wholesale` era la lista B2B completa para
        // cualquiera que mirara la pestaña Red del navegador.
        if (isWholesale) {
            const token = request.cookies.get('session')?.value;
            if (!(await canSeeWholesalePrices(token))) {
                return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
            }
        }

        const page = Number(request.nextUrl.searchParams.get('page') || 1);
        const limit = Number(request.nextUrl.searchParams.get('limit') || 24);
        const category = request.nextUrl.searchParams.get('category') || 'Todo';
        const brand = request.nextUrl.searchParams.get('brand') || '';
        const shape = request.nextUrl.searchParams.get('shape') || '';
        const material = request.nextUrl.searchParams.get('material') || '';
        const gender = request.nextUrl.searchParams.get('gender') || '';
        const sort = request.nextUrl.searchParams.get('sort') || 'recientes';
        const search = request.nextUrl.searchParams.get('search') || '';

        // El catálogo mapeado solo depende del canal (web vs mayorista): la query a la
        // base es idéntica para cualquier filtro/orden/página (todo eso se resuelve en
        // JS más abajo). Canal WEB: catálogo compartido con /tienda vía
        // src/lib/catalog/tienda-map.ts (caché 180s + fallback resiliente: esta API
        // no devuelve 500 ni vacío aunque la DB esté caída). Canal MAYORISTA: camino
        // propio con su caché, como siempre.
        let mappedProducts: any[];
        if (!isWholesale) {
            mappedProducts = (await getMappedWebCatalog()).products;
        } else {
        const cacheKey = 'store-products-mapped:wholesale';
        const cachedWholesale = serverCache.get<any[]>(cacheKey);
        if (cachedWholesale !== null) {
            mappedProducts = cachedWholesale;
        } else {
            const webProducts = await prisma.webProduct.findMany({
                where: {
                    isActive: true,
                    product: {
                        publishToWholesale: true,
                        category: { not: 'Cristal' }
                    }
                },
                include: {
                    product: true
                },
                // Los destacados (isFeatured) mandan; recién después, lo más nuevo.
                // Así la vitrina abre por lo curado y no por el último lote cargado.
                orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }]
            });

            mappedProducts = webProducts.map(wp => {
                const modelCode = wp.product.model || wp.name || '';
                const { shape: productShape, material: productMaterial } = getProductAttributes(modelCode, wp.product.seoTags);

                const isXl = ["9004M C3", "9004M C2", "TL3684 C4", "91501 C6"].some(code => modelCode.toUpperCase().includes(code)) ||
                             ["dionisio", "dionisio-c2", "selene-c4", "atelier-athena-3ytl", "poseidon-c3", "poseidon-c2"].includes(wp.slug);

                return {
                    id: wp.product.id,
                    brand: wp.product.brand || 'ATELIER',
                    model: wp.name || modelCode, // WebProduct name mapped to model (matches page.tsx)
                    modelCode: modelCode,
                    category: wp.category,
                    price: wp.product.price,
                    salePrice: wp.product.salePrice,
                    wholesalePrice: wp.product.wholesalePrice,
                    stock: wp.product.stock,
                    slug: wp.slug,
                    // La grilla solo usa [0] (principal) y [1] (hover). Recortamos a 2
                    // para no arrastrar el resto de Data URIs base64 (peso muerto ×24).
                    imagenesCatalogo: (wp.images.length > 0 ? wp.images : (wp.product.imagenesCatalogo || [])).slice(0, 2),
                    shape: isXl ? "XL" : (productShape || "Otros"),
                    material: productMaterial || "Acetato",
                    gender: wp.product.gender || "Unisex"
                };
            });
            serverCache.set(cacheKey, mappedProducts, 180);
        }
        }

        // Copia para no mutar el array cacheado con el .sort() de más abajo.
        let filtered = [...mappedProducts];

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

        // 4-bis) Filtrado por RANGO DE PRECIO (A-08, auditoría del 2/9/2026).
        //
        // De los tres filtros que la auditoría marca como los que realmente
        // decide un comprador de anteojos —precio, color y calce— este es el
        // que se puede resolver sin tocar el modelo de datos: el precio ya está
        // en cada producto. Color y calce necesitan que el dato sea filtrable
        // (hoy el calce vive dentro del texto de specs de cada ficha) y quedan
        // para cuando se haga A-07/A-08 completo.
        //
        // Se filtra por el precio EFECTIVO (con oferta si la hay), que es el
        // que la grilla muestra — igual que el orden por precio de acá abajo.
        // Si mostrás $150.000 y filtrás por el de lista, el resultado no
        // coincide con lo que la persona ve.
        const precioMin = Number(request.nextUrl.searchParams.get('precioMin') || 0);
        const precioMax = Number(request.nextUrl.searchParams.get('precioMax') || 0);
        if (precioMin > 0 || precioMax > 0) {
            filtered = filtered.filter(p => {
                const lista = p.price || 0;
                const oferta = p.salePrice;
                const valor = oferta != null && oferta > 0 && oferta < lista ? oferta : lista;
                if (precioMin > 0 && valor < precioMin) return false;
                if (precioMax > 0 && valor > precioMax) return false;
                return true;
            });
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
        //
        // normalizarTexto() saca tildes en los dos lados de la comparación:
        // sin esto, "andromeda" (como lo tipea la mayoría en un buscador) daba
        // CERO resultados contra "Andrómeda" — se lee como "no tienen", no
        // como "escribiste sin tilde". Y `brand` faltaba directamente: el
        // campo prometía buscar por marca pero nunca la miraba.
        if (search) {
            const query = normalizarTexto(search);
            filtered = filtered.filter(p =>
                normalizarTexto(p.model).includes(query) ||
                normalizarTexto(p.modelCode).includes(query) ||
                normalizarTexto(p.category).includes(query) ||
                normalizarTexto(p.brand).includes(query)
            );
        }

        // 7) Orden (Sort). Normalizamos guion bajo -> guion medio para aceptar los
        // ids del sidebar (menor_precio/mayor_precio) y del resto del sitio
        // (menor-precio/mayor-precio), que antes nunca matcheaban.
        const sortKey = sort.replace(/_/g, '-');
        // Precio EFECTIVO (oferta si la hay), no el de lista: si no, un producto
        // rebajado que la grilla muestra a salePrice queda mal posicionado en el
        // orden que el usuario pidió (auditoría 19/8, M4).
        const precioEfectivo = (p: { price?: number | null; salePrice?: number | null }) => {
            const lista = p.price || 0;
            const oferta = p.salePrice;
            return oferta != null && oferta > 0 && oferta < lista ? oferta : lista;
        };
        if (sortKey === 'menor-precio') {
            filtered.sort((a, b) => precioEfectivo(a) - precioEfectivo(b));
        } else if (sortKey === 'mayor-precio') {
            filtered.sort((a, b) => precioEfectivo(b) - precioEfectivo(a));
        } else if (sortKey === 'forma') {
            filtered.sort((a, b) => (a.shape || '').localeCompare(b.shape || '', 'es'));
        }
        // 'recientes' (o cualquier otro): se respeta el orden base del catálogo
        // (isFeatured desc, luego createdAt desc).

        // 8) Paginación
        const totalCount = filtered.length;
        const totalPages = Math.ceil(totalCount / limit);
        const skip = (page - 1) * limit;
        const paginatedProducts = filtered.slice(skip, skip + limit);

        // ── F1-02: cuántos modelos hay detrás de cada opción ─────────────────
        //
        // Sin esto se filtra a ciegas: la persona elige "Aviador" sin saber si
        // detrás hay 7 modelos o ninguno, y cae en callejones sin salida. El
        // plan pide `AVIADOR (7)`, con las de cero deshabilitadas y al final.
        //
        // LA SEMÁNTICA IMPORTA: el conteo de cada opción se calcula contra los
        // OTROS filtros activos, no contra el suyo. Si ya elegiste "Titanio",
        // "Aviador (3)" significa "3 aviadores de titanio". Pero al contar las
        // opciones de FORMA no se aplica el filtro de forma, porque si no,
        // elegida una forma, todas las demás dirían cero y parecería que el
        // catálogo se vació. Es la diferencia entre un contador útil y uno que
        // miente.
        const coincideCategoria = (p: any) => {
            if (!category || category === 'Todo') return true;
            const active = category.toLowerCase();
            const cat = (p.category || '').toLowerCase();
            if (active === 'receta') return cat.includes('receta') || cat.includes('armazón');
            if (active === 'sol') return cat.includes('sol');
            if (active === 'clip-on') return cat.includes('clip');
            if (active === 'contacto') return cat.includes('contacto');
            if (active === 'cristales') return cat.includes('cristal');
            return cat.includes(active);
        };
        const coincideMarca = (p: any) => !brand || (p.brand || '').toUpperCase() === brand.toUpperCase();
        const coincideForma = (p: any) => !shape || (p.shape || '').toUpperCase() === shape.toUpperCase();
        const coincideMaterial = (p: any) => !material || (p.material || '').toUpperCase() === material.toUpperCase();
        const coincideGenero = (p: any) => {
            if (!gender) return true;
            if (!p.gender) return true;
            const fg = gender.toLowerCase();
            const g = p.gender.toLowerCase();
            const unisex = g.includes('unisex') || g.includes('sin_genero') || g.includes('no_gender');
            if (fg === 'femme') return g.includes('femenino') || g.includes('mujer') || g.includes('femme') || unisex;
            if (fg === 'homme') return g.includes('masculino') || g.includes('hombre') || g.includes('homme') || unisex;
            if (fg === 'no_gender') return unisex;
            return true;
        };
        const coincidePrecio = (p: any) => {
            if (precioMin <= 0 && precioMax <= 0) return true;
            const lista = p.price || 0;
            const oferta = p.salePrice;
            const valor = oferta != null && oferta > 0 && oferta < lista ? oferta : lista;
            if (precioMin > 0 && valor < precioMin) return false;
            if (precioMax > 0 && valor > precioMax) return false;
            return true;
        };
        const coincideBusqueda = (p: any) => {
            if (!search) return true;
            const query = normalizarTexto(search);
            return normalizarTexto(p.model).includes(query)
                || normalizarTexto(p.modelCode).includes(query)
                || normalizarTexto(p.category).includes(query)
                || normalizarTexto(p.brand).includes(query);
        };

        /** Cuenta por valor de `campo`, ignorando el filtro de esa misma faceta. */
        const contarPor = (campo: 'brand' | 'shape' | 'material', excluir: () => boolean) => {
            const cuenta: Record<string, number> = {};
            for (const p of mappedProducts) {
                if (!coincideCategoria(p) || !coincideGenero(p) || !coincidePrecio(p) || !coincideBusqueda(p)) continue;
                if (campo !== 'brand' && !coincideMarca(p)) continue;
                if (campo !== 'shape' && !coincideForma(p)) continue;
                if (campo !== 'material' && !coincideMaterial(p)) continue;
                const valor = (p as any)[campo];
                if (!valor) continue;
                cuenta[String(valor)] = (cuenta[String(valor)] || 0) + 1;
            }
            return cuenta;
        };

        const conteos = {
            marca: contarPor('brand', () => true),
            forma: contarPor('shape', () => true),
            material: contarPor('material', () => true),
        };

        return NextResponse.json({
            products: paginatedProducts,
            totalPages,
            totalCount,
            conteos,
        });
    } catch (error) {
        console.error('Error fetching store products:', error);
        return NextResponse.json({ error: 'Error al obtener productos' }, { status: 500 });
    }
}
