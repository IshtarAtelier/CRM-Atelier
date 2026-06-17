import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getProductAttributes } from '@/utils/product-controllers';

export const revalidate = 300;
import { ProductClient } from './ProductClient';
import { resolveStorageUrl } from "@/lib/utils/storage";

// Constante para el producto demo
const DEMO_PRODUCT = {
  id: "atelier-carey-vintage",
  brand: "ATELIER",
  model: "9030 (GLD)",
  modelCode: "9030 (GLD)",
  price: 55000,
  stock: 5,
  imagenesCatalogo: null,
  mockImage: "/images/products/atelier-9030-gold.png",
  category: "Receta",
  slug: "atelier-carey-vintage",
  description: "Anteojos de receta estilo vintage Carey. Diseño premium ideal para multifocales."
};

async function getProduct(slug: string) {
  if (slug === 'atelier-carey-vintage') {
    return DEMO_PRODUCT;
  }

  try {
    // 1) Intentar por WebProduct.slug o productId
    const webProduct = await prisma.webProduct.findFirst({
      where: { 
        OR: [
          { slug },
          { productId: slug }
        ]
      },
      include: { product: true }
    });

    if (webProduct && webProduct.isActive) {
      return {
        id: webProduct.product.id,
        brand: webProduct.product.brand || 'Atelier',
        model: webProduct.name || webProduct.product.model || '',
        modelCode: webProduct.product.model,
        price: webProduct.product.price,
        stock: webProduct.product.stock,
        imagenesCatalogo: webProduct.images.length > 0 ? webProduct.images : webProduct.product.imagenesCatalogo,
        category: webProduct.category,
        description: webProduct.description,
        slug: webProduct.slug,
        lensWidth: webProduct.product.lensWidth,
        bridgeWidth: webProduct.product.bridgeWidth,
        templeLength: webProduct.product.templeLength,
        frameHeight: webProduct.product.frameHeight,
        seoTitle: webProduct.product.seoTitle,
        seoDescription: webProduct.product.seoDescription,
        seoTags: webProduct.product.seoTags,
        mpn: webProduct.product.mpn,
        gender: webProduct.product.gender,
        ageGroup: webProduct.product.ageGroup,
      };
    }

    // 2) Fallback: buscar directamente por Product.id (para links del catálogo que usan el id)
    const product = await prisma.product.findUnique({
      where: { id: slug },
    });

    if (!product) return null;

    return {
      id: product.id,
      brand: product.brand || 'Atelier',
      model: product.model || 'Sin modelo',
      modelCode: product.model,
      price: product.price,
      stock: product.stock,
      imagenesCatalogo: product.imagenesCatalogo,
      category: product.category || 'Receta',
      description: null,
      slug: product.id,
      lensWidth: product.lensWidth,
      bridgeWidth: product.bridgeWidth,
      templeLength: product.templeLength,
      frameHeight: product.frameHeight,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      seoTags: product.seoTags,
      mpn: product.mpn,
      gender: product.gender,
      ageGroup: product.ageGroup,
    };
  } catch (error) {
    console.error("Prerendering warning: Database not reachable at build time inside getProduct.", error);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const product = await getProduct(resolvedParams.slug);

  if (!product) {
    return {
      title: "Producto no encontrado",
    };
  }

  // Generación automática del "mensajito" SEO si no tiene descripción manual
  const title = (product as any).seoTitle || `${product.brand} ${product.model} | Atelier Óptica Córdoba`;
  const description = (product as any).seoDescription || product.description || `Llevate los anteojos ${product.category} ${product.brand} ${product.model} en Atelier Óptica Córdoba. Diseño premium. Comprá online con envío a todo el país y 6 cuotas sin interés.`;
  
  const imageUrl = product.imagenesCatalogo && product.imagenesCatalogo.length > 0 
    ? resolveStorageUrl(product.imagenesCatalogo[0])
    : ((product as any).mockImage || '/images/og-image.jpg');

  const absoluteImageUrl = imageUrl.startsWith('http') ? imageUrl : `https://www.atelieroptica.com.ar${imageUrl}`;

  return {
    title,
    description,
    alternates: {
      canonical: `https://www.atelieroptica.com.ar/producto/${product.slug}`,
    },
    openGraph: {
      title,
      description,
      images: [
        {
          url: absoluteImageUrl,
          width: 800,
          height: 800,
          alt: `${product.brand} ${product.model}`,
        },
      ],
      type: 'website',
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [absoluteImageUrl],
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const product = await getProduct(resolvedParams.slug);

  if (!product) {
    notFound();
  }

  // Get material from product attributes
  const { material } = getProductAttributes((product as any).modelCode || product.model);

  // 1) Sibling variants query
  let variants: any[] = [];
  try {
    const baseModel = product.modelCode 
      ? product.modelCode.split(/[\s-]/)[0] 
      : product.model?.split(/[\s-]/)[0];
      
    if (baseModel && baseModel.length > 2) {
      const siblings = await prisma.webProduct.findMany({
        where: {
          isActive: true,
          product: {
            publishToWeb: true,
            model: { startsWith: baseModel, mode: 'insensitive' }
          }
        },
        include: { product: true }
      });
      
      variants = siblings
        .filter(s => {
          const { material: siblingMaterial } = getProductAttributes(s.product.model);
          return siblingMaterial === material;
        })
        .map(s => {
          const modelName = s.product.model || '';
          const colorMatch = modelName.match(/\b(C\d+[-]?\d*)\b/i) || modelName.match(/\(([^)]+)\)/);
          const colorName = colorMatch ? colorMatch[1] : modelName.replace(baseModel, '').trim();
          return {
            slug: s.slug,
            colorCode: colorName || 'Default',
            imageUrl: s.images.length > 0 ? s.images[0] : (s.product.imagenesCatalogo?.[0] || null)
          };
        });
    }
  } catch (err) {
    console.error("Error fetching variants:", err);
  }

  // 2) Related products query
  let relatedProducts: any[] = [];
  try {
    const siblings = await prisma.webProduct.findMany({
      where: {
        isActive: true,
        category: product.category,
        productId: { not: product.id }
      },
      include: { product: true },
      take: 4
    });
    relatedProducts = siblings.map(wp => ({
      id: wp.product.id,
      brand: wp.product.brand || 'Atelier',
      model: wp.name || wp.product.model || '',
      price: wp.product.price,
      slug: wp.slug,
      imageUrl: wp.images.length > 0 ? wp.images[0] : (wp.product.imagenesCatalogo?.[0] || '/images/placeholder.svg')
    }));
  } catch (err) {
    console.error("Error fetching related products:", err);
  }

  // Resolve all product images to absolute URLs
  const resolveAbsolute = (url: string) => {
    const resolved = resolveStorageUrl(url);
    return resolved.startsWith('http') ? resolved : `https://www.atelieroptica.com.ar${resolved}`;
  };

  const allImages = product.imagenesCatalogo && product.imagenesCatalogo.length > 0
    ? product.imagenesCatalogo.map(resolveAbsolute)
    : [`https://www.atelieroptica.com.ar${(product as any).mockImage || '/images/og-image.jpg'}`];

  // Extract color code from model name (e.g., "C1", "C2", "GLD")
  const colorMatch = product.model?.match(/\(([^)]+)\)/) || product.model?.match(/\b(C\d+)\b/i);
  const colorCode = colorMatch ? colorMatch[1] : undefined;


  // Generar JSON-LD (Schema.org para Google Shopping / SEO)
  const jsonLd: any = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: (product as any).seoTitle || `${product.brand} ${product.model}`,
    image: allImages,
    description: (product as any).seoDescription || product.description || `Anteojos ${product.category} ${product.brand} ${product.model}.`,
    sku: (product as any).id?.substring(0, 8).toUpperCase(),
    brand: {
      '@type': 'Brand',
      name: product.brand,
    },
    category: product.category,
    material: material,
    offers: {
      '@type': 'Offer',
      url: `https://www.atelieroptica.com.ar/producto/${product.slug}`,
      priceCurrency: 'ARS',
      price: product.price,
      availability: (product.stock !== undefined && product.stock > 0) || product.slug === 'atelier-carey-vintage' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: {
        '@type': 'Organization',
        name: 'Atelier Óptica',
      },
    },
  };

  // Add color if extracted
  if (colorCode) {
    jsonLd.color = colorCode;
  }

  // Add measurement properties
  const additionalProperty: any[] = [];
  if ((product as any).lensWidth) {
    additionalProperty.push({ '@type': 'PropertyValue', name: 'Ancho de lente', value: `${(product as any).lensWidth}mm` });
  }
  if ((product as any).bridgeWidth) {
    additionalProperty.push({ '@type': 'PropertyValue', name: 'Ancho de puente', value: `${(product as any).bridgeWidth}mm` });
  }
  if ((product as any).templeLength) {
    additionalProperty.push({ '@type': 'PropertyValue', name: 'Largo de patilla', value: `${(product as any).templeLength}mm` });
  }
  if (additionalProperty.length > 0) {
    jsonLd.additionalProperty = additionalProperty;
  }

  if ((product as any).mpn) {
    jsonLd.mpn = (product as any).mpn;
  }
  if ((product as any).gender || (product as any).ageGroup) {
    jsonLd.audience = {
      '@type': 'PeopleAudience',
      ...( (product as any).gender ? { suggestedGender: (product as any).gender.toLowerCase() } : {} ),
      ...( (product as any).ageGroup ? { suggestedMinAge: (product as any).ageGroup === 'Adulto' ? 18 : 3 } : {} ),
    };
  }

  // BreadcrumbList JSON-LD
  const categorySlugMap: Record<string, { name: string; path: string }> = {
    'Receta': { name: 'Receta', path: '/receta' },
    'Sol': { name: 'Lentes de Sol', path: '/lentes-de-sol' },
  };
  const catInfo = categorySlugMap[product.category || 'Receta'] || categorySlugMap['Receta'];
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://www.atelieroptica.com.ar' },
      { '@type': 'ListItem', position: 2, name: catInfo.name, item: `https://www.atelieroptica.com.ar${catInfo.path}` },
      { '@type': 'ListItem', position: 3, name: product.model },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <ProductClient product={product} variants={variants} relatedProducts={relatedProducts} />
    </>
  );
}
