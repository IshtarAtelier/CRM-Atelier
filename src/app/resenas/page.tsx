import { Metadata } from 'next';
import { StorefrontNavbar } from '@/components/Storefront/StorefrontNavbar';
import { StorefrontFooter } from '@/components/Storefront/StorefrontFooter';
import { ReviewsPageContent } from '@/components/Storefront/ReviewsPageContent';
import { buildOpticianSchema } from '@/lib/schema';

export const metadata: Metadata = {
  title: "Reseñas de Clientes",
  description: 'Descubrí lo que nuestros clientes opinan sobre Atelier Óptica. Opiniones reales de Google sobre nuestros armazones, lentes de sol y cristales graduados en el Cerro de las Rosas, Córdoba.',
  alternates: { canonical: 'https://atelieroptica.com.ar/resenas' },
};

// Revalidar cada hora para refrescar opiniones sin consumir excesiva cuota de API
export const revalidate = 3600;

async function fetchLegacyReviews(placeId: string, apiKey: string) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews,rating,user_ratings_total&key=${apiKey}&language=es`;
  const response = await fetch(url, { next: { revalidate: 3600 } });
  const data = await response.json();
  if (data.status !== 'OK') {
    throw new Error(data.error_message || `Legacy API returned status: ${data.status}`);
  }
  const reviews = (data.result?.reviews || []).map((r: any) => ({
    author_name: r.author_name,
    author_url: r.author_url,
    profile_photo_url: r.profile_photo_url,
    rating: r.rating,
    relative_time_description: r.relative_time_description,
    text: r.text,
    time: r.time,
  }));
  return {
    reviews,
    rating: data.result?.rating || 0,
    userRatingCount: data.result?.user_ratings_total || 0
  };
}

async function fetchNewReviews(placeId: string, apiKey: string) {
  const url = `https://places.googleapis.com/v1/places/${placeId}?languageCode=es`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'reviews,rating,userRatingCount'
    },
    next: { revalidate: 3600 }
  });
  
  if (!response.ok) {
    throw new Error(`New Places API HTTP Error: ${response.status}`);
  }
  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || 'New Places API Error');
  }
  
  const reviews = (data.reviews || []).map((r: any) => ({
    author_name: r.authorAttribution?.displayName || '',
    author_url: r.authorAttribution?.uri || '',
    profile_photo_url: r.authorAttribution?.photoUri || '',
    rating: r.rating,
    relative_time_description: r.relativePublishTimeDescription || '',
    text: r.text?.text || '',
    time: r.publishTime ? new Date(r.publishTime).getTime() / 1000 : 0,
  }));
  return {
    reviews,
    rating: data.rating || 0,
    userRatingCount: data.userRatingCount || 0
  };
}

async function getGoogleReviews() {
  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    const placeId = process.env.GOOGLE_PLACE_ID || 'ChIJjZd3QbC6l00RxWWzy_uJz80';

    if (!apiKey) {
      console.warn("GOOGLE_PLACES_API_KEY no configurada. Cargando reseñas en base a testimonios locales.");
      return { reviews: [], rating: 0, userRatingCount: 0 };
    }

    try {
      // Intentar primero con la API Nueva de Places
      const resData = await fetchNewReviews(placeId, apiKey);
      if (resData && resData.reviews && resData.reviews.length > 0) return resData;
    } catch (newApiError: any) {
      console.warn('Fallo la API Nueva en Página:', newApiError.message);
      try {
        // Fallback a la API Legacy
        const resData = await fetchLegacyReviews(placeId, apiKey);
        if (resData && resData.reviews && resData.reviews.length > 0) return resData;
      } catch (legacyError: any) {
        console.error('Fallo la API Legacy en Página:', legacyError.message);
      }
    }
    return { reviews: [], rating: 0, userRatingCount: 0 };
  } catch (error) {
    console.error('Error fetching reviews on server page:', error);
    return { reviews: [], rating: 0, userRatingCount: 0 };
  }
}

export default async function ResenasPage() {
  const data = await getGoogleReviews();

  // El builder omite aggregateRating si rating/count no son reales (> 0)
  const jsonLd = buildOpticianSchema({
    aggregateRating: { rating: data.rating, count: data.userRatingCount },
  });

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
