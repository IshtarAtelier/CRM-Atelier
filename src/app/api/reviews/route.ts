import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    // El Place ID de Atelier Óptica
    const placeId = process.env.GOOGLE_PLACE_ID || 'ChIJCeon2sCZMpQRxTe0O7U72c0';

    if (!apiKey) {
      return NextResponse.json({ error: 'Falta la API Key de Google Places en el entorno' }, { status: 500 });
    }

    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews&key=${apiKey}&language=es`;
    
    // Usamos caché de Next.js para revalidar cada hora (3600 segundos) y no agotar la cuota de la API
    const response = await fetch(url, { next: { revalidate: 3600 } });
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('Google Places API Error:', data.error_message);
      return NextResponse.json({ error: data.error_message || 'Error al obtener reseñas de Google' }, { status: 500 });
    }

    // Ordenar por las más recientes primero
    const sortedReviews = (data.result?.reviews || []).sort((a: any, b: any) => b.time - a.time);

    // Filtrar reseñas sin texto o muy cortas para mostrar solo testimonios valiosos
    const validReviews = sortedReviews.filter((r: any) => r.text && r.text.length > 10);

    return NextResponse.json({ reviews: validReviews });
  } catch (error) {
    console.error('Error fetching Google Reviews:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
