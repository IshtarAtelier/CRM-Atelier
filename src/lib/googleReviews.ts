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

export async function fetchLegacyReviews(placeId: string, apiKey: string) {
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
    rating: data.result?.rating || 5.0,
    userRatingCount: data.result?.user_ratings_total || 621
  };
}

export async function fetchNewReviews(placeId: string, apiKey: string) {
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
    rating: data.rating || 5.0,
    userRatingCount: data.userRatingCount || 621
  };
}

export async function getGoogleReviews() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID || 'ChIJjZd3QbC6l00RxWWzy_uJz80';

  if (!apiKey) {
    console.warn('Falta la API Key de Google Places en el entorno. Silenciando componente.');
    return { reviews: [], rating: 5.0, userRatingCount: 621 };
  }

  try {
    console.log('Intentando obtener reseñas con la API de Places Legacy...');
    const resData = await fetchLegacyReviews(placeId, apiKey);
    if (resData && resData.reviews && resData.reviews.length > 0) {
      return resData;
    }
  } catch (legacyError: any) {
    console.warn('Fallo la API Legacy:', legacyError.message);
    
    try {
      console.log('Intentando obtener reseñas con la API de Places (New)...');
      const resData = await fetchNewReviews(placeId, apiKey);
      if (resData && resData.reviews && resData.reviews.length > 0) {
        return resData;
      }
    } catch (newApiError: any) {
      console.error('Fallo también la API de Places (New):', newApiError.message);
    }
  }

  console.warn('No se pudieron obtener reseñas reales de Google. Silenciando componente.');
  return { reviews: [], rating: 5.0, userRatingCount: 621 };
}
