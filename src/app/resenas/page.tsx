import { Metadata } from 'next';
import { StorefrontNavbar } from '@/components/Storefront/StorefrontNavbar';
import { StorefrontFooter } from '@/components/Storefront/StorefrontFooter';
import { ReviewsPageContent } from '@/components/Storefront/ReviewsPageContent';
import { buildOpticianSchema } from '@/lib/schema';
import { getGoogleReviews } from '@/lib/googleReviews';

export const metadata: Metadata = {
  title: "Reseñas de Clientes",
  description: 'Descubrí lo que nuestros clientes opinan sobre Atelier Óptica. Opiniones reales de Google sobre nuestros armazones, lentes de sol y cristales graduados en el Cerro de las Rosas, Córdoba.',
  alternates: { canonical: 'https://atelieroptica.com.ar/resenas' },
};

// Revalidar cada hora para refrescar opiniones sin consumir excesiva cuota de API
export const revalidate = 3600;

export default async function ResenasPage() {
  // Sin reseñas de respaldo: esta página muestra solo las que Google devuelve.
  const data = await getGoogleReviews({ sinRespaldo: true });

  // Sin aggregateRating: las reseñas las junta y muestra Google, no este sitio
  // (marcarlas acá es self-serving). Ver src/lib/schema.ts.
  const jsonLd = buildOpticianSchema();

  return (
    <div className="bg-white min-h-screen text-black font-sans selection:bg-black selection:text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <StorefrontNavbar theme="light" />
      
      <main className="min-h-screen">
        <ReviewsPageContent 
          initialReviews={data.reviews} 
          rating={data.rating} 
          userRatingCount={data.userRatingCount} 
        />
      </main>

      <StorefrontFooter />
      
    </div>
  );
}
