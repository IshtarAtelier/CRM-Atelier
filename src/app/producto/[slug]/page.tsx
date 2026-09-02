import { Metadata } from 'next';
import { cache } from 'react';
import { notFound, permanentRedirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { rethrowUnlessBuild } from '@/lib/db-guard';
import { getProductAttributes } from '@/utils/product-controllers';
import { parseFrameSpecs, pickDescriptiveAlt } from '@/lib/catalog/frame-specs';
import { normalizarTexto } from '@/lib/text-normalize';

export const revalidate = 300;
import { ProductClient } from './ProductClient';
import { StorefrontFooter } from '@/components/Storefront/StorefrontFooter';
import { resolveStorageUrl } from "@/lib/utils/storage";
import { armarNombreVisible, baseDelNombre } from '@/lib/catalog/display-name';

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
      // Nombre visible: sin sufijo de color si este estelar tiene una sola
      // variante activa (misma regla que la grilla — ver display-name.ts).
      const nombreCrudo = webProduct.name || webProduct.product.model || '';
      const base = baseDelNombre(nombreCrudo);
      let nombreVisible = nombreCrudo;
      if (base && base !== nombreCrudo) {
        // startsWith es un pre-filtro barato; la igualdad real de estelar la
        // decide baseDelNombre ("Gaia" no debe contar a "Gaiana C1").
        const candidatos = await prisma.webProduct.findMany({
          where: {
            isActive: true,
            name: { startsWith: base, mode: 'insensitive' },
            product: { publishToWeb: true },
          },
          select: { name: true },
        });
        const nombres = candidatos
          .map((c) => c.name || '')
          .filter((n) => baseDelNombre(n).toLowerCase() === base.toLowerCase());
        nombreVisible = armarNombreVisible(nombres.length > 0 ? nombres : [nombreCrudo])(nombreCrudo);
      }
      return {
        id: webProduct.product.id,
        brand: webProduct.product.brand || 'ATELIER',
        model: nombreVisible,
        modelCode: webProduct.product.model,
        price: webProduct.product.price,
        salePrice: webProduct.product.salePrice,
        // Sin precio neto en el HTML: la ficha es ISR y la sirve el mismo cache
        // para cualquiera. La óptica logueada lo pide después desde el cliente
        // (/api/store/wholesale-prices, que exige sesión).
        wholesalePrice: 0,
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
      wholesalePrice: 0, // idem: el precio neto no viaja en el HTML público
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

/**
 * Pre-renderiza las fichas activas en el build (A-02, auditoría del 2/9/2026).
 *
 * QUÉ PROBLEMA RESUELVE
 * Medido en producción: la PRIMERA visita del día a una ficha tardaba 10,7 s
 * en el primer byte y 21,8 s en cargar. La misma ficha en caliente: 0,65 s y
 * 0,81 s. Todo el delta es servidor — `revalidate = 300` ya estaba, pero sin
 * `generateStaticParams` la primera persona que pide cada slug paga el render
 * entero (arranque en frío + consulta a la base). Con 106 modelos, siempre hay
 * alguien pagando esos 10 segundos, y es justo quien viene de un anuncio.
 *
 * Ahora las páginas salen ya construidas del build y el visitante recibe HTML
 * cacheado; `revalidate` sigue refrescando precio y stock cada 5 minutos.
 *
 * SI LA BASE NO ESTÁ EN EL BUILD, no se rompe: devuelve [] y las fichas se
 * generan on-demand como antes (mismo criterio que `rethrowUnlessBuild`). Un
 * deploy nunca puede fallar porque la base no contestó.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    // El slug vive en WebProduct, no en Product: es la entidad de la tienda
    // (la misma que consulta getProduct acá arriba).
    const publicados = await prisma.webProduct.findMany({
      where: { isActive: true },
      select: { slug: true },
    });
    return publicados
      .filter(p => Boolean(p.slug))
      .map(p => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

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

  // getProduct ya resuelve imagenesCatalogo priorizando la galería web.
  const rawImage = product.imagenesCatalogo?.[0] || '';
  const imageUrl = rawImage
    ? resolveStorageUrl(rawImage)
    : ((product as any).mockImage || '/images/og-image.jpg');

  // Un data-URI no sirve como og:image (los crawlers de WhatsApp/Facebook solo
  // siguen URLs); en ese caso mostramos la imagen genérica en vez de armar una
  // URL inválida concatenándole el dominio.
  const SITE = 'https://atelieroptica.com.ar';
  const absoluteImageUrl = imageUrl.startsWith('data:')
    ? `${SITE}/images/og-image.jpg`
    : imageUrl.startsWith('http')
      ? imageUrl
      : `${SITE}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;

  // Los crawlers de WhatsApp y Facebook NO renderizan AVIF: la ficha compartida
  // por WhatsApp —el canal donde se cierra la venta de ticket alto— salía sin
  // foto. Cada AVIF de public/images/products tiene su copia .webp al lado
  // (verificado 9/8: 7 de 7), que sí se previsualiza. La página sigue sirviendo
  // AVIF por next/image; esto cambia solo la imagen de la preview.
  const ogImageUrl = absoluteImageUrl.replace(/\.avif(\?|$)/i, '.webp$1');

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
          url: ogImageUrl,
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
      images: [ogImageUrl],
    },
  };
}

// ---------------------------------------------------------------------------
// Recomendados por afinidad
//
// Antes esta sección traía los 4 primeros destacados de la categoría ordenados
// por fecha: siempre los MISMOS cuatro armazones, mirara lo que mirara el
// visitante. Alguien viendo un acetato cat-eye femenino terminaba con un
// titanio masculino recomendado.
//
// El catálogo no tiene columnas de forma ni material (ver frame-specs.ts): se
// puntúa con los mismos datos que ya usa la ficha para describirse a sí misma.
// ---------------------------------------------------------------------------

// La forma y el material son lo que se ve en la foto: dos cat-eye de acetato
// "combinan" aunque sean de modelos distintos. El género pesa menos porque la
// mitad del catálogo es Unisex y no discrimina nada. Un género OPUESTO resta:
// es exactamente el error que se está corrigiendo, no alcanza con no premiarlo.
const PESO_FORMA = 4;
const PESO_MATERIAL = 3;
const PESO_GENERO = 2;
const PESO_GENERO_UNISEX = 1;
const CASTIGO_GENERO_OPUESTO = -3;
// Desempate por rango de precio: quien mira un armazón de $60.000 no está
// buscando uno de $250.000. Es una comparación entre precios de lista, no un
// cálculo de plata (eso vive solo en PricingService).
const PESO_PRECIO_CERCANO = 1;
const BANDA_PRECIO = 0.4;

const CANTIDAD_RECOMENDADOS = 4;
// Los candidatos se puntúan en memoria, así que se traen todos los publicados
// (hoy ~110). El tope está para que la ficha no empiece a bajarse la tienda
// entera el día que el catálogo crezca.
const POOL_RECOMENDADOS = 200;

// La forma puede venir compuesta ("Cuadrado, XL"): se compara por tokens para
// que un XL matchee con un "Cuadrado, XL" en vez de fallar por el string entero.
function comparteForma(a?: string | null, b?: string | null): boolean {
  const tokens = (valor?: string | null) =>
    normalizarTexto(valor).split(/[,/]+/).map(t => t.trim()).filter(Boolean);
  const ta = tokens(a);
  const tb = tokens(b);
  return ta.length > 0 && tb.length > 0 && ta.some(t => tb.includes(t));
}

// Mismo orden de prioridad que usa la ficha para sí misma más abajo: el alt de
// la foto es el dato REAL y le gana a getProductAttributes(), que adivina
// "Metal" y "Cuadrado" por descarte cuando no reconoce el código de modelo.
function specsDeCandidato(candidato: {
  imageAlts: string[];
  product: { model: string | null; seoTags: string | null };
}) {
  const delAlt = parseFrameSpecs(pickDescriptiveAlt(candidato.imageAlts));
  const heuristica = getProductAttributes(candidato.product.model, candidato.product.seoTags);
  return {
    material: delAlt.material || heuristica.material,
    shape: delAlt.shape || heuristica.shape,
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
    // LEGACY_SLUGS): 404 REAL, que es lo que Google espera de una ficha que se
    // dio de baja. Redirigir a /tienda parecía más amable pero Google lo cuenta
    // como soft-404 igual (redirect a página genérica), y encima acá ni siquiera
    // llegaba a ser un 307: como la ruta streamea, el status ya salía 200 y el
    // salto terminaba en un <meta refresh> — el peor de los dos mundos.
    // El visitante no queda en la nada: not-found.tsx de esta ruta ofrece las
    // categorías. getProduct ya relanza ante fallo de DB (rethrowUnlessBuild),
    // así que null == genuinamente inexistente, nunca un problema transitorio.
    notFound();
  }

  // Get material from product attributes
  const { material, shape: shapeHeuristica } = getProductAttributes((product as any).modelCode || product.model, (product as any).seoTags);

  // Color, material y forma REALES, sacados del alt de la foto (única fuente
  // del color en el catálogo; ver frame-specs.ts). El material del alt le gana
  // al de getProductAttributes(), que adivina "Metal" por descarte. Son los
  // mismos datos que ya publica el feed de Merchant Center: la ficha no puede
  // decir menos que el aviso que trajo al visitante.
  const specs = parseFrameSpecs(pickDescriptiveAlt((product as any).imageAlts));

  // Modelo base ("HY238014" de "HY238014 C4-1"): agrupa los colores del MISMO
  // armazón. Lo usan las dos consultas de abajo — variantes para juntarlos y
  // recomendados para no repetirlos. Un base de 1 o 2 caracteres matchearía
  // media tienda, así que en ese caso vale null.
  const baseModelCrudo = product.modelCode
    ? product.modelCode.split(/[\s-]/)[0]
    : product.model?.split(/[\s-]/)[0];
  const baseModel = baseModelCrudo && baseModelCrudo.length > 2 ? baseModelCrudo : null;

  // Las dos consultas secundarias (variantes y relacionados) no dependen entre
  // sí: van en paralelo. Antes eran secuenciales y sumaban sus latencias al
  // TTFB, que ahora pesa más porque la ruta ya no streamea (ver nota del 404).
  const variantsPromise = (async (): Promise<any[]> => {
    try {
      if (!baseModel) return [];
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

      return siblings
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
    } catch (err) {
      console.error("Error fetching variants:", err);
      return [];
    }
  })();

  const relatedPromise = (async (): Promise<any[]> => {
    try {
      // Forma, material y género de LO QUE SE ESTÁ MIRANDO: es contra esto que
      // se puntúa. El alt de la foto manda; si no lo tiene, la heurística.
      const shapeActual = specs.shape || shapeHeuristica;
      const materialActual = specs.material || material;
      const generoActual = normalizarTexto((product as any).gender);
      const precioActual = product.price || 0;

      // Sin filtro de categoría en el WHERE: la categoría ordena (abajo), no
      // excluye. Así una ficha de Sol, que tiene pocos hermanos, completa los
      // cuatro lugares en vez de quedarse con dos.
      const candidatos = await prisma.webProduct.findMany({
        where: {
          isActive: true,
          productId: { not: product.id },
          product: {
            publishToWeb: true,
            // Recomendar lo que no se puede comprar es regalar el clic.
            stock: { gt: 0 }
          }
        },
        // select explícito: la fila entera de Product no entra acá y además
        // contra producción devolverla revienta (el schema local va adelantado).
        select: {
          slug: true,
          name: true,
          images: true,
          imageAlts: true,
          category: true,
          product: {
            select: {
              id: true,
              brand: true,
              model: true,
              price: true,
              salePrice: true,
              wholesalePrice: true,
              gender: true,
              seoTags: true,
              imagenesCatalogo: true
            }
          }
        },
        // Este orden es el desempate final: a igual afinidad gana el destacado
        // y después el más nuevo (el criterio que antes era el único).
        orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
        take: POOL_RECOMENDADOS
      });

      const puntuados = candidatos
        // Los otros colores del mismo armazón ya están arriba en el selector de
        // variantes: repetirlos acá quema los cuatro lugares en algo ya visible.
        .filter(c => !baseModel || !normalizarTexto(c.product.model).startsWith(normalizarTexto(baseModel)))
        .map(c => {
          const specsCandidato = specsDeCandidato(c);
          let puntos = 0;

          if (comparteForma(specsCandidato.shape, shapeActual)) puntos += PESO_FORMA;
          if (materialActual && normalizarTexto(specsCandidato.material) === normalizarTexto(materialActual)) {
            puntos += PESO_MATERIAL;
          }

          const genero = normalizarTexto(c.product.gender);
          if (genero && generoActual) {
            if (genero === generoActual) puntos += PESO_GENERO;
            else if (genero === 'unisex' || generoActual === 'unisex') puntos += PESO_GENERO_UNISEX;
            else puntos += CASTIGO_GENERO_OPUESTO;
          }

          if (precioActual > 0 && c.product.price > 0 &&
              Math.abs(c.product.price - precioActual) <= precioActual * BANDA_PRECIO) {
            puntos += PESO_PRECIO_CERCANO;
          }

          return { c, puntos, mismaCategoria: c.category === product.category };
        });

      // La categoría no compite con el resto de las señales: manda. Un anteojo
      // de sol perfecto en forma y material no debería colarse en la ficha de
      // un armazón de receta mientras haya armazones de receta para mostrar.
      // Array.sort es estable, así que el orderBy de la base sobrevive el empate.
      puntuados.sort((a, b) =>
        Number(b.mismaCategoria) - Number(a.mismaCategoria) || b.puntos - a.puntos
      );

      // Un lugar por armazón. Como los colores de un mismo modelo puntúan casi
      // idéntico, sin esto la fila salía con "Gala C1" y "Gala C8" al lado —dos
      // fotos casi iguales— en vez de cuatro opciones distintas.
      const elegidos: typeof puntuados = [];
      const basesUsadas = new Set<string>();
      for (const candidato of puntuados) {
        if (elegidos.length >= CANTIDAD_RECOMENDADOS) break;
        const base = normalizarTexto(candidato.c.product.model).split(/[\s-]/)[0];
        if (base.length > 2) {
          if (basesUsadas.has(base)) continue;
          basesUsadas.add(base);
        }
        elegidos.push(candidato);
      }
      // Si el catálogo no da para cuatro modelos distintos, se completa con lo
      // que quedó afuera: mejor un color repetido que un hueco en la grilla.
      if (elegidos.length < CANTIDAD_RECOMENDADOS) {
        for (const candidato of puntuados) {
          if (elegidos.length >= CANTIDAD_RECOMENDADOS) break;
          if (!elegidos.includes(candidato)) elegidos.push(candidato);
        }
      }

      return elegidos.map(({ c }) => ({
        id: c.product.id,
        brand: c.product.brand || 'ATELIER',
        model: c.name || c.product.model || '',
        price: c.product.price,
        salePrice: c.product.salePrice,
        // 0 y no el valor real: esta página es ISR, o sea que el MISMO HTML se
        // le sirve a todo el mundo. El precio neto mayorista viajando acá era
        // una de las puertas por las que se filtraba. Quien tiene derecho a
        // verlo lo pide después, con sesión, al endpoint protegido.
        wholesalePrice: 0,
        slug: c.slug,
        imageUrl: c.images.length > 0 ? c.images[0] : (c.product.imagenesCatalogo?.[0] || '/images/placeholder.svg')
      }));
    } catch (err) {
      console.error("Error fetching related products:", err);
      return [];
    }
  })();

  const [variants, relatedProducts] = await Promise.all([variantsPromise, relatedPromise]);

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
      <ProductClient
        product={{
          ...product,
          material: specs.material || material,
          color: specs.color,
          shape: specs.shape,
        }}
        variants={variants}
        similarProducts={relatedProducts}
        footer={<StorefrontFooter />}
      />
    </>
  );
}
