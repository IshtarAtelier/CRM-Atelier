import { prisma } from '@/lib/db';
import { TiendaClient } from './TiendaClient';
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

export default async function TiendaPage({ searchParams }: { searchParams?: Promise<any> }) {
  const resolvedParams = searchParams ? (await searchParams) : {};
  const filterBrand = resolvedParams?.marca && typeof resolvedParams.marca === 'string' ? resolvedParams.marca : undefined;
  const sortParam = resolvedParams?.orden && typeof resolvedParams.orden === 'string' ? resolvedParams.orden : 'recientes';
  const filterShape = resolvedParams?.forma && typeof resolvedParams.forma === 'string' ? resolvedParams.forma : undefined;
  const filterMaterial = resolvedParams?.material && typeof resolvedParams.material === 'string' ? resolvedParams.material : undefined;
  
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
    const { shape, material } = getProductAttributes(modelCode);
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

  // 2) Map WebProducts to products format needed by storefront & apply filters
  let mappedProducts = dbProducts.map(wp => {
    const modelCode = wp.product.model || wp.name || '';
    const { shape, material } = getProductAttributes(modelCode);
    
    // Check if it's XL
    const isXl = modelCode.toLowerCase().includes("91501") ||
                 modelCode.toLowerCase().includes("238014") ||
                 modelCode.toLowerCase().includes("238015") ||
                 modelCode.toLowerCase().includes("3932") ||
                 modelCode.toLowerCase().includes("g7013") ||
                 wp.name?.toLowerCase().includes("athena") ||
                 wp.name?.toLowerCase().includes("gaia") ||
                 wp.name?.toLowerCase().includes("clio") ||
                 wp.name?.toLowerCase().includes("minerva") ||
                 wp.name?.toLowerCase().includes("artemis");

    return {
      id: wp.product.id,
      brand: wp.product.brand || 'Atelier',
      model: wp.name || modelCode,
      modelCode: modelCode,
      category: wp.category,
      price: wp.product.price,
      stock: wp.product.stock,
      slug: wp.slug,
      imagenesCatalogo: wp.images.length > 0 ? wp.images : (wp.product.imagenesCatalogo || []),
      shape: isXl ? "XL" : (shape || "Otros"),
      material: material || "Acetato",
      gender: wp.product.gender || "Unisex"
    };
  });

  // 3) Apply URL Filters
  if (filterBrand) {
    mappedProducts = mappedProducts.filter(p => p.brand.toLowerCase() === filterBrand.toLowerCase());
  }
  if (filterShape) {
    mappedProducts = mappedProducts.filter(p => p.shape.toLowerCase().includes(filterShape.toLowerCase()) || (filterShape.toLowerCase() === 'xl' && p.shape === 'XL'));
  }
  if (filterMaterial) {
    mappedProducts = mappedProducts.filter(p => p.material.toLowerCase() === filterMaterial.toLowerCase());
  }

  // 4) Apply Sorting
  if (sortParam === 'menor_precio') {
    mappedProducts.sort((a, b) => a.price - b.price);
  } else if (sortParam === 'mayor_precio') {
    mappedProducts.sort((a, b) => b.price - a.price);
  } else {
    // default (recientes is already done by DB order)
  }

  return (
    <TiendaClient 
      initialProducts={mappedProducts} 
      availableBrands={availableBrands}
      availableShapes={availableShapes}
      availableMaterials={availableMaterials}
    />
  );
}
