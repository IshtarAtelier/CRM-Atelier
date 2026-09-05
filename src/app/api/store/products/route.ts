import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getProductAttributes } from '@/utils/product-controllers';
import { serverCache } from '@/lib/cache';
import { getMappedWebCatalog } from '@/lib/catalog/tienda-map';
import { canSeeWholesalePrices } from '@/lib/wholesale-access';
import { normalizarTexto } from '@/lib/text-normalize';
import { calcularFacetas, filtrarPorFacetas, facetaValorUnico, facetaValoresMultiples } from '@/lib/catalog/facetas';

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
        // Familia de color (?color=negro). Un armazón puede pertenecer a más de
        // una — ver color-normalizado.ts — por eso el filtro es "pertenece a",
        // no igualdad exacta.
        const color = request.nextUrl.searchParams.get('color') || '';
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
                    // El mayorista no tiene el alt de foto que alimenta el color
                    // (ver tienda-map.ts): sin dato, no se inventa ninguno. La
                    // faceta de color no se ofrece en la grilla B2B por ahora.
                    coloresFamilia: [] as string[],
                    gender: wp.product.gender || "Unisex"
                };
            });
            serverCache.set(cacheKey, mappedProducts, 180);
        }
        }

        // Copia para no mutar el array cacheado con el .sort() de más abajo.
        let filtered = [...mappedProducts];

        // Categoría, precio y búsqueda: se definen UNA vez y se usan dos veces
        // (para filtrar la grilla, y más abajo para el contexto de los
        // conteos). Antes vivían duplicadas — una copia filtraba, la otra
        // servía de base a los conteos — y las dos podían divergir sin que
        // nada avisara si alguien tocaba una y no la otra.
        const precioMinParaFiltro = Number(request.nextUrl.searchParams.get('precioMin') || 0);
        const precioMaxParaFiltro = Number(request.nextUrl.searchParams.get('precioMax') || 0);
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
        const coincidePrecio = (p: any) => {
            if (precioMinParaFiltro <= 0 && precioMaxParaFiltro <= 0) return true;
            const lista = p.price || 0;
            const oferta = p.salePrice;
            const valor = oferta != null && oferta > 0 && oferta < lista ? oferta : lista;
            if (precioMinParaFiltro > 0 && valor < precioMinParaFiltro) return false;
            if (precioMaxParaFiltro > 0 && valor > precioMaxParaFiltro) return false;
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

        // 1) Filtrado por Categoría (fuera del sistema de facetas: no tiene
        // conteo propio en el panel — es la pestaña de arriba, no un chip).
        filtered = filtered.filter(coincideCategoria);

        // 2-5) Marca, Forma, Material, Color y Género — declaradas una sola
        // vez como facetas (ver src/lib/catalog/facetas.ts) y usadas para
        // filtrar Y para contar con el MISMO código: antes eran dos juegos de
        // funciones (`coincideX` y `contarPor`) que podían divergir sin que
        // nada avisara. Sumar una faceta nueva es agregar un objeto acá, no
        // tocar la función de conteo.
        const coincideGeneroTexto = (pGender: string | null | undefined, filtro: string | null) => {
            if (!filtro) return true;
            if (!pGender) return true; // sin dato declarado, no se excluye a nadie
            const g = pGender.toLowerCase();
            const unisex = g.includes('unisex') || g.includes('sin_genero') || g.includes('no_gender');
            if (filtro === 'femme') return g.includes('femenino') || g.includes('mujer') || g.includes('femme') || unisex;
            if (filtro === 'homme') return g.includes('masculino') || g.includes('hombre') || g.includes('homme') || unisex;
            if (filtro === 'no_gender') return unisex;
            return true;
        };

        const FACETAS = [
            facetaValorUnico<any>('marca', p => p.brand),
            facetaValorUnico<any>('forma', p => p.shape),
            facetaValorUnico<any>('material', p => p.material),
            facetaValoresMultiples<any>('color', p => p.coloresFamilia || []),
            { // Género no usa facetaValorUnico: su matching es por inclusión de
              // palabras y "unisex" cuenta para femme Y homme a la vez —
              // no es una igualdad exacta como las otras.
                clave: 'genero',
                valoresDe: (p: any) => (p.gender ? [String(p.gender).toLowerCase()] : []),
                coincide: (p: any, filtro: string | null) => coincideGeneroTexto(p.gender, filtro?.toLowerCase() ?? null),
            },
        ];

        const filtrosActivos: Record<string, string | null> = {
            marca: brand || null,
            forma: shape || null,
            material: material || null,
            color: color || null,
            genero: gender ? gender.toLowerCase() : null,
        };

        filtered = filtrarPorFacetas(filtered, FACETAS, filtrosActivos);

        // 4-bis) Filtrado por RANGO DE PRECIO (A-08, auditoría del 2/9/2026).
        //
        // Fuera del sistema de facetas: no es "pertenece a esta opción", es un
        // rango numérico con dos parámetros que se mueven juntos.
        //
        // Se filtra por el precio EFECTIVO (con oferta si la hay), que es el
        // que la grilla muestra — igual que el orden por precio de acá abajo.
        // Si mostrás $150.000 y filtrás por el de lista, el resultado no
        // coincide con lo que la persona ve.
        filtered = filtered.filter(coincidePrecio);

        // 6) Filtrado por Búsqueda (Search)
        //
        // normalizarTexto() saca tildes en los dos lados de la comparación:
        // sin esto, "andromeda" (como lo tipea la mayoría en un buscador) daba
        // CERO resultados contra "Andrómeda" — se lee como "no tienen", no
        // como "escribiste sin tilde". Y `brand` faltaba directamente: el
        // campo prometía buscar por marca pero nunca la miraba.
        filtered = filtered.filter(coincideBusqueda);

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
        // detrás hay 7 modelos o ninguno, y cae en callejones sin salida.
        //
        // LA SEMÁNTICA IMPORTA: el conteo de cada opción se calcula contra los
        // OTROS filtros activos, no contra el suyo — la resuelve
        // `calcularFacetas()` (ver src/lib/catalog/facetas.ts). Categoría,
        // precio y búsqueda quedan FUERA del sistema de facetas: son el
        // contexto fijo sobre el que se cuentan marca/forma/material/color/
        // género, no chips que compitan entre sí — por eso se aplican con los
        // mismos predicados de arriba para armar `baseParaConteo`, y no se
        // vuelven a escribir acá.
        const baseParaConteo = mappedProducts.filter(p =>
            coincideCategoria(p) && coincidePrecio(p) && coincideBusqueda(p));

        const conteosCrudos = calcularFacetas(baseParaConteo, FACETAS, filtrosActivos);
        const conteos = {
            marca: conteosCrudos.marca,
            forma: conteosCrudos.forma,
            material: conteosCrudos.material,
            color: conteosCrudos.color,
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
