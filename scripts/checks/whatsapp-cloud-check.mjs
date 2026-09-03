/**
 * Diagnóstico de la API oficial de WhatsApp (Cloud API). SOLO LEE.
 *
 *   node scripts/checks/whatsapp-cloud-check.mjs
 *
 * Con WA_CLOUD_TOKEN (system user con whatsapp_business_management +
 * whatsapp_business_messaging) responde en una corrida:
 *   1. qué permisos tiene el token y de qué app es;
 *   2. qué WABAs tiene el Business "Atelier Óptica" (796163885437265) — la
 *      cuenta ya estuvo en la API oficial antes, así que puede que EXISTA;
 *   3. por cada WABA: números, nombre verificado, calidad, límite, si está
 *      registrado en la Cloud API (platform_type), estado del nombre;
 *   4. plantillas existentes (y cuáles del catálogo faltan);
 *   5. si la app tiene el webhook suscrito a la WABA;
 *   6. las variables listas para pegar en Railway.
 *
 * No imprime el token ni parcialmente. Sin WA_CLOUD_TOKEN explica qué falta.
 */
import 'dotenv/config';

const GRAPH = process.env.WA_CLOUD_GRAPH_URL || 'https://graph.facebook.com';
const V = process.env.WA_CLOUD_API_VERSION || 'v21.0';
const BUSINESS_ID = process.env.META_BUSINESS_ID || '796163885437265';
const TOKEN = process.env.WA_CLOUD_TOKEN || '';
// Las que HOY se mandan. Las v1 de pedido_listo quedaron con el horario viejo
// ("9 a 20", sin sábado) y Meta no deja editar una plantilla aprobada, así que
// se reemplazaron por las _v2 (1/9/26) — y esas, horas después el mismo día,
// por las _v3 ("9 a 20" real). Vigilar las viejas era vigilar algo que ya
// nadie manda. OJO: pedido_listo_v3/pedido_listo_saldo_v3 estaban PENDING de
// aprobación al momento del cambio de código — si este check las marca como
// no aprobadas, es esperable hasta que Meta responda, no un bug.
// aviso_pago_interno y nota_interna son las INTERNAS (van al celular del
// equipo, no a clientes): el 3/9/26 aviso_pago_interno no existía en Meta y
// nadie lo veía porque no estaba en esta lista — el aviso de cada pago cobrado
// moría en silencio.
const CATALOGO = ['pedido_listo_v3', 'pedido_listo_saldo_v3', 'venta_confirmada', 'comprobante_pago', 'presupuesto', 'presupuesto_pdf', 'pedido_enviado', 'estado_pedido', 'factura_electronica', 'retomar_conversacion', 'aviso_pago_interno', 'nota_interna'];

const ok = (s) => `✅ ${s}`, warn = (s) => `⚠️  ${s}`, bad = (s) => `❌ ${s}`;

async function g(path) {
    const sep = path.includes('?') ? '&' : '?';
    const r = await fetch(`${GRAPH}/${V}/${path}${sep}access_token=${TOKEN}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${path.split('?')[0]} → ${r.status} ${j?.error?.message || ''} (code ${j?.error?.code || '?'})`);
    return j;
}

