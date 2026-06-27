const FALLBACK_REVIEWS = [
  {
    author_name: "Julieta Foppoli",
    profile_photo_url: "https://lh3.googleusercontent.com/a-/ALV-UjWGd0XySGT0AZWji7lm9u8bCXz_qUw2cp1pctHqZULadZuVpco=s128-c0x00000000-cc-rp-mo-ba2",
    rating: 5,
    relative_time_description: "Hace 3 semanas",
    text: "Excelente atención... La compra se salió de \"hablar de precios\" a revisar que era mejor, probar opciones e incluso proponer llamado para poder recomendar mejor. El local impecable todo a la vista lo que hizo súper ágil la elección. Atención profesional, amable... Nada de andar corriendo o despachando gente como me venía pasando. Súper recomendado!",
    author_url: "https://www.google.com/maps/contrib/106672142904345242727/reviews"
  },
  {
    author_name: "CLAUDIA SONIA GUZMAN",
    profile_photo_url: "https://lh3.googleusercontent.com/a/ACg8ocJoSNHR7DOfx2W2t_X553rntdzqc6VOHf8zIImUV-Mu1_PX5A=s128-c0x00000000-cc-rp-mo",
    rating: 5,
    relative_time_description: "Hace 5 meses",
    text: "Excelente experiencia. Ya había comprado antes y volví a elegirlos porque la calidad es realmente impecable. Los anteojos multifocales son hermosos y de primera. Destaco especialmente la atención de Matías, siempre amable, claro y profesional. Da gusto encontrar un lugar donde la atención y el producto van de la mano. Sin dudas, un lugar al que siempre dan ganas de volver. ¡Gracias totales!",
    author_url: "https://www.google.com/maps/contrib/104774864567102780209/reviews"
  },
  {
    author_name: "Vale Contreras",
    profile_photo_url: "https://lh3.googleusercontent.com/a/ACg8ocKlvsiphuxNDrTgtk8DwEsr_sZo-MOFipoh9Dj8fWjis2VJttie=s128-c0x00000000-cc-rp-mo",
    rating: 5,
    relative_time_description: "Hace 2 semanas",
    text: "Muy buena atención. Me asesoraron con mucha paciencia para elegir mis anteojos y resolvieron todas mis dudas. El trato fue amable y profesional durante todo el proceso. Quedé muy conforme con el servicio y con el resultado final",
    author_url: "https://www.google.com/maps/contrib/103428301390791156724/reviews"
  },
  {
    author_name: "Angelica Gagliano",
    profile_photo_url: "https://lh3.googleusercontent.com/a/ACg8ocKtMGm-nV0w5T3l2VTHNUoRYxrqpWpeTQoUW4nqjuS5a12sv_0C=s128-c0x00000000-cc-rp-mo",
    rating: 5,
    relative_time_description: "Hace 6 meses",
    text: "Un día, viendo las redes me comuniqué por WhatsApp casi a la hora de cierre y Matías me atendió tomándose todo el tiempo del mundo, con tanta amabilidad y dedicación que esa fue, mi primera buena impresión. Luego fui al local y me sentí especial en cuanto a la atención personalizada. Muchas gracias, estoy muy feliz con mis multifocales fotocromáticos 2x1. Recomiendo 100%",
    author_url: "https://www.google.com/maps/contrib/101181909865280760845/reviews"
  },
  {
    author_name: "Norberto Garone",
    profile_photo_url: "https://lh3.googleusercontent.com/a/ACg8ocLYzzZBjh1AxexVjiNlMYp73CBPQfIkwSSOCQxHBe_7p47gcw=s128-c0x00000000-cc-rp-mo",
    rating: 5,
    relative_time_description: "Hace 5 meses",
    text: "Excelente trabajo y una impecable cordialidad y eficiencia. Atendido con un profesionalismo impecable y considero fue un antes y un después mejorando mi calidad de vida. Gracias Matías!!! Sin dejar de mencionar el excelente precio y calidad de los lentes adquiridos.",
    author_url: "https://www.google.com/maps/contrib/113865402328733115088/reviews"
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
    userRatingCount: data.result?.user_ratings_total || 642
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
    userRatingCount: data.userRatingCount || 642
  };
}

export async function getGoogleReviews() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID || 'ChIJjZd3QbC6l00RxWWzy_uJz80';

  if (!apiKey) {
    console.warn('Falta la API Key de Google Places en el entorno. Retornando reseñas de respaldo.');
    return { reviews: FALLBACK_REVIEWS, rating: 5.0, userRatingCount: 642 };
  }

  try {
    console.log('Intentando obtener reseñas con la API de Places (New)...');
    const resData = await fetchNewReviews(placeId, apiKey);
    if (resData && resData.reviews && resData.reviews.length > 0) {
      return resData;
    }
  } catch (newApiError: any) {
    console.warn('Fallo la API (New):', newApiError.message);
    
    try {
      console.log('Intentando obtener reseñas con la API de Places Legacy...');
      const resData = await fetchLegacyReviews(placeId, apiKey);
      if (resData && resData.reviews && resData.reviews.length > 0) {
        return resData;
      }
    } catch (legacyError: any) {
      console.error('Fallo también la API Legacy:', legacyError.message);
    }
  }

  console.warn('No se pudieron obtener reseñas reales de Google. Retornando reseñas de respaldo.');
  return { reviews: FALLBACK_REVIEWS, rating: 5.0, userRatingCount: 642 };
}
