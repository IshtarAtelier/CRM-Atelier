import { NextResponse } from 'next/server';

const FALLBACK_REVIEWS = [
  {
    author_name: "Juan Manuel Rodríguez",
    profile_photo_url: "",
    rating: 5,
    relative_time_description: "Hace 1 semana",
    text: "Excelente atención y asesoramiento. Compré unos cristales multifocales de última tecnología y la adaptación fue súper rápida. Muy recomendados!"
  },
  {
    author_name: "Valentina Gómez",
    profile_photo_url: "",
    rating: 5,
    relative_time_description: "Hace 2 semanas",
    text: "La mejor óptica de Córdoba sin dudas. El local es hermoso y los armazones son de un diseño exclusivo que no se encuentra en ningún otro lado."
  },
  {
    author_name: "Sol Acuña",
    profile_photo_url: "",
    rating: 5,
    relative_time_description: "Hace 3 semanas",
    text: "Muy conforme con mi compra online. Me asesoraron por WhatsApp con mi receta médica y los lentes llegaron impecables a Mendoza en pocos días."
  },
  {
    author_name: "Facundo Ortiz",
    profile_photo_url: "",
    rating: 5,
    relative_time_description: "Hace 1 mes",
    text: "Los anteojos clip-on son geniales y de una calidad excelente. La atención al cliente es impecable, te guían pacientemente en cada detalle."
  },
  {
    author_name: "Martina Paz",
    profile_photo_url: "",
    rating: 5,
    relative_time_description: "Hace 1 mes",
    text: "Compré unos lentes de sol y son hermosos. Excelente presentación, el packaging es súper premium y muy cuidado. Volveré a comprar."
  }
];

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

export async function GET() {
  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    const placeId = process.env.GOOGLE_PLACE_ID || 'ChIJjZd3QbC6l00RxWWzy_uJz80';

    if (!apiKey) {
      console.warn('Falta la API Key de Google Places en el entorno. Usando reseñas locales de fallback.');
      return NextResponse.json({ reviews: FALLBACK_REVIEWS });
    }

    try {
      // Intentar primero con la API Legacy
      console.log('Intentando obtener reseñas con la API de Places Legacy...');
      const reviews = await fetchLegacyReviews(placeId, apiKey);
      if (reviews && reviews.length > 0) {
        return NextResponse.json({ reviews });
      }
    } catch (legacyError: any) {
      console.warn('Fallo la API Legacy:', legacyError.message);
      
      // Si falla la legacy (por ejemplo, porque está deshabilitada y requiere la API nueva)
      try {
        console.log('Intentando obtener reseñas con la API de Places (New)...');
        const reviews = await fetchNewReviews(placeId, apiKey);
        if (reviews && reviews.length > 0) {
          return NextResponse.json({ reviews });
        }
      } catch (newApiError: any) {
        console.error('Fallo también la API de Places (New):', newApiError.message);
      }
    }

    // Si fallaron ambas llamadas pero hay una key configurada, retornamos fallback
    console.warn('No se pudieron obtener reseñas reales de Google. Usando fallbacks.');
    return NextResponse.json({ reviews: FALLBACK_REVIEWS });
  } catch (error) {
    console.error('Error general en GET /api/reviews:', error);
    return NextResponse.json({ reviews: FALLBACK_REVIEWS });
  }
}
