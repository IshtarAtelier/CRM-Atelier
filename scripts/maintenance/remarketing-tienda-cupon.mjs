/**
 * ESCRIBE EN META (autorizado por la dueña el 18/8/2026):
 *  1. El conjunto de "Coleccion | Catalogo Tienda" pasa a RETARGETING dinámico:
 *     vieron producto (o carrito) en 14 días y no compraron → Meta les muestra
 *     ESE producto con la foto del catálogo.
 *  2. Los 2 anuncios pasan a un texto con el cupón QUIEROMISLENTES
 *     (10% OFF, verificado vivo en la base: vence 30/09, mín $100.000, 10 usos).
 *  3. Se pausa el conjunto "Mensajes IG - WSP | Remarketing (IG + web)"
 *     (US$19 en 14 días, 1 conversación, 0 chats atribuidos en el CRM).
 *
 * NO crea campañas ni conjuntos nuevos. NO toca presupuestos.
 * Correr UNA vez:  node --env-file=.env scripts/maintenance/remarketing-tienda-cupon.mjs
 */
const API = 'https://graph.facebook.com/v21.0';
const TOKEN = process.env.META_ADS_TOKEN || process.env.META_ACCESS_TOKEN;
const ADSET_TIENDA = '120250804098460023';
const ADSET_WSP = '120250649502760023';
const PRODUCT_SET = '1743674383421832'; // "Destacados" (14 productos) — ampliar a todo el catálogo desde Commerce Manager cuando se quiera
const PAGE = '112571191818391';
const IG = '17841458761171093';
const ADS = ['120250805261210023', '120250851362400023'];

if (!TOKEN) { console.error('Falta META_ADS_TOKEN en el .env'); process.exit(1); }

async function api(ruta, body) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(body)) params.set(k, typeof v === 'string' ? v : JSON.stringify(v));
    params.set('access_token', TOKEN);
    const res = await fetch(`${API}${ruta}`, { method: 'POST', body: params, signal: AbortSignal.timeout(30000) });
    const json = await res.json().catch(() => ({}));
    if (json.error) throw new Error(`${ruta}: ${String(json.error.message || JSON.stringify(json.error)).slice(0, 300)}`);
    return json;
}

// 1. Conjunto → retargeting dinámico (vieron 14d, compradores excluidos)
console.log('1. Conjunto a retargeting dinámico…');
await api(`/${ADSET_TIENDA}`, {
    targeting: {
        age_min: 18, age_max: 65,
        geo_locations: { countries: ['AR'], location_types: ['home', 'recent'] },
        brand_safety_content_filter_levels: ['FACEBOOK_RELAXED', 'AN_RELAXED'],
        product_audience_specs: [{
            product_set_id: PRODUCT_SET,
            inclusions: [
                { retention_seconds: 1209600, rule: { event: { eq: 'ViewContent' } } },
                { retention_seconds: 1209600, rule: { event: { eq: 'AddToCart' } } },
            ],
            exclusions: [{ retention_seconds: 1209600, rule: { event: { eq: 'Purchase' } } }],
        }],
        targeting_automation: { advantage_audience: 0 },
    },
});
console.log('   ✅ vieron producto / carrito 14 días, compradores excluidos');

// 2. Nuevo texto con el cupón en los 2 anuncios (creative nuevo, MISMOS anuncios)
const MENSAJE = 'Ese modelo que estuviste mirando sigue acá 👓\n\n10% OFF en la tienda con el código QUIEROMISLENTES (válido hasta el 30/09).\n\n💳 6 cuotas sin interés · 🎁 Envío gratis a todo el país 🇦🇷';
console.log('2. Anuncios con el cupón…');
const creative = await api('/act_2107444353167176/adcreatives', {
    name: 'Catálogo retargeting | cupón QUIEROMISLENTES',
    product_set_id: PRODUCT_SET,
    object_story_spec: {
        page_id: PAGE,
        instagram_user_id: IG,
        template_data: {
            link: 'https://atelieroptica.com.ar/',
            message: MENSAJE,
            name: '{{product.name}}',
            call_to_action: { type: 'SHOP_NOW' },
            multi_share_end_card: false,
        },
    },
});
console.log(`   creative nuevo: ${creative.id}`);
for (const ad of ADS) {
    await api(`/${ad}`, { creative: { creative_id: creative.id } });
    console.log(`   ✅ anuncio ${ad} actualizado`);
}

// 3. Pausar el conjunto de remarketing a WhatsApp
console.log('3. Pausando remarketing a WhatsApp…');
await api(`/${ADSET_WSP}`, { status: 'PAUSED' });
console.log('   ✅ pausado');
console.log('\nListo. Verificar en el Administrador de Anuncios: el conjunto de');
console.log('"Coleccion | Catalogo Tienda" ahora dice "Público personalizado: personas');
console.log('que interactuaron con tus productos", y los anuncios muestran el cupón.');
