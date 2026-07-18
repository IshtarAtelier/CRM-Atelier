// Scraper de ópticas vía Google Places API para el panel /admin/opticas.
//
// Busca "ópticas en <ciudad>" por cada localidad, pagina hasta 60 resultados
// por búsqueda (límite de la API), levanta el teléfono/web de cada lugar con
// Place Details, dedupea por place_id y escribe un JSON listo para pegar en
// el botón "Importar" del panel (acepta JSON) — o importar vía API.
//
// Uso:
//   GOOGLE_MAPS_API_KEY=xxxx node scripts/scrape_opticas_places.js
//   node scripts/scrape_opticas_places.js --key=xxxx --ciudades="Córdoba,Villa Carlos Paz"
//   node scripts/scrape_opticas_places.js --key=xxxx --max=200 --out=opticas.json
//
// Costos aprox (tarifas Google jul/2026): Text Search ~USD 32/1000 requests,
// Place Details (Basic+Contact) ~USD 20/1000. 1000 ópticas ≈ USD 25-60.
// La key necesita "Places API" habilitada y facturación activa en el proyecto.

const fs = require('fs');

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || true]; })
);

const API_KEY = args.key || process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY) {
  console.error('Falta la API key: --key=XXXX o env GOOGLE_MAPS_API_KEY');
  console.error('(Places API habilitada + billing activo en Google Cloud)');
  process.exit(1);
}

// Localidades de Córdoba por defecto (las más grandes primero); override con --ciudades
const DEFAULT_CIUDADES = [
  'Córdoba Capital', 'Villa Carlos Paz', 'Río Cuarto', 'Villa María', 'San Francisco',
  'Alta Gracia', 'Río Tercero', 'Jesús María', 'Bell Ville', 'La Falda', 'Cosquín',
  'Cruz del Eje', 'Marcos Juárez', 'Villa Dolores', 'Arroyito', 'Río Segundo',
  'Villa Allende', 'Unquillo', 'Mendiolaza', 'La Calera', 'Malagueño', 'Deán Funes',
];
const ciudades = args.ciudades ? String(args.ciudades).split(',').map(s => s.trim()).filter(Boolean) : DEFAULT_CIUDADES;
const MAX_PLACES = Number(args.max || 800);
const OUT = args.out || 'scripts/opticas_leads.json';
const provincia = args.provincia || 'Córdoba';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function textSearch(query) {
  const results = [];
  let pageToken = null;
  for (let page = 0; page < 3; page++) { // la API da máx. 3 páginas (60 resultados)
    const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    url.searchParams.set('key', API_KEY);
    if (pageToken) url.searchParams.set('pagetoken', pageToken);
    else { url.searchParams.set('query', query); url.searchParams.set('region', 'ar'); url.searchParams.set('language', 'es'); }
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'REQUEST_DENIED' || data.status === 'OVER_QUERY_LIMIT') {
      throw new Error(`${data.status}: ${data.error_message || 'revisar key/billing'}`);
    }
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.warn(`  aviso: status ${data.status} para "${query}"`);
    }
    results.push(...(data.results || []));
    pageToken = data.next_page_token;
    if (!pageToken) break;
    await sleep(2100); // el token tarda ~2s en activarse (requisito de la API)
  }
  return results;
}

async function placeDetails(placeId) {
  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.searchParams.set('key', API_KEY);
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('language', 'es');
  url.searchParams.set('fields', 'formatted_phone_number,international_phone_number,website,url');
  const res = await fetch(url);
  const data = await res.json();
  return data.result || {};
}

(async () => {
  const byPlaceId = new Map();
  console.log(`Buscando ópticas en ${ciudades.length} localidades de ${provincia} (tope ${MAX_PLACES})…`);

  for (const ciudad of ciudades) {
    if (byPlaceId.size >= MAX_PLACES) break;
    const query = `ópticas en ${ciudad}, ${provincia}, Argentina`;
    try {
      const found = await textSearch(query);
      let nuevos = 0;
      for (const r of found) {
        if (!byPlaceId.has(r.place_id)) {
          byPlaceId.set(r.place_id, { ...r, _ciudad: ciudad });
          nuevos++;
        }
      }
      console.log(`  ${ciudad}: ${found.length} resultados, ${nuevos} nuevos (total ${byPlaceId.size})`);
    } catch (e) {
      console.error(`  ERROR en ${ciudad}: ${e.message}`);
      if (String(e.message).includes('REQUEST_DENIED')) process.exit(1);
    }
    await sleep(200);
  }

  const places = [...byPlaceId.values()].slice(0, MAX_PLACES);
  console.log(`\nLevantando teléfonos de ${places.length} lugares (Place Details)…`);
  const leads = [];
  for (let i = 0; i < places.length; i++) {
    const p = places[i];
    try {
      const d = await placeDetails(p.place_id);
      leads.push({
        name: p.name,
        phone: d.formatted_phone_number || d.international_phone_number || null,
        rating: p.rating ?? null,
        reviewsCount: p.user_ratings_total ?? null,
        category: (p.types || []).includes('optician') ? 'Óptica' : (p.types || [])[0] || null,
        address: p.formatted_address || null,
        city: p._ciudad,
        province: provincia,
        mapsUrl: d.url || `https://www.google.com/maps/place/?q=place_id:${p.place_id}`,
        placeId: p.place_id,
        website: d.website || null,
      });
      if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${places.length}…`);
      await sleep(120); // gentileza con el rate limit
    } catch (e) {
      console.warn(`  detalle falló para ${p.name}: ${e.message}`);
    }
  }

  fs.writeFileSync(OUT, JSON.stringify(leads, null, 2));
  const conTel = leads.filter(l => l.phone).length;
  console.log(`\nListo: ${leads.length} ópticas (${conTel} con teléfono) → ${OUT}`);
  console.log('Importar: abrí /admin/opticas → Importar → pegá el contenido del JSON.');
})();
