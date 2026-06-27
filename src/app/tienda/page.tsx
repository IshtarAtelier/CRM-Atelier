import { prisma } from '@/lib/db';
import { TiendaClient } from './TiendaClient';
import { StorefrontFooter } from '@/components/Storefront/StorefrontFooter';
import { Metadata } from 'next';
import { getProductAttributes } from '@/utils/product-controllers';

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

import { Suspense } from 'react';

export default async function TiendaPage() {
  // We query all active web products to extract distinct filters and then apply filter criteria
  let dbProducts: any[] = [];
  try {
    dbProducts = await prisma.webProduct.findMany({
      where: {
        isActive: true,
        product: {
          publishToWeb: true,
        }
      },
      include: {
        product: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  } catch (error) {
    console.error("Prerendering warning: Database not reachable at build time in Tienda page.", error);
  }

  // 1) Extract filter options dynamically from all available active web products
  const brandsSet = new Set<string>();
  const shapesSet = new Set<string>();
  const materialsSet = new Set<string>();

  dbProducts.forEach(wp => {
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

  // 2) Map WebProducts to products format needed by storefront
  const mappedProducts = dbProducts.map(wp => {
    const modelCode = wp.product.model || wp.name || '';
    const { shape, material } = getProductAttributes(modelCode, wp.product?.seoTags);
    
    // Check if it's XL
    const isXl = ["9004M C3", "9004M C2", "TL3684 C4", "91501 C6"].some(code => modelCode.toUpperCase().includes(code)) ||
                 ["dionisio", "poseidon", "selene-c4", "atelier-athena-3ytl", "poseidon-c3", "poseidon-c2"].includes(wp.slug);

    return {
      id: wp.product.id,
      brand: 'ATELIER',
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
        initialProducts={mappedProducts} 
        availableBrands={availableBrands}
        availableShapes={availableShapes}
        availableMaterials={availableMaterials}
        footer={<StorefrontFooter />}
      />
    </Suspense>
  );
}