async function main() {
    console.log('WhatsApp Cloud API — diagnóstico (solo lectura)\n');
    if (!TOKEN) {
        console.log(bad('Falta WA_CLOUD_TOKEN en .env.'));
        console.log('   Es un token de system user con los permisos whatsapp_business_management y');
        console.log('   whatsapp_business_messaging (los tokens META_* que hay son de contenido/ads y no sirven).');
        console.log('   Se genera en business.facebook.com → Configuración → Usuarios del sistema → Generar token.');
        process.exit(2);
    }

    // 1. Token
    let scopes = [];
    try {
        const d = await g(`debug_token?input_token=${TOKEN}`);
        scopes = d.data?.scopes || [];
        console.log(`Token: app ${d.data?.app_id} · tipo ${d.data?.type} · vence ${d.data?.expires_at ? new Date(d.data.expires_at * 1000).toISOString() : 'nunca'}`);
        console.log(`Permisos: ${scopes.join(', ')}`);
        for (const p of ['whatsapp_business_management', 'whatsapp_business_messaging']) console.log(scopes.includes(p) ? ok(p) : bad(`falta ${p}`));
    } catch (e) { console.log(bad(`No se pudo inspeccionar el token: ${e.message}`)); }

    // 2. WABAs del Business
    let wabas = [];
    for (const edge of ['owned_whatsapp_business_accounts', 'client_whatsapp_business_accounts']) {
        try {
            const r = await g(`${BUSINESS_ID}/${edge}?fields=id,name,account_review_status,message_template_namespace,timezone_id`);
            for (const w of r.data || []) wabas.push({ ...w, via: edge });
        } catch (e) { console.log(warn(`${edge}: ${e.message}`)); }
    }
    console.log(`\nWABAs del Business ${BUSINESS_ID}: ${wabas.length}`);
    if (!wabas.length) {
        console.log(warn('No hay ninguna cuenta de WhatsApp Business visible. Puede que (a) el token no vea el Business, (b) haya que crearla (Fase 1 paso 1), o (c) esté en OTRO Business Manager de una vinculación anterior — mirar en business.facebook.com → Configuración → Cuentas → Cuentas de WhatsApp.'));
    }

    const salida = [];
    for (const w of wabas) {
        console.log(`\n── WABA ${w.id} · "${w.name}" · revisión ${w.account_review_status || '?'} · (${w.via})`);
        // 3. Números
        try {
            const r = await g(`${w.id}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,messaging_limit_tier,name_status,code_verification_status,platform_type,status,is_official_business_account`);
            for (const p of r.data || []) {
                const num = (p.display_phone_number || '').replace(/\D/g, '');
                console.log(`   Número ${p.display_phone_number} (id ${p.id})`);
                console.log(`     nombre: ${p.verified_name || '?'} [${p.name_status || '?'}] · calidad ${p.quality_rating || '?'} · límite ${p.messaging_limit_tier || '?'} · verificación ${p.code_verification_status || '?'} · plataforma ${p.platform_type || '?'} · estado ${p.status || '?'}`);
                if (p.platform_type === 'CLOUD_API') console.log('     ' + ok('ya está registrado en la Cloud API'));
                else if (p.platform_type === 'ON_PREMISE') console.log('     ' + warn('está en API On-Premise (vieja): hay que migrarlo a Cloud API'));
                else if (p.platform_type === 'NOT_APPLICABLE') console.log('     ' + warn('número cargado pero NO registrado en la API: falta POST /{id}/register con PIN'));
                if (num === '5493518685644') console.log('     ' + ok('ES el número de la tienda'));
                salida.push({ waba: w.id, phoneId: p.id, num, verified: p.verified_name, platform: p.platform_type });
            }
            if (!(r.data || []).length) console.log('   (sin números)');
        } catch (e) { console.log('   ' + bad(`phone_numbers: ${e.message}`)); }

        // 4. Plantillas
        try {
            const r = await g(`${w.id}/message_templates?fields=name,language,status,category&limit=200`);
            const list = r.data || [];
            console.log(`   Plantillas: ${list.length}` + (list.length ? ' → ' + list.map(t => `${t.name}[${t.status}]`).join(', ') : ''));
            const faltan = CATALOGO.filter(n => !list.some(t => t.name === n));
            if (faltan.length) console.log('   ' + warn(`faltan del catálogo: ${faltan.join(', ')}`));
        } catch (e) { console.log('   ' + bad(`message_templates: ${e.message}`)); }

        // 5. Webhook
        try {
            const r = await g(`${w.id}/subscribed_apps`);
            const apps = r.data || [];
            console.log(apps.length ? '   ' + ok(`apps suscritas al webhook: ${apps.map(a => a.whatsapp_business_api_data?.name || a.whatsapp_business_api_data?.id || JSON.stringify(a)).join(', ')}`) : '   ' + warn('ninguna app suscrita al webhook de esta WABA (POST /{waba}/subscribed_apps al configurar)'));
        } catch (e) { console.log('   ' + warn(`subscribed_apps: ${e.message}`)); }
    }

    // 6. Variables
    const tienda = salida.find(s => s.num === '5493518685644') || salida[0];
    if (tienda) {
        console.log('\nVariables para Railway (servicio del bot):');
        console.log(`  WA_TRANSPORT=cloud`);
        console.log(`  WA_CLOUD_WABA_ID=${tienda.waba}`);
        console.log(`  WA_CLOUD_PHONE_NUMBER_ID=${tienda.phoneId}`);
        console.log(`  WA_CLOUD_TOKEN=(el token, sin pegarlo en ningún chat)`);
        console.log(`  WA_CLOUD_VERIFY_TOKEN=(string aleatorio) · META_APP_SECRET=(App Secret de la app con producto WhatsApp)`);
        if (tienda.num !== '5493518685644') console.log(warn(`el número encontrado (${tienda.num}) NO es el de la tienda: revisar antes de usar estos IDs`));
    }
}
main().catch(e => { console.error(bad(e.message)); process.exit(1); });
