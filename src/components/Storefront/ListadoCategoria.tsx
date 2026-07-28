import { Suspense } from 'react';
import { CategoryGrid } from '@/components/Storefront/CategoryGrid';
import { ProductFilters } from '@/components/Storefront/ProductFilters';
import { prisma } from '@/lib/db';
import { LISTADO_SELECT } from '@/lib/catalog/queries';
import { getProductAttributes } from '@/utils/product-controllers';
import { resolveStorageUrl } from '@/lib/utils/storage';

/**
 * Listado de una categoría del catálogo: grilla + filtros + JSON-LD.
 *
 * Nació porque /clip-on no mostraba ni uno de los 12 clip-on publicados — era
 * una landing con un botón a WhatsApp — y la alternativa era copiar por tercera
 * vez las ~250 líneas de /lentes-de-sol y /receta, que ya son casi el mismo
 * archivo. Esas dos pueden migrar acá cuando se las toque; este componente es
 * el lugar donde debería vivir la lógica.
 */

export interface ListadoCategoriaProps {
  /** Se busca por `contains` sobre WebProduct.category ("Sol", "Receta", "Clip-On"). */
  categoria: string;
  /** Ruta absoluta de la página, para el canonical del dato estructurado. */
  url: string;
  titulo: string;
  descripcion: string;
  /** Mensaje cuando la categoría no tiene nada publicado. */
  mensajeVacio: string;
  filtros: {
    marca?: string;
    forma?: string;
    material?: string;
    genero?: string;
    orden?: string;
  };
}

/** Cuántos ítems se enumeran en el JSON-LD. Tiene que coincidir con numberOfItems. */
const ITEMS_EN_SCHEMA = 20;

export async function ListadoCategoria({
  categoria,
  url,
  titulo,
  descripcion,
  mensajeVacio,
  filtros,
}: ListadoCategoriaProps) {
  const { marca, forma, material, genero, orden = 'recientes' } = filtros;

  // Los cristales no son armazones: si uno queda con la categoría web de
  // receta, aparece en la grilla mezclado entre los marcos. Ya pasó — un
  // Essilor Orma de $280.000 estaba listado en /receta.
  const where: Record<string, unknown> = {
    category: { contains: categoria, mode: 'insensitive' },
    isActive: true,
    product: {
      category: { not: 'Cristal' },
      ...(marca ? { brand: { equals: marca, mode: 'insensitive' } } : {}),
    },
  };

  const orderBy: Record<string, unknown>[] = [{ isFeatured: 'desc' }];
  if (orden === 'menor_precio') orderBy.push({ product: { price: 'asc' } });
  else if (orden === 'mayor_precio') orderBy.push({ product: { price: 'desc' } });
  else orderBy.push({ createdAt: 'desc' });

  let filas: any[] = [];
  let meta: any[] = [];
  try {
    [filas, meta] = await Promise.all([
      prisma.webProduct.findMany({ where, select: LISTADO_SELECT, orderBy }),
      prisma.webProduct.findMany({
        where: {
          category: { contains: categoria, mode: 'insensitive' },
          isActive: true,
          product: { category: { not: 'Cristal' } },
        },
        select: { name: true, product: { select: { brand: true, model: true, seoTags: true } } },
      }),
    ]);
  } catch (error) {
    // La página no puede quedar en blanco por una caída de base, pero tampoco
    // tiene sentido inventar productos: se muestra vacía con su mensaje.
    console.error(`[${categoria}] listado en vivo falló:`, error);
  }

  const marcas = new Set<string>();
  const formas = new Set<string>();
  const materiales = new Set<string>();
  for (const wp of meta) {
    if (wp.product?.brand) marcas.add(wp.product.brand.toUpperCase());
    const { shape, material: mat } = getProductAttributes(wp.product?.model || wp.name, wp.product?.seoTags);
    if (shape) shape.split(',').forEach((s: string) => formas.add(s.trim()));
    if (mat) materiales.add(mat);
  }

  const productos = filas.map((wp) => {
    const codigo = wp.product.model || wp.name;
    const { shape, material: mat } = getProductAttributes(codigo, wp.product?.seoTags);
    const fotos = wp.images?.length ? wp.images : (wp.product.imagenesCatalogo || []);
    return {
      id: wp.product.id,
      brand: wp.product.brand,
      model: wp.name || codigo,
      price: wp.product.price,
      stock: wp.product.stock,
      imagenesCatalogo: fotos,
      category: wp.category,
      slug: wp.slug,
      isFeatured: wp.isFeatured,
      shape,
      material: mat,
      gender: wp.product.gender,
    };
  });

  // Forma, material y género se filtran en memoria porque se deducen de los
  // tags, no son columnas.
  let visibles = productos;
  if (forma) {
    visibles = visibles.filter((p) =>
      (p.shape || '').split(',').map((s) => s.trim().toLowerCase()).includes(forma.toLowerCase()));
  }
  if (material) {
    visibles = visibles.filter((p) => (p.material || '').toLowerCase() === material.toLowerCase());
  }
  if (genero) {
    const g = genero.toLowerCase();
    visibles = visibles.filter((p) => {
      if (!p.gender) return true;
      const pg = p.gender.toLowerCase();
      if (g === 'femme') return /femenino|mujer|femme|unisex|sin_genero|no_gender/.test(pg);
      if (g === 'homme') return /masculino|hombre|homme|unisex|sin_genero|no_gender/.test(pg);
      if (g === 'no_gender') return /unisex|sin_genero|no_gender/.test(pg);
      return true;
    });
  }
  if (orden === 'forma') {
    visibles.sort((a, b) => (a.shape || '').localeCompare(b.shape || ''));
  }

  const enumerados = visibles.slice(0, ITEMS_EN_SCHEMA);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: titulo,
    description: descripcion,
    url,
    mainEntity: {
      '@type': 'ItemList',
      // Los que se enumeran, no el total: declarar 89 y listar 20 es una
      // inconsistencia que Google marca al validar.
      numberOfItems: enumerados.length,
      itemListElement: enumerados.map((p, i) => {
        const foto = p.imagenesCatalogo?.[0] ? resolveStorageUrl(p.imagenesCatalogo[0]) : undefined;
        const absoluta = foto ? (foto.startsWith('http') ? foto : `https://atelieroptica.com.ar${foto}`) : undefined;
        return {
          '@type': 'ListItem',
          position: i + 1,
          url: `https://atelieroptica.com.ar/producto/${p.slug}`,
          name: `${p.brand} ${p.model}`,
          ...(absoluta ? { image: absoluta } : {}),
        };
      }),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 relative">
        <aside className="w-full lg:w-64 flex-shrink-0">
          <Suspense fallback={<div className="h-40 bg-stone-100 animate-pulse rounded-xl" />}>
            <ProductFilters
              availableBrands={Array.from(marcas).sort()}
              availableShapes={Array.from(formas).sort()}
              availableMaterials={Array.from(materiales).sort()}
            />
          </Suspense>
        </aside>
        <div className="flex-1">
          <CategoryGrid
            products={visibles}
            categoryName={titulo}
            emptyMessage={marca ? `No encontramos ${titulo.toLowerCase()} de la marca ${marca}.` : mensajeVacio}
          />
        </div>
      </div>
    </>
  );
}
