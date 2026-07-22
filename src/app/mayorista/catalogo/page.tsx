import { Metadata } from 'next';
import Image from 'next/image';
import { prisma } from '@/lib/db';
import { rethrowUnlessBuild } from '@/lib/db-guard';
import { WHATSAPP_PHONE, WHOLESALE_MIN_PIECES } from '@/lib/constants';
import CatalogViewTracker from '@/components/Mayorista/CatalogViewTracker';

// Pedido a mano (Ishtar, 21/7): estas piezas van primero, en este orden.
const FEATURED_NAMES = ['Artemis', 'Teseo C4', 'Orión C1', 'Iris C3'];

// Página pública, pensada para abrirse desde el link que se manda por
// WhatsApp a los leads de /admin/opticas (ver DEFAULT_TPL ahí). Vive del
// catálogo real (mismo Product.wholesalePrice que cobra el checkout), así
// que nunca queda desactualizada como un PDF estático.
export const revalidate = 300;

export const metadata: Metadata = {
  // title.absolute: sin esto el layout root le agrega "| Atelier Óptica" y
  // rompe la marca del canal. El área mayorista es Cápsula Escarlata a secas.
  title: { absolute: 'Cápsula Escarlata · Catálogo Mayorista' },
  description:
    'Catálogo mayorista Cápsula Escarlata: armazones de diseño de autor con precios netos por unidad para ópticas.',
  robots: { index: false, follow: false }, // no es contenido para buscar: son precios netos B2B
  // openGraph/twitter/icons propios: sin esto se heredan los del layout root
  // (og:siteName "Atelier Óptica", og:image y favicon de Atelier) y el preview
  // del link en WhatsApp — el único canal por el que se manda — delata la marca.
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    siteName: 'Cápsula Escarlata',
    title: 'Cápsula Escarlata · Catálogo Mayorista',
    description: 'Armazones de diseño de autor con precios netos por unidad para ópticas.',
    images: [
      {
        url: '/images/editorial/filmmaker-frida.webp',
        width: 1200,
        height: 630,
        alt: 'Cápsula Escarlata',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cápsula Escarlata · Catálogo Mayorista',
    description: 'Armazones de diseño de autor con precios netos por unidad para ópticas.',
    images: ['/images/editorial/filmmaker-frida.webp'],
  },
  // Ícono neutro (monograma CE inline): pisa el logo PWA de Atelier del root.
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%23111'/%3E%3Ctext x='16' y='22' font-family='Georgia,serif' font-size='14' fill='%23c8a55c' text-anchor='middle'%3ECE%3C/text%3E%3C/svg%3E",
  },
};

type WholesaleProduct = {
  id: string;
  name: string;
  imageUrl: string | null;
  category: string;
  wholesalePrice: number;
};

async function getWholesaleCatalog(): Promise<WholesaleProduct[]> {
  try {
    const rows = await prisma.webProduct.findMany({
      where: {
        isActive: true,
        product: { publishToWholesale: true, wholesalePrice: { gt: 0 } },
      },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        category: true,
        product: { select: { wholesalePrice: true } },
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      imageUrl: r.imageUrl,
      category: r.category,
      wholesalePrice: r.product.wholesalePrice,
    }));
  } catch (error) {
    // Falla de DB ≠ catálogo vacío: en runtime relanzamos para no cachear
    // (ISR) una página sin productos a los prospectos que reciben el link.
    rethrowUnlessBuild(error, 'MayoristaCatalogo');
    return [];
  }
}

