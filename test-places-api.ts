import dotenv from 'dotenv';
dotenv.config();

async function testPlaces() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID || 'ChIJjZd3QbC6l00RxWWzy_uJz80';

  console.log("Testing Places API...");
  console.log(`API Key: ${apiKey ? apiKey.substring(0, 10) + '...' : 'undefined'}`);
  console.log(`Place ID: ${placeId}`);

  if (!apiKey) {
    console.error("No API key found.");
    return;
  }

  // 1. Test New Places API
  try {
    const url = `https://places.googleapis.com/v1/places/${placeId}?languageCode=es`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'reviews,rating,userRatingCount,displayName'
      }
    });
    console.log(`New Places API HTTP Status: ${response.status}`);
    const data = await response.json();
    console.log("New Places API Response:", JSON.stringify(data, null, 2));
  } catch (e: any) {
    console.error("New Places API Exception:", e.message);
  }

  console.log("\n-----------------------------------\n");

  // 2. Test Legacy Places API
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews,rating,user_ratings_total,name&key=${apiKey}&language=es`;
    const response = await fetch(url);
    console.log(`Legacy Places API HTTP Status: ${response.status}`);
    const data = await response.json();
    console.log("Legacy Places API Response status:", data.status);
    console.log("Legacy Places API rating:", data.result?.rating);
    console.log("Legacy Places API user_ratings_total:", data.result?.user_ratings_total);
    console.log("Legacy Places API reviews count:", data.result?.reviews?.length);
    if (data.error_message) {
      console.log("Legacy Places API Error message:", data.error_message);
    }
  } catch (e: any) {
    console.error("Legacy Places API Exception:", e.message);
  }
}

testPlaces();
