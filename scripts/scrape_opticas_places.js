// Scraper de ópticas vía Google Places API para el panel /admin/opticas.
//
// Busca "ópticas en <ciudad>" por cada localidad, pagina hasta 60 resultados
// por búsqueda (límite de la API), dedupea por place_id y escribe un JSON listo
// para pegar en el botón "Importar" del panel (acepta JSON) — o importar vía API.
// Usa Places API (New): el teléfono viene en la misma respuesta que la búsqueda.
//
// Uso:
//   GOOGLE_MAPS_API_KEY=xxxx node scripts/scrape_opticas_places.js
//   node scripts/scrape_opticas_places.js --key=xxxx --ciudades="Córdoba,Villa Carlos Paz"
//   node scripts/scrape_opticas_places.js --key=xxxx --max=200 --out=opticas.json
//
// Costos aprox: searchText con field mask Enterprise (incluye teléfono) ~USD
// 35/1000 requests, y cada request trae 20 lugares → 1000 ópticas ≈ USD 2.
// La key necesita "Places API (New)" habilitada y facturación activa.

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

// Places API (New) — la legacy (maps.googleapis.com/maps/api/place/*) está dada
// de baja y responde REQUEST_DENIED "legacy API not enabled". searchText ya trae
// teléfono y web en la misma respuesta, así que no hace falta un Details por lugar.
const FIELD_MASK = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.types',
  'places.rating', 'places.userRatingCount', 'places.googleMapsUri',
  'places.nationalPhoneNumber', 'places.internationalPhoneNumber', 'places.websiteUri',
  'nextPageToken',
].join(',');

async function textSearch(query) {
  const results = [];
  let pageToken = null;
  for (let page = 0; page < 3; page++) { // 3 páginas de 20 = 60 resultados, igual que la legacy
    // La API nueva exige que la request paginada repita TODOS los parámetros de
    // la primera ("Request parameters for paging requests must match"), no solo
    // el token: mandar el pageToken solo devuelve "Empty text_query".
    const body = { textQuery: query, languageCode: 'es', regionCode: 'AR', pageSize: 20 };
    if (pageToken) body.pageToken = pageToken;
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data?.error?.message || `HTTP ${res.status}`;
      // 403/PERMISSION_DENIED = key sin Places API (New) o sin billing: no sigue.
      if (res.status === 403 || res.status === 401) throw new Error(`REQUEST_DENIED: ${msg}`);
      console.warn(`  aviso: ${msg} para "${query}"`);
      break;
    }
    results.push(...(data.places || []));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
    await sleep(2100); // el token tarda ~2s en activarse (requisito de la API)
  }
  return results;
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
        if (!byPlaceId.has(r.id)) {
          byPlaceId.set(r.id, { ...r, _ciudad: ciudad });
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
  console.log(`\nArmando ${places.length} leads…`);
  const leads = places.map((p) => ({
    name: p.displayName?.text || null,
    phone: p.nationalPhoneNumber || p.internationalPhoneNumber || null,
    // El formato nacional NO distingue fijo de celular (Google casi nunca pone
    // el "15"). El internacional sí: "+54 9 299…" es celular, "+54 299…" es fijo.
    // Es el único dato que evita escribirle por WhatsApp a un teléfono de línea.
    phoneIntl: p.internationalPhoneNumber || null,
    rating: p.rating ?? null,
    reviewsCount: p.userRatingCount ?? null,
    category: (p.types || []).includes('optician') ? 'Óptica' : (p.types || [])[0] || null,
    address: p.formattedAddress || null,
    city: p._ciudad,
    province: provincia,
    mapsUrl: p.googleMapsUri || `https://www.google.com/maps/place/?q=place_id:${p.id}`,
    placeId: p.id,
    website: p.websiteUri || null,
  })).filter((l) => l.name);

  fs.writeFileSync(OUT, JSON.stringify(leads, null, 2));
  const conTel = leads.filter(l => l.phone).length;
  console.log(`\nListo: ${leads.length} ópticas (${conTel} con teléfono) → ${OUT}`);
  console.log('Importar: abrí /admin/opticas → Importar → pegá el contenido del JSON.');
})();
