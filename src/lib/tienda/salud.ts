import { prisma } from '@/lib/db';

/**
 * Radiografía de la tienda: los números que dicen si está en condiciones de
 * recibir tráfico pago. SOLO LEE.
 *
 * POR QUÉ ESTO VIVE APARTE DE LA IA
 * El veredicto lo redacta un modelo, pero los números los cuenta el código. Si
 * al modelo se le pide que "revise la tienda" sin darle datos medidos, inventa:
 * dice "tenés pocas fotos" sin saber cuántas, o "el catálogo está bien" mirando
 * una muestra. Acá la IA INTERPRETA lo que este archivo MIDE, y por eso el
 * veredicto se puede discutir con datos en la mano.
 *
 * Cada métrica está elegida porque contesta una pregunta de venta concreta, no
 * porque sea fácil de contar. Si mañana se agrega una, que sea con esa vara.
 */

export interface SaludTienda {
  medidoEl: string;
  catalogo: {
    activos: number;
    conUnaSolaFoto: number;
    sinFoto: number;
    conTresOMasFotos: number;
    sinDescripcionUtil: number;
    publicadosSinStock: number;
    sinGenero: number;
  };
  precios: {
    bandas: { precio: number; productos: number; categorias: string[] }[];
    /** % del catálogo concentrado en el precio más repetido. Alto = catálogo plano. */
    concentracionMayorBanda: number;
    enOferta: number;
  };
  demanda: {
    checkoutsIniciados30d: number;
    checkoutsAbandonados30d: number;
    checkoutsRecuperados30d: number;
    ventasWeb30d: number;
    resenasDeProducto: number;
  };
  /** Lo que ya se sabe que está bien, para que la IA no lo "descubra" de nuevo. */
  yaResuelto: string[];
}

/** Una descripción de menos de esto no ayuda a decidir una compra de ticket alto. */
const DESCRIPCION_MINIMA = 120;

export async function medirSaludTienda(): Promise<SaludTienda> {
  const hace30 = new Date(Date.now() - 30 * 86_400_000);

  const [webProducts, sesiones, ventas, resenas] = await Promise.all([
    prisma.webProduct.findMany({
      where: { isActive: true },
      // `material` NO se pide: no existe en WebProduct (vive en los tags del
      // Product). Pedirlo hacía que la consulta cayera en un fallback silencioso
      // y devolviera "sin material" para los 113, o sea un dato inventado.
      select: {
        name: true,
        category: true,
        images: true,
        imageUrl: true,
        description: true,
        product: { select: { price: true, salePrice: true, stock: true, gender: true } },
      },
    }),
    prisma.checkoutSession.findMany({
      where: { createdAt: { gte: hace30 } },
      select: { status: true },
    }),
    prisma.order.count({
      where: { createdAt: { gte: hace30 }, isDeleted: false, orderType: 'SALE' },
    }),
    prisma.productReview.count({ where: { approved: true } }),
  ]);

  const fotosDe = (p: (typeof webProducts)[number]) => p.images?.length || (p.imageUrl ? 1 : 0);

  // Bandas de precio: es la forma de ver si hay ESCALERA o si el catálogo es
  // plano. Un catálogo donde el 70% vale lo mismo no deja elegir al cliente.
  const porPrecio = new Map<number, { productos: number; categorias: Set<string> }>();
  for (const p of webProducts) {
    const precio = p.product?.price || 0;
    if (!porPrecio.has(precio)) porPrecio.set(precio, { productos: 0, categorias: new Set() });
    const b = porPrecio.get(precio)!;
    b.productos++;
    if (p.category) b.categorias.add(p.category);
  }
  const bandas = [...porPrecio.entries()]
    .map(([precio, b]) => ({ precio, productos: b.productos, categorias: [...b.categorias] }))
    .sort((a, b) => a.precio - b.precio);

  const mayorBanda = Math.max(0, ...bandas.map((b) => b.productos));

  return {
    medidoEl: new Date().toISOString(),
    catalogo: {
      activos: webProducts.length,
      conUnaSolaFoto: webProducts.filter((p) => fotosDe(p) === 1).length,
      sinFoto: webProducts.filter((p) => fotosDe(p) === 0).length,
      conTresOMasFotos: webProducts.filter((p) => fotosDe(p) >= 3).length,
      sinDescripcionUtil: webProducts.filter((p) => (p.description?.length || 0) < DESCRIPCION_MINIMA).length,
      publicadosSinStock: webProducts.filter((p) => (p.product?.stock || 0) <= 0).length,
      sinGenero: webProducts.filter((p) => !p.product?.gender).length,
    },
    precios: {
      bandas,
      concentracionMayorBanda: webProducts.length
        ? Math.round((mayorBanda / webProducts.length) * 100)
        : 0,
      enOferta: webProducts.filter((p) => (p.product?.salePrice || 0) > 0).length,
    },
    demanda: {
      checkoutsIniciados30d: sesiones.length,
      // RECOVERED = compró después de un toque del recupero: no es un abandono.
      checkoutsAbandonados30d: sesiones.filter((s) => !['COMPLETED', 'FINALIZED', 'RECOVERED'].includes(s.status)).length,
      checkoutsRecuperados30d: sesiones.filter((s) => s.status === 'RECOVERED').length,
      ventasWeb30d: ventas,
      resenasDeProducto: resenas,
    },
    yaResuelto: [
      'El aviso "PREVENTA" se sacó de las fichas (agosto 2026).',
      'El catálogo mayorista dejó de ser público: ya no filtra precios netos.',
      'La medición está viva: GA4, Google Ads y el pixel de Meta, verificados en producción.',
      'El feed de productos para Meta funciona y se actualiza cada hora, sin errores.',
      'El bloque de reseñas se oculta mientras el producto no tenga ninguna.',
      'El cartel de descuento llamativo quedó reservado para ofertas reales, no para la condición de pago.',
    ],
  };
}
