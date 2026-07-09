import { Metadata } from 'next';
import { cache } from 'react';
import { redirect, permanentRedirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { rethrowUnlessBuild } from '@/lib/db-guard';
import { getProductAttributes } from '@/utils/product-controllers';

export const revalidate = 300;
import { ProductClient } from './ProductClient';
import { StorefrontFooter } from '@/components/Storefront/StorefrontFooter';
import { resolveStorageUrl } from "@/lib/utils/storage";

// Slugs históricos de productos renombrados (julio 2026): la URL vieja redirige a la definitiva
const LEGACY_SLUGS: Record<string, string> = {
  'poseidon': 'dionisio-c2',
  'venus-c4': 'hera-c4',
  'clip-on-roma-7036-c2-lentes-de-sol-armazon': 'clip-on-genova-7036-c2-lentes-de-sol-armazon',
};

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

// cache(): la misma request llama getProduct dos veces (generateMetadata + la
// página). Memoizamos para no pegarle dos veces a la base por el mismo slug.
const getProduct = cache(async (slug: string) => {
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
        brand: webProduct.product.brand || 'ATELIER',
        model: webProduct.name || webProduct.product.model || '',
        modelCode: webProduct.product.model,
        price: webProduct.product.price,
        salePrice: webProduct.product.salePrice,
        wholesalePrice: webProduct.product.wholesalePrice,
        stock: webProduct.product.stock,
        imagenesCatalogo: webProduct.images.length > 0 ? webProduct.images : webProduct.product.imagenesCatalogo,
        imageAlts: webProduct.images.length > 0 ? webProduct.imageAlts : [],
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
      brand: product.brand || 'ATELIER',
      model: product.model || 'Sin modelo',
      modelCode: product.model,
      price: product.price,
      salePrice: product.salePrice,
      wholesalePrice: product.wholesalePrice,
      stock: product.stock,
      imagenesCatalogo: product.imagenesCatalogo,
      imageAlts: [],
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
    // Falla de DB ≠ producto inexistente: en runtime lanzamos para no cachear
    // un redirect a /tienda sobre una página de producto que sí existe.
    rethrowUnlessBuild(error, 'Producto');
    return null;
  }
});

