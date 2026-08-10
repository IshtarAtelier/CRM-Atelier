/**
 * Diagnóstico del acceso a Meta para PUBLICAR contenido.
 *
 * Contesta una sola pregunta: ¿se puede publicar hoy en la Página y en el
 * Instagram de la óptica? Y si no, exactamente qué falta.
 *
 * Existe porque el error que devuelve Meta al publicar no dice cuál permiso
 * falta ni qué activo no está asignado. Correr esto ANTES de tocar nada ahorra
 * las tardes que se pierden buscando en el código un problema que estaba en una
 * casilla sin tildar.
 *
 *   node scripts/social/meta-check.mjs
 *
 * OJO — regla que no se negocia: este script NUNCA imprime el token ni el App
 * Secret, ni siquiera un pedazo. Un diagnóstico que escupe credenciales termina
 * pegado en un chat.
 *
 * Ojo 2: las credenciales de ADS que ya existen (META_ACCESS_TOKEN,
 * META_ADS_TOKEN, META_PIXEL_ID) NO sirven para publicar. Son de medición y
 * campañas: otro token, otros permisos, otro flujo. Publicar usa
 * META_SYSTEM_USER_TOKEN.
 */
import 'dotenv/config';

const API = 'https://graph.facebook.com/v21.0';

/**
 * Los que SÍ hacen falta para publicar un carrusel. Sin alguno de estos, no se
 * publica: por eso bloquean.
 */
const PERMISOS_NECESARIOS = [
    ['pages_show_list', 'ver la lista de Páginas'],
    ['pages_read_engagement', 'leer la Página y derivar su token'],
    ['pages_manage_posts', 'crear publicaciones en la Página'],
    ['instagram_basic', 'ver la cuenta de Instagram'],
    ['instagram_content_publish', 'publicar en Instagram'],
];

/**
 * Los que habilitan cosas que todavía no hacemos. Se informan pero NO bloquean.
 *
 * `pages_manage_engagement` estaba en la lista de arriba y frenaba el
 * diagnóstico entero con todo lo demás en verde. Es para responder comentarios
 * y reacciones: `publicar.mjs` no lo usa en ningún endpoint (solo toca
 * /photos, /feed, /media y /media_publish). Un chequeo que falla por algo que
 * no impide publicar enseña a ignorar los chequeos, que es peor que no tenerlos.
 *
 * Si algún día el sistema responde comentarios, se agrega el permiso al token
 * y se mueve esta línea a PERMISOS_NECESARIOS.
 */
const PERMISOS_OPCIONALES = [
    ['pages_manage_engagement', 'responder comentarios (no lo usamos todavía)'],
];

const ok = (t) => console.log(`  ✅ OK     ${t}`);
const falla = (t) => console.log(`  ❌ FALLA  ${t}`);
const aviso = (t) => console.log(`  ⚠️  AVISO  ${t}`);
const titulo = (t) => console.log(`\n${t}\n${'─'.repeat(t.length)}`);

let hayFallas = false;
const marcarFalla = (t) => { hayFallas = true; falla(t); };