export default async function CatalogoMayoristaPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await searchParams;
  const leadId = typeof resolvedParams.lead === 'string' ? resolvedParams.lead : null;

  const products = await getWholesaleCatalog();
  const featured = FEATURED_NAMES
    .map((name) => products.find((p) => p.name === name))
    .filter((p): p is WholesaleProduct => Boolean(p));
  const featuredIds = new Set(featured.map((p) => p.id));
  const grouped = products
    .filter((p) => !featuredIds.has(p.id))
    .reduce<Record<string, WholesaleProduct[]>>((acc, p) => {
      (acc[p.category] ??= []).push(p);
      return acc;
    }, {});

  const waMsg = encodeURIComponent(
    'Hola! Vi el catálogo mayorista de Cápsula Escarlata y quiero pedir mi usuario.',
  );
  const waLink = `https://wa.me/${WHATSAPP_PHONE}?text=${waMsg}`;

  return (
    <div className="min-h-screen bg-[#faf8f5] dark:bg-[#1c1917] pb-20">
      <CatalogViewTracker leadId={leadId} />

      <header className="bg-[#141110] text-[#faf8f5] px-6 py-14 md:py-20">
        <div className="max-w-5xl mx-auto grid lg:grid-cols-5 gap-10 items-center">
          <div className="lg:col-span-3">
            <p className="text-xs tracking-[0.2em] uppercase text-[#c8a55c] mb-4">
              Cápsula Escarlata
            </p>
            <h1 className="font-serif text-4xl md:text-5xl font-bold mb-4">
              Diseño de autor <span className="italic text-[#c8a55c]">para tu óptica</span>
            </h1>
            <p className="text-[#d8d3cb] max-w-xl mb-8">
              Armazones de diseño en acetato italiano, metal y titanio.
              Precios netos por unidad, pensados para revender.
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <StatPill label={`Mínimo ${WHOLESALE_MIN_PIECES} piezas`} sub="por pedido, mezclás modelos" />
              <StatPill label="Precios netos" sub="pensados para revender" />
              <StatPill label="Stock disponible" sub="entrega inmediata" />
              <StatPill label={`${products.length || '—'} modelos`} sub="disponibles hoy" />
              <StatPill
                label="Ficha completa"
                sub="foto y datos de cada pieza, listas para el carrito"
                className="col-span-2"
              />
            </div>
          </div>
          {/* Pieza editorial de la colección — abre con impacto de marca. */}
          <div className="hidden lg:block lg:col-span-2 relative aspect-[4/5] rounded-2xl overflow-hidden">
            <Image
              src="/images/editorial/filmmaker-frida.webp"
              alt="Armazón de diseño de autor — carey oversized, colección Cápsula Escarlata"
              fill
              sizes="(min-width: 1024px) 30vw, 0px"
              className="object-cover"
              priority
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
              <p className="text-xs uppercase tracking-widest text-[#c8a55c]">La Frida · S. XX</p>
              <p className="text-xs text-[#d8d3cb]">Carey oversized · edición de autor</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-14">
        {products.length === 0 ? (
          <p className="text-center text-[#9e7f65] py-20">
            El catálogo está actualizándose. Escribinos por WhatsApp y te lo pasamos directo.
          </p>
        ) : (
          <>
            {featured.length > 0 && (
              <section className="mb-14">
                <h2 className="font-serif text-2xl font-bold text-[#433831] dark:text-[#fafaf9] mb-6 border-b border-[#e8e2db] dark:border-[#44403c] pb-3">
                  Destacados
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                  {featured.map((p) => (
                    <ProductCard key={p.id} product={p} badge="Destacado" />
                  ))}
                </div>
              </section>
            )}
            {Object.entries(grouped).map(([category, items]) => (
              <section key={category} className="mb-14">
                <h2 className="font-serif text-2xl font-bold text-[#433831] dark:text-[#fafaf9] mb-6 border-b border-[#e8e2db] dark:border-[#44403c] pb-3">
                  {category}{' '}
                  <span className="text-sm font-sans font-normal text-[#9e7f65]">
                    ({items.length})
                  </span>
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                  {items.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              </section>
            ))}

            {/* Cierre de venta: invita a pedir el usuario. Deja explícito que
                el alta la hacemos nosotros (no hay auto-registro): la óptica
                pide, un admin crea la cuenta. */}
            <section className="mt-16 border-t border-[#e8e2db] dark:border-[#44403c] pt-14 text-center">
              <p className="text-xs tracking-[0.2em] uppercase text-[#c8a55c] mb-3">Cómo empezar</p>
              <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#433831] dark:text-[#fafaf9] mb-3">
                Pedí tu usuario y comprá con estos precios
              </h2>
              <p className="text-[#6b5d52] dark:text-[#a89e91] max-w-xl mx-auto mb-10">
                El acceso es exclusivo para ópticas. Nos escribís, te creamos tu usuario
                y entrás al portal a comprar online con tus precios netos, cuando quieras.
              </p>
              <div className="grid sm:grid-cols-3 gap-5 max-w-3xl mx-auto mb-10 text-left">
                <Step n="1" t="Escribinos por WhatsApp" d="Te atiende una persona, no un bot." />
                <Step n="2" t="Te creamos tu usuario" d="Acceso exclusivo para tu óptica." />
                <Step n="3" t="Comprás online 24/7" d="Tus precios netos, desde 10 piezas." />
              </div>
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-[#c8a55c] text-[#141110] font-semibold px-8 py-3.5 rounded-full text-sm hover:bg-[#d6bfae] transition-colors"
              >
                Pedí tu usuario mayorista
              </a>
            </section>
          </>
        )}
      </main>

      <div className="fixed bottom-0 inset-x-0 bg-[#141110] text-[#faf8f5] px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.2)]">
        <p className="text-sm text-center sm:text-left">
          ¿Te interesa vender esta colección? Pedí tu usuario y accedé con tus precios.
        </p>
        <div className="shrink-0 flex items-center gap-4">
          <a
            href="/mayorista/ingreso"
            className="text-sm text-[#c8a55c] hover:underline whitespace-nowrap"
          >
            Ya tengo usuario
          </a>
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#c8a55c] text-[#141110] font-semibold px-5 py-2.5 rounded-full text-sm hover:bg-[#d6bfae] transition-colors"
          >
            Pedí tu usuario mayorista
          </a>
        </div>
      </div>
    </div>
  );
}

function ProductCard({ product, badge }: { product: WholesaleProduct; badge?: string }) {
  return (
    <div className="group relative rounded-xl overflow-hidden border border-[#e8e2db] dark:border-[#44403c] bg-white dark:bg-[#292524]">
      {badge && (
        <span className="absolute top-2 left-2 z-10 bg-[#141110] text-[#c8a55c] text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full">
          {badge}
        </span>
      )}
      <div className="relative aspect-square bg-[#f3efe9]">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-contain mix-blend-multiply p-3 group-hover:scale-105 transition-transform"
            unoptimized={product.imageUrl.startsWith('data:')}
          />
        ) : null}
      </div>
      <div className="p-3">
        <p className="font-medium text-sm text-[#433831] dark:text-[#fafaf9] truncate">
          {product.name}
        </p>
        <p className="text-xs text-[#9e7f65] mb-1">{product.category}</p>
        <p className="font-bold text-[#8a6d3b] dark:text-[#c8a55c]">
          ${product.wholesalePrice.toLocaleString('es-AR')}{' '}
          <span className="font-normal text-xs">neto/u</span>
        </p>
      </div>
    </div>
  );
}

function StatPill({
  label,
  sub,
  className,
}: {
  label: string;
  sub: string;
  className?: string;
}) {
  return (
    <div className={`border border-[#3a332c] rounded-lg px-3 py-2.5 ${className ?? ''}`}>
      <p className="font-semibold text-[#faf8f5]">{label}</p>
      <p className="text-[#a89e91] text-xs">{sub}</p>
    </div>
  );
}

function Step({ n, t, d }: { n: string; t: string; d: string }) {
  return (
    <div className="rounded-xl border border-[#e8e2db] dark:border-[#44403c] bg-white dark:bg-[#292524] p-5">
      <div className="w-8 h-8 rounded-full bg-[#c8a55c] text-[#141110] font-bold flex items-center justify-center mb-3">
        {n}
      </div>
      <p className="font-semibold text-[#433831] dark:text-[#fafaf9] mb-1">{t}</p>
      <p className="text-sm text-[#6b5d52] dark:text-[#a89e91]">{d}</p>
    </div>
  );
}