// Saca sufijos tipo "| Atelier" / "| Atelier Óptica" que ya vienen en el seoTitle,
// para no duplicar la marca cuando armamos el title final
function stripBrandSuffix(title: string) {
  return title.replace(/(\s*\|\s*Atelier[^|]*)+$/i, '').trim();
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
  const baseTitle = stripBrandSuffix((product as any).seoTitle || product.model || product.brand);
  const title = `${baseTitle} | Atelier Óptica Córdoba`;
  const rawDescription = (product as any).seoDescription?.trim() || product.description?.trim() || `Llevate los anteojos ${product.category} ${product.brand} ${product.model} en Atelier Óptica Córdoba. Diseño premium. Comprá online con envío a todo el país y 6 cuotas sin interés.`;
  const plainDescription = rawDescription.replace(/\s+/g, ' ').trim();
  const description = plainDescription.length > 160 ? `${plainDescription.slice(0, 157).trimEnd()}…` : plainDescription;

  const imageUrl = product.imagenesCatalogo && product.imagenesCatalogo.length > 0 
    ? resolveStorageUrl(product.imagenesCatalogo[0])
    : ((product as any).mockImage || '/images/og-image.jpg');

  const absoluteImageUrl = imageUrl.startsWith('http') ? imageUrl : `https://atelieroptica.com.ar${imageUrl}`;

  return {
    // absolute: evita que el template del layout ("%s | Atelier Óptica") vuelva a agregar la marca
    title: { absolute: title },
    description,
    // El producto DEMO tiene un Offer falso InStock: no debe indexarse.
    robots: product.slug === 'atelier-carey-vintage' ? { index: false, follow: false } : undefined,
    alternates: {
      canonical: `https://atelieroptica.com.ar/producto/${product.slug}`,
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
  if (LEGACY_SLUGS[resolvedParams.slug]) {
    permanentRedirect(`/producto/${LEGACY_SLUGS[resolvedParams.slug]}`);
  }
  const product = await getProduct(resolvedParams.slug);

  if (!product) {
    // Producto discontinuado que ya no existe (y no es un renombrado conocido de
    // LEGACY_SLUGS). En vez de servir un soft-404 (HTTP 200 con "Producto no
    // encontrado" — que Google penaliza y desperdicia crawl), redirigimos a la
    // categoría más afín para no perder al visitante ni ensuciar el índice.
    // Redirect TEMPORAL (307), no permanente: si el producto se reactiva más
    // adelante, el link vuelve a funcionar sin quedar "pegado" en cachés/Google.
    // getProduct ya relanza ante fallo de DB (rethrowUnlessBuild), así que acá
    // null == genuinamente inexistente, nunca un problema transitorio de base.
    const s = resolvedParams.slug.toLowerCase();
    const esSol = s.includes('lentes-de-sol') || s.includes('sunglass');
    redirect(esSol ? '/lentes-de-sol' : '/tienda');
  }

  // Get material from product attributes
  const { material } = getProductAttributes((product as any).modelCode || product.model, (product as any).seoTags);

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
          const { material: siblingMaterial } = getProductAttributes(s.product.model, s.product.seoTags);
          return siblingMaterial === material;
        })
        .map(s => {
          const modelName = s.product.model || '';
          const colorMatch = modelName.match(/\b(C\d+[-]?\d*)\b/i) || modelName.match(/\(([^)]+)\)/);
          const colorName = colorMatch ? colorMatch[1] : modelName.replace(baseModel, '').trim();
          return {
            slug: s.slug,
            colorCode: colorName || 'Único',
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
        productId: { not: product.id },
        product: { publishToWeb: true }
      },
      include: { product: true },
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
      take: 4
    });
    relatedProducts = siblings.map(wp => ({
      id: wp.product.id,
      brand: wp.product.brand || 'ATELIER',
      model: wp.name || wp.product.model || '',
      price: wp.product.price,
      salePrice: wp.product.salePrice,
      wholesalePrice: wp.product.wholesalePrice,
      slug: wp.slug,
      imageUrl: wp.images.length > 0 ? wp.images[0] : (wp.product.imagenesCatalogo?.[0] || '/images/placeholder.svg')
    }));
  } catch (err) {
    console.error("Error fetching related products:", err);
  }

  // Resolve all product images to absolute URLs
  const resolveAbsolute = (url: string) => {
    const resolved = resolveStorageUrl(url);
    return resolved.startsWith('http') ? resolved : `https://atelieroptica.com.ar${resolved}`;
  };

  const allImages = product.imagenesCatalogo && product.imagenesCatalogo.length > 0
    ? product.imagenesCatalogo.map(resolveAbsolute)
    : [`https://atelieroptica.com.ar${(product as any).mockImage || '/images/og-image.jpg'}`];

  // Extract color code from model name (e.g., "C1", "C2", "GLD")
  const colorMatch = product.model?.match(/\(([^)]+)\)/) || product.model?.match(/\b(C\d+)\b/i);
  const colorCode = colorMatch ? colorMatch[1] : undefined;

  // Vigencia del precio para el Offer (Google la pide); se renueva ~45 días.
  const priceValidUntil = new Date(Date.now() + 1000 * 60 * 60 * 24 * 45).toISOString().slice(0, 10);

  // Generar JSON-LD (Schema.org para Google Shopping / SEO)
  const jsonLd: any = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: stripBrandSuffix((product as any).seoTitle || `${product.brand} ${product.model}`),
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
      url: `https://atelieroptica.com.ar/producto/${product.slug}`,
      priceCurrency: 'ARS',
      price: ((product as any).salePrice != null && (product as any).salePrice > 0 && (product as any).salePrice < product.price) ? (product as any).salePrice : product.price,
      availability: (product.stock !== undefined && product.stock > 0) || product.slug === 'atelier-carey-vintage' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      priceValidUntil,
      seller: {
        '@type': 'Organization',
        name: 'Atelier Óptica',
      },
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'AR',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 30,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/FreeReturn',
      },
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: { '@type': 'MonetaryAmount', value: 0, currency: 'ARS' },
        shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'AR' },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 2, unitCode: 'DAY' },
          transitTime: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 7, unitCode: 'DAY' },
        },
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
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://atelieroptica.com.ar' },
      { '@type': 'ListItem', position: 2, name: catInfo.name, item: `https://atelieroptica.com.ar${catInfo.path}` },
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
      <ProductClient product={{ ...product, material }} variants={variants} similarProducts={relatedProducts} footer={<StorefrontFooter />} />
    </>
  );
}
