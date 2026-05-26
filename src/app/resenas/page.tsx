import { Metadata } from 'next';
import { StorefrontNavbar } from '@/components/Storefront/StorefrontNavbar';
import { StorefrontFooter } from '@/components/Storefront/StorefrontFooter';
import { FloatingWhatsApp } from '@/components/Storefront/FloatingWhatsApp';
import { ReviewsPageContent } from '@/components/Storefront/ReviewsPageContent';

export const metadata: Metadata = {
  title: 'Reseñas de Clientes | Atelier Óptica Córdoba',
  description: 'Descubrí lo que nuestros clientes opinan sobre Atelier Óptica. Opiniones reales de Google sobre nuestros armazones, lentes de sol y cristales graduados en el Cerro de las Rosas, Córdoba.',
};

// Revalidar cada hora para refrescar opiniones sin consumir excesiva cuota de API
export const revalidate = 3600;

async function fetchLegacyReviews(placeId: string, apiKey: string) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews&key=${apiKey}&language=es`;
  const response = await fetch(url, { next: { revalidate: 3600 } });
  const data = await response.json();
  if (data.status !== 'OK') {
    throw new Error(data.error_message || `Legacy API returned status: ${data.status}`);
  }
  return (data.result?.reviews || []).map((r: any) => ({
    author_name: r.author_name,
    author_url: r.author_url,
    profile_photo_url: r.profile_photo_url,
    rating: r.rating,
    relative_time_description: r.relative_time_description,
    text: r.text,
    time: r.time,
  }));
}

async function fetchNewReviews(placeId: string, apiKey: string) {
  const url = `https://places.googleapis.com/v1/places/${placeId}?languageCode=es`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'reviews'
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
  
  return (data.reviews || []).map((r: any) => ({
    author_name: r.authorAttribution?.displayName || '',
    author_url: r.authorAttribution?.uri || '',
    profile_photo_url: r.authorAttribution?.photoUri || '',
    rating: r.rating,
    relative_time_description: r.relativePublishTimeDescription || '',
    text: r.text?.text || '',
    time: r.publishTime ? new Date(r.publishTime).getTime() / 1000 : 0,
  }));
}

async function getGoogleReviews() {
  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    const placeId = process.env.GOOGLE_PLACE_ID || 'ChIJCeon2sCZMpQRxTe0O7U72c0';

    if (!apiKey) {
      console.warn("GOOGLE_PLACES_API_KEY no configurada. Cargando reseñas en base a testimonios locales.");
      return [];
    }

    try {
      const reviews = await fetchLegacyReviews(placeId, apiKey);
      if (reviews && reviews.length > 0) return reviews;
    } catch (legacyError: any) {
      console.warn('Fallo la API Legacy en Página:', legacyError.message);
      try {
        const reviews = await fetchNewReviews(placeId, apiKey);
        if (reviews && reviews.length > 0) return reviews;
      } catch (newApiError: any) {
        console.error('Fallo la API Nueva en Página:', newApiError.message);
      }
    }
    return [];
  } catch (error) {
    console.error('Error fetching reviews on server page:', error);
    return [];
  }
}

export default async function ResenasPage() {
  const reviews = await getGoogleReviews();

  return (
    <div className="bg-white min-h-screen text-black font-sans selection:bg-black selection:text-white">
      <StorefrontNavbar theme="light" />
      
      <main className="min-h-screen">
        <ReviewsPageContent initialReviews={reviews} />
      </main>

      <StorefrontFooter />
      <FloatingWhatsApp />
    </div>
  );
}
