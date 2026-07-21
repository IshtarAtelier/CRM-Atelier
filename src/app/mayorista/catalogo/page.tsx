import { Metadata } from 'next';
import Image from 'next/image';
import { prisma } from '@/lib/db';
import { rethrowUnlessBuild } from '@/lib/db-guard';
import { WHATSAPP_PHONE, WHOLESALE_MIN_PIECES } from '@/lib/constants';
import CatalogViewTracker from '@/components/Mayorista/CatalogViewTracker';

// Página pública, pensada para abrirse desde el link que se manda por
// WhatsApp a los leads de /admin/opticas (ver DEFAULT_TPL ahí). Vive del
// catálogo real (mismo Product.wholesalePrice que cobra el checkout), así
// que nunca queda desactualizada como un PDF estático.
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Canal Mayorista para Ópticas',
  description:
    'Catálogo mayorista de Atelier Óptica: armazones de diseño con precios netos por unidad para ópticas de Córdoba y el interior.',
  robots: { index: false, follow: false }, // no es contenido para buscar: son precios netos B2B
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
  const grouped = products.reduce<Record<string, WholesaleProduct[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  const waMsg = encodeURIComponent(
    'Hola! Vi el catálogo mayorista de Atelier Óptica y quiero pedir mi usuario.',
  );
  const waLink = `https://wa.me/${WHATSAPP_PHONE}?text=${waMsg}`;

  return (
    <div className="min-h-screen bg-[#faf8f5] dark:bg-[#1c1917] pb-20">
      <CatalogViewTracker leadId={leadId} />

      <header className="bg-[#141110] text-[#faf8f5] px-6 py-14 md:py-20">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs tracking-[0.2em] uppercase text-[#c8a55c] mb-4">
            Atelier Óptica · Córdoba
          </p>
          <h1 className="font-serif text-4xl md:text-5xl font-bold mb-4">
            Canal Mayorista <span className="italic text-[#c8a55c]">para Ópticas</span>
          </h1>
          <p className="text-[#d8d3cb] max-w-xl mb-8">
            Armazones de diseño en acetato italiano Mazzucchelli, metal y titanio.
            Precios netos por unidad, pensados para revender.
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 text-sm">
            <StatPill label={`Mínimo ${WHOLESALE_MIN_PIECES} piezas`} sub="por pedido, mezclás modelos" />
            <StatPill label="Precios netos" sub="pensados para revender" />
            <StatPill label="Stock real" sub="en Córdoba, entrega ya" />
            <StatPill label={`${products.length || '—'} modelos`} sub="disponibles hoy" />
            <StatPill label="Ficha completa" sub="foto y datos de cada pieza, listas para el carrito" />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-14">
        {products.length === 0 ? (
          <p className="text-center text-[#9e7f65] py-20">
            El catálogo está actualizándose. Escribinos por WhatsApp y te lo pasamos directo.
          </p>
        ) : (
          Object.entries(grouped).map(([category, items]) => (
            <section key={category} className="mb-14">
              <h2 className="font-serif text-2xl font-bold text-[#433831] dark:text-[#fafaf9] mb-6 border-b border-[#e8e2db] dark:border-[#44403c] pb-3">
                {category}{' '}
                <span className="text-sm font-sans font-normal text-[#9e7f65]">
                  ({items.length})
                </span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                {items.map((p) => (
                  <div
                    key={p.id}
                    className="group rounded-xl overflow-hidden border border-[#e8e2db] dark:border-[#44403c] bg-white dark:bg-[#292524]"
                  >
                    <div className="relative aspect-square bg-[#f3efe9]">
                      {p.imageUrl ? (
                        <Image
                          src={p.imageUrl}
                          alt={p.name}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          className="object-contain mix-blend-multiply p-3 group-hover:scale-105 transition-transform"
                          unoptimized={p.imageUrl.startsWith('data:')}
                        />
                      ) : null}
                    </div>
                    <div className="p-3">
                      <p className="font-medium text-sm text-[#433831] dark:text-[#fafaf9] truncate">
                        {p.name}
                      </p>
                      <p className="text-xs text-[#9e7f65] mb-1">{category}</p>
                      <p className="font-bold text-[#8a6d3b] dark:text-[#c8a55c]">
                        ${p.wholesalePrice.toLocaleString('es-AR')}{' '}
                        <span className="font-normal text-xs">neto/u</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      <div className="fixed bottom-0 inset-x-0 bg-[#141110] text-[#faf8f5] px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.2)]">
        <p className="text-sm text-center sm:text-left">
          ¿Te interesa vender esta colección? Pedí tu usuario y accedé con tus precios.
        </p>
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 bg-[#c8a55c] text-[#141110] font-semibold px-5 py-2.5 rounded-full text-sm hover:bg-[#d6bfae] transition-colors"
        >
          Pedí tu usuario mayorista
        </a>
      </div>
    </div>
  );
}

function StatPill({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="border border-[#3a332c] rounded-lg px-3 py-2.5">
      <p className="font-semibold text-[#faf8f5]">{label}</p>
      <p className="text-[#a89e91] text-xs">{sub}</p>
    </div>
  );
}