async function api(path, token, params = {}) {
    const url = new URL(`${API}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set('access_token', token);
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok && !json.error, json, error: json.error };
}

(async () => {
    console.log('\n═══ Diagnóstico de publicación en Meta ═══');

    const TOKEN = process.env.META_SYSTEM_USER_TOKEN;
    const PAGE_ID = process.env.META_PAGE_ID;
    const IG_USER_ID = process.env.META_IG_USER_ID;

    // ── 0. Variables ────────────────────────────────────────────────────────
    titulo('0. Credenciales en .env');
    if (!TOKEN) {
        marcarFalla('META_SYSTEM_USER_TOKEN no está definida. Es el token del usuario del sistema, con los 6 permisos de publicación.');
        console.log('\n     Sin esto no se puede seguir. Ver docs/plan-publicacion-meta.md, Etapa 0.');
        process.exit(1);
    }
    ok('META_SYSTEM_USER_TOKEN presente');
    PAGE_ID ? ok('META_PAGE_ID presente') : marcarFalla('META_PAGE_ID no está definida (id de la Página de Facebook)');
    IG_USER_ID ? ok('META_IG_USER_ID presente') : aviso('META_IG_USER_ID no está definida — se intenta descubrir desde la Página');

    // ── 1. El token ─────────────────────────────────────────────────────────
    titulo('1. El token: permisos y vencimiento');
    const debug = await api('/debug_token', TOKEN, { input_token: TOKEN });
    if (!debug.ok) {
        marcarFalla(`Meta rechazó el token: ${debug.error?.message || 'sin detalle'}`);
    } else {
        const d = debug.json.data || {};
        ok(`Tipo de token: ${d.type || 'desconocido'}${d.type === 'SYSTEM_USER' ? ' (el correcto: no vence)' : ''}`);

        if (d.type && d.type !== 'SYSTEM_USER') {
            aviso('No es un token de usuario del sistema. Los de usuario común vencen a los 60 días y dejan la publicación rota sin aviso.');
        }
        if (d.expires_at && d.expires_at > 0) {
            const vence = new Date(d.expires_at * 1000);
            const dias = Math.round((vence - Date.now()) / 86400000);
            dias < 30
                ? aviso(`El token vence el ${vence.toLocaleDateString('es-AR')} (en ${dias} días)`)
                : ok(`Vence el ${vence.toLocaleDateString('es-AR')}`);
        } else {
            ok('El token no vence');
        }

        const scopes = new Set(d.scopes || []);
        console.log('');
        for (const [permiso, paraQue] of PERMISOS_NECESARIOS) {
            scopes.has(permiso)
                ? ok(`${permiso.padEnd(28)} ${paraQue}`)
                : marcarFalla(`${permiso.padEnd(28)} FALTA — ${paraQue}`);
        }
        for (const [permiso, paraQue] of PERMISOS_OPCIONALES) {
            if (scopes.has(permiso)) ok(`${permiso.padEnd(28)} ${paraQue}`);
            else console.log(`  ·  ${permiso.padEnd(28)} no está — ${paraQue}`);
        }
    }

    // ── 2. La Página ────────────────────────────────────────────────────────
    titulo('2. La Página de Facebook');
    const cuentas = await api('/me/accounts', TOKEN, { fields: 'id,name,tasks' });
    if (!cuentas.ok) {
        marcarFalla(`No se pudo listar Páginas: ${cuentas.error?.message || 'sin detalle'}`);
    } else {
        const paginas = cuentas.json.data || [];
        if (!paginas.length) {
            marcarFalla('El token no ve NINGUNA Página. Casi siempre es esto: al usuario del sistema se le asignó la app pero NO los activos (Página e Instagram). Son dos pantallas distintas en el Business.');
        } else {
            ok(`El token ve ${paginas.length} Página(s)`);
            const pagina = PAGE_ID ? paginas.find(p => p.id === PAGE_ID) : paginas[0];
            if (PAGE_ID && !pagina) {
                marcarFalla(`La Página ${PAGE_ID} no está entre las que ve el token. Páginas visibles: ${paginas.map(p => `${p.name} (${p.id})`).join(', ')}`);
            } else if (pagina) {
                ok(`Página: ${pagina.name} (${pagina.id})`);
                // AVISO, no FALLA — y esto costó tiempo real el 10/8/2026.
                // El chequeo dijo "Sin permiso CREATE_CONTENT, permisos
                // actuales: ADVERTISE" y mandó a tocar roles en Business
                // Manager. La publicación funcionó igual, en Facebook Y en
                // Instagram, sin cambiar absolutamente nada.
                // El `tasks` que devuelve `me/accounts` no refleja lo que el
                // token puede hacer de verdad. La prueba que vale es si se
                // deriva el token de Página (paso 4): eso es lo que exigen
                // Facebook e Instagram para publicar.
                // Un chequeo con falso negativo hace perder más tiempo que uno
                // que no existe, porque manda a arreglar lo que no está roto.
                const tasks = pagina.tasks || [];
                tasks.includes('CREATE_CONTENT')
                    ? ok('Tiene permiso de crear contenido')
                    : aviso(`El listado dice "${tasks.join(', ') || 'ninguno'}", no CREATE_CONTENT. Suele ser falso negativo: si el paso 4 deriva el token de Página, se publica igual. PROBAR antes de tocar permisos.`);
            }
        }
    }

    // ── 3. Instagram ────────────────────────────────────────────────────────
    titulo('3. La cuenta de Instagram');
    if (!PAGE_ID) {
        aviso('Sin META_PAGE_ID no se puede verificar Instagram (cuelga de la Página)');
    } else {
        const ig = await api(`/${PAGE_ID}`, TOKEN, { fields: 'instagram_business_account{id,username}' });
        if (!ig.ok) {
            marcarFalla(`No se pudo consultar la Página: ${ig.error?.message || 'sin detalle'}`);
        } else if (!ig.json.instagram_business_account) {
            marcarFalla('La Página NO devuelve instagram_business_account. Instagram no está vinculado a la Página, o no está en modo profesional. Es el punto que más falla: verificalo desde la app de Instagram (Editar perfil → Página de Facebook) o desde Meta Business Suite.');
        } else {
            const cuenta = ig.json.instagram_business_account;
            ok(`Instagram vinculado: @${cuenta.username || 'sin username'} (${cuenta.id})`);
            if (IG_USER_ID && IG_USER_ID !== cuenta.id) {
                marcarFalla(`META_IG_USER_ID dice ${IG_USER_ID} pero la Página devuelve ${cuenta.id}. Corregir el .env.`);
            } else if (!IG_USER_ID) {
                aviso(`Agregar al .env:  META_IG_USER_ID=${cuenta.id}`);
            }
        }
    }

    // ── 4. Token de Página ──────────────────────────────────────────────────
    titulo('4. El token de Página (se deriva, no se guarda)');
    if (!PAGE_ID) {
        aviso('Sin META_PAGE_ID no se puede verificar');
    } else {
        const pt = await api(`/${PAGE_ID}`, TOKEN, { fields: 'access_token' });
        pt.ok && pt.json.access_token
            ? ok('Se puede derivar el token de Página (lo exigen Facebook e Instagram para publicar)')
            : marcarFalla(`No se pudo derivar: ${pt.error?.message || 'sin detalle'}. Sin esto, publicar falla con "Unpublished posts must be posted to a page as the page itself".`);
    }

    // ── Resultado ───────────────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(45));
    if (hayFallas) {
        console.log('RESULTADO: todavía NO se puede publicar.');
        console.log('Resolver las FALLA de arriba antes de seguir con el render.');
        process.exit(1);
    }
    console.log('RESULTADO: todo OK. Se puede publicar.');
})().catch(e => {
    console.error('\nERROR inesperado:', e.message);
    process.exit(1);
});
