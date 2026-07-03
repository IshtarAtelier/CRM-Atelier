import { prisma } from '@/lib/db';
import { TiendaClient } from './TiendaClient';
import { StorefrontFooterStatic } from '@/components/Storefront/StorefrontFooterStatic';
import { Metadata } from 'next';
import { getProductAttributes } from '@/utils/product-controllers';
import { Suspense } from 'react';

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Colección de Anteojos",
  description: 'Descubrí nuestra colección completa de anteojos de diseño. Marcos premium seleccionados a mano.',
  alternates: {
    canonical: 'https://www.atelieroptica.com.ar/tienda',
  },
  openGraph: {
    title: "Colección de Anteojos",
    description: 'Descubrí nuestra colección completa de anteojos de diseño. Marcos premium seleccionados a mano.',
    url: 'https://www.atelieroptica.com.ar/tienda',
    type: 'website',
  },
};

export default async function TiendaPage() {
  // 1) Fetch only filter metadata for the sidebar (very light query selecting only specific text fields)
  let filterMetadata: any[] = [];
  try {
    filterMetadata = await prisma.webProduct.findMany({
      where: {
        isActive: true,
        product: {
          publishToWeb: true,
        }
      },
      select: {
        name: true,
        product: {
          select: {
            brand: true,
            model: true,
            seoTags: true,
          }
        }
      }
    });
  } catch (error) {
    console.error(`[Tienda] Error fetching filter metadata:`, error);
  }

  const brandsSet = new Set<string>();
  const shapesSet = new Set<string>();
  const materialsSet = new Set<string>();

  filterMetadata.forEach(wp => {
    if (wp.product?.brand) {
      brandsSet.add(wp.product.brand.toUpperCase());
    }
    const modelCode = wp.product?.model || wp.name || '';
    const { shape, material } = getProductAttributes(modelCode, wp.product?.seoTags);
    if (shape) {
      shape.split(',').forEach(s => shapesSet.add(s.trim()));
    }
    if (material) {
      materialsSet.add(material);
    }
  });

  shapesSet.add("XL"); // ensure XL category / shape is available

  const availableBrands = Array.from(brandsSet).sort();
  const availableShapes = Array.from(shapesSet).sort();
  const availableMaterials = Array.from(materialsSet).sort();

  // 2) Fetch ONLY the first 24 products for the initial server render & SEO (instant, small payload)
  let initialDbProducts: any[] = [];
  let initialTotalCount = 0;
  try {
    const whereClause = {
      isActive: true,
      product: {
        publishToWeb: true,
      }
    };
    initialTotalCount = await prisma.webProduct.count({ where: whereClause });
    initialDbProducts = await prisma.webProduct.findMany({
      where: whereClause,
      include: {
        product: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10000
    });
  } catch (error) {
    console.error(`[Tienda] Error fetching initial products:`, error);
  }

  const mappedInitialProducts = initialDbProducts.map(wp => {
    const modelCode = wp.product.model || wp.name || '';
    const { shape, material } = getProductAttributes(modelCode, wp.product?.seoTags);
    
    const isXl = ["9004M C3", "9004M C2", "TL3684 C4", "91501 C6"].some(code => modelCode.toUpperCase().includes(code)) ||
                 ["dionisio", "poseidon", "selene-c4", "atelier-athena-3ytl", "poseidon-c3", "poseidon-c2"].includes(wp.slug);

    return {
      id: wp.product.id,
      brand: wp.product.brand || 'ATELIER',
      model: wp.name || modelCode,
      modelCode: modelCode,
      category: wp.category,
      price: wp.product.price,
      wholesalePrice: wp.product.wholesalePrice,
      stock: wp.product.stock,
      slug: wp.slug,
      imagenesCatalogo: wp.images.length > 0 ? wp.images : (wp.product.imagenesCatalogo || []),
      shape: isXl ? "XL" : (shape || "Otros"),
      material: material || "Acetato",
      gender: wp.product.gender || "Unisex"
    };
  });

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Cargando...</div>}>
      <TiendaClient 
        initialProducts={mappedInitialProducts} 
        initialTotalCount={initialTotalCount}
        availableBrands={availableBrands}
        availableShapes={availableShapes}
        availableMaterials={availableMaterials}
        footer={<StorefrontFooterStatic />}
      />
    </Suspense>
  );
}
