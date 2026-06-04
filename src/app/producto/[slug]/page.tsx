import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';

export const revalidate = 300;
import { ProductClient } from './ProductClient';

// Constante para el producto demo
const DEMO_PRODUCT = {
  id: "atelier-carey-vintage",
  brand: "ATELIER",
  model: "9030 (GLD)",
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

  // 1) Intentar por WebProduct.slug
  const webProduct = await prisma.webProduct.findUnique({
    where: { slug },
    include: { product: true }
  });

  if (webProduct && webProduct.isActive) {
    return {
      id: webProduct.product.id,
      brand: webProduct.product.brand || 'Atelier',
      model: webProduct.product.model || webProduct.name,
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
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const product = await getProduct(resolvedParams.slug);

  if (!product) {
    return {
      title: 'Producto no encontrado | Atelier Óptica',
    };
  }

  // Generación automática del "mensajito" SEO si no tiene descripción manual
  const title = (product as any).seoTitle || `${product.brand} ${product.model} | Atelier Óptica Córdoba`;
  const description = (product as any).seoDescription || product.description || `Llevate los anteojos ${product.category} ${product.brand} ${product.model} en Atelier Óptica Córdoba. Diseño premium. Comprá online con envío a todo el país y 6 cuotas sin interés.`;
  
  const imageUrl = product.imagenesCatalogo && product.imagenesCatalogo.length > 0 
    ? `/api/storage/view?key=${encodeURIComponent(product.imagenesCatalogo[0])}` 
    : ((product as any).mockImage || '/images/og-image.jpg');

  const absoluteImageUrl = imageUrl.startsWith('http') ? imageUrl : `https://www.atelieroptica.com.ar${imageUrl}`;

  return {
    title,
    description,
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
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const product = await getProduct(resolvedParams.slug);

  if (!product) {
    notFound();
  }

  // Generar JSON-LD (Schema.org para Google Shopping / SEO)
  const jsonLd: any = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: (product as any).seoTitle || `${product.brand} ${product.model}`,
    image: product.imagenesCatalogo && product.imagenesCatalogo.length > 0 
      ? `https://www.atelieroptica.com.ar/api/storage/view?key=${encodeURIComponent(product.imagenesCatalogo[0])}` 
      : `https://www.atelieroptica.com.ar${(product as any).mockImage || '/images/og-image.jpg'}`,
    description: (product as any).seoDescription || product.description || `Anteojos ${product.category} ${product.brand} ${product.model}.`,
    brand: {
      '@type': 'Brand',
      name: product.brand,
    },
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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductClient product={product} />
    </>
  );
}
