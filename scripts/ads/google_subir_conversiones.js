#!/usr/bin/env node
/**
 * Sube a Google Ads las ventas ya cerradas del CRM (conversiones offline).
 *
 * PARA QUÉ
 * Google ve el clic del anuncio y nunca se entera de que terminó en venta,
 * porque el cierre ocurre por WhatsApp o en el mostrador. Sin esto, las
 * campañas pujan contra acciones blandas (ver el teléfono, pedir cómo llegar)
 * que valen todas lo mismo. Subir las ventas reales, con su importe, es lo que
 * le permite a Google optimizar por facturación.
 *
 * QUÉ CUENTA COMO VENTA
 * La misma regla que el resto del sistema (ver CLAUDE.md): venta real es la que
 * tiene PLATA COBRADA (filas de Payment) o pedido en laboratorio. NO se usa
 * `Order.total` ni `Order.paid`: hay presupuestos con total cargado y filas con
 * `paid` sin un solo pago detrás. Subir eso convertiría el backfill en la misma
 * inflación de conversiones que venimos a arreglar.
 *
 * CÓMO EMPAREJA
 * Por "conversiones mejoradas": mail y teléfono hasheados con SHA-256. Es lo
 * que sirve cuando no hay gclid, que es el caso de casi todo cierre por
 * WhatsApp. Requiere que la acción de conversión tenga habilitadas las
 * conversiones mejoradas en la interfaz de Google Ads.
 *
 * USO
 *   node scripts/ads/google_subir_conversiones.js              → ensayo: no llama a la API
 *   node scripts/ads/google_subir_conversiones.js 90           → ensayo, últimos 90 días
 *   node scripts/ads/google_subir_conversiones.js 90 --prod    → ensayo contra la base de producción
 *   GOOGLE_ADS_ALLOW_WRITES=1 node scripts/ads/google_subir_conversiones.js 90 --prod --validar
 *   GOOGLE_ADS_ALLOW_WRITES=1 node scripts/ads/google_subir_conversiones.js 90 --prod --subir
 *
 * El modo por defecto NO toca la API: arma el lote y lo muestra. `--validar`
 * manda el lote con validateOnly (Google revisa el formato y no registra nada).
 * `--subir` es el único que carga de verdad.
 *
 * Requiere las env vars de scripts/ads/lib/google_client.js más
 * GOOGLE_ADS_OFFLINE_CONVERSION_ACTION (id de la acción de conversión).
 */

const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { mutate, customerId, GoogleAdsApiError } = require('./lib/google_client');

const args = process.argv.slice(2);
const dias = Number(args.find((a) => /^\d+$/.test(a)) || 90);
const usarProd = args.includes('--prod');
const modoValidar = args.includes('--validar');
const modoSubir = args.includes('--subir');

// Google rechaza conversiones más viejas que la ventana de conversión de la
// acción (90 días es el techo habitual). Avisar antes de armar el lote.
if (dias > 90) {
  console.warn(`Aviso: ${dias} días supera la ventana típica de 90; Google puede rechazar las más viejas.\n`);
}

/** SHA-256 en hexadecimal, que es como Google hashea del otro lado. */
const hash = (v) => crypto.createHash('sha256').update(v).digest('hex');

/** Minúsculas y sin espacios. Si la normalización no coincide, el match falla en silencio. */
const normEmail = (e) => e.trim().toLowerCase();

/**
 * E.164 argentino. Espeja `formatPhoneForWhatsApp` de src/lib/phone-utils.ts
 * (no se puede importar: aquel es TS con alias de path y esto es CommonJS).
 */
function normPhoneE164(raw) {
  if (!raw) return null;
  let base = String(raw).replace(/\D/g, '');
  if (!base) return null;
  if (base.startsWith('549')) base = base.slice(3);
  else if (base.startsWith('54')) base = base.slice(2);
  if (base.startsWith('0')) base = base.slice(1);
  if (base.length > 10) {
    const m = base.match(/^([1-3]\d{1,3})15(\d{6,8})$/);
    if (m) base = m[1] + m[2];
  }
  return `+549${base}`;
}

/** `yyyy-MM-dd HH:mm:ss-03:00`. Argentina no tiene horario de verano. */
function fechaConversion(d) {
  const ar = new Date(d.getTime() - 3 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${ar.getUTCFullYear()}-${p(ar.getUTCMonth() + 1)}-${p(ar.getUTCDate())} ` +
    `${p(ar.getUTCHours())}:${p(ar.getUTCMinutes())}:${p(ar.getUTCSeconds())}-03:00`
  );
}

const fmt = (n) => Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 });

async function main() {
  const cid = customerId();
  const accionRaw = process.env.GOOGLE_ADS_OFFLINE_CONVERSION_ACTION?.trim();
  if (!accionRaw) {
    console.error(
      'Falta GOOGLE_ADS_OFFLINE_CONVERSION_ACTION.\n' +
        'Hay que crear la acción de conversión en Google Ads (Objetivos → Conversiones → Nueva,\n' +
        'origen "Importar", con conversiones mejoradas habilitadas) y cargar su id en el entorno.',
    );
    process.exit(1);
  }
  const conversionAction = accionRaw.startsWith('customers/')
    ? accionRaw
    : `customers/${cid}/conversionActions/${accionRaw.replace(/\D/g, '')}`;

  const prisma = usarProd
    ? new PrismaClient({ datasources: { db: { url: process.env.PROD_DATABASE_URL } } })
    : new PrismaClient();

  const desde = new Date(Date.now() - dias * 864e5);

  // Se traen las órdenes del período con sus pagos y su cliente. El filtro de
  // "venta real" se aplica abajo, en código, porque depende de los pagos.
  const ordenes = await prisma.order.findMany({
    where: { createdAt: { gte: desde }, isDeleted: false },
    select: {
      id: true,
      total: true,
      status: true,
      labStatus: true,
      createdAt: true,
      payments: { select: { amount: true } },
      client: { select: { email: true, phone: true } },
    },
  });

  const conversiones = [];
  const descartes = { noEsVenta: 0, sinContacto: 0, sinImporte: 0 };

  for (const o of ordenes) {
    if (['LOST', 'CANCELED'].includes(o.status || '')) {
      descartes.noEsVenta++;
      continue;
    }
    const cobrado = o.payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const enFabrica = Boolean(o.labStatus);
    // La regla de oro: cobrado o en laboratorio. Un presupuesto no es una venta.
    if (cobrado <= 0 && !enFabrica) {
      descartes.noEsVenta++;
      continue;
    }

    // Se sube lo efectivamente cobrado; si todavía no hay pagos pero ya está en
    // fábrica, el total de la orden es el mejor valor disponible.
    const valor = cobrado > 0 ? cobrado : Number(o.total || 0);
    if (!(valor > 0)) {
      descartes.sinImporte++;
      continue;
    }

    const ids = [];
    if (o.client?.email) ids.push({ hashedEmail: hash(normEmail(o.client.email)) });
    if (o.client?.phone) {
      const e164 = normPhoneE164(o.client.phone);
      if (e164) ids.push({ hashedPhoneNumber: hash(e164) });
    }
    // Sin mail ni teléfono Google no tiene contra qué emparejar.
    if (ids.length === 0) {
      descartes.sinContacto++;
      continue;
    }

    conversiones.push({
      conversionAction,
      conversionDateTime: fechaConversion(o.createdAt),
      conversionValue: valor,
      currencyCode: 'ARS',
      // Desduplica: reprocesar el backfill no cuenta la venta dos veces.
      orderId: o.id,
      userIdentifiers: ids,
    });
  }

  const suma = conversiones.reduce((s, c) => s + c.conversionValue, 0);
  console.log(`\n═══ Conversiones offline · últimos ${dias} días · base ${usarProd ? 'PRODUCCIÓN' : 'local'} ═══\n`);
  console.log(`  Órdenes revisadas   : ${ordenes.length}`);
  console.log(`  Ventas a subir      : ${conversiones.length}`);
  console.log(`  Facturación         : $${fmt(suma)}`);
  console.log(`  Descartadas         : ${descartes.noEsVenta} no son venta · ${descartes.sinContacto} sin mail ni teléfono · ${descartes.sinImporte} sin importe`);
  console.log(`  Acción de conversión: ${conversionAction}\n`);

  if (conversiones.length === 0) {
    console.log('  Nada para subir.\n');
    await prisma.$disconnect();
    return;
  }

  if (!modoValidar && !modoSubir) {
    console.log('  Ensayo: no se llamó a la API. Ejemplo de la primera fila:\n');
    const muestra = { ...conversiones[0], userIdentifiers: conversiones[0].userIdentifiers.map((i) => Object.keys(i)[0] + ': <sha256>') };
    console.log(JSON.stringify(muestra, null, 2).split('\n').map((l) => '    ' + l).join('\n'));
    console.log('\n  Para validar contra Google sin registrar nada:');
    console.log(`    GOOGLE_ADS_ALLOW_WRITES=1 node scripts/ads/google_subir_conversiones.js ${dias}${usarProd ? ' --prod' : ''} --validar\n`);
    await prisma.$disconnect();
    return;
  }

  // Google acepta hasta 2000 conversiones por request.
  const LOTE = 2000;
  let subidas = 0;
  for (let i = 0; i < conversiones.length; i += LOTE) {
    const tanda = conversiones.slice(i, i + LOTE);
    const payload = {
      conversions: tanda,
      // Sin esto, una sola fila mal formada tira abajo el lote entero.
      partialFailure: true,
      validateOnly: modoValidar,
    };
    // El flag `--validar` / `--subir` tipeado por el usuario ES la confirmación
    // explícita que exige el cliente; el gate de GOOGLE_ADS_ALLOW_WRITES sigue
    // siendo obligatorio y se pasa inline en el comando.
    const res = await mutate(`customers/${cid}:uploadClickConversions`, payload, { confirm: true });
    if (res?.partialFailureError) {
      console.error('\n  Google rechazó filas del lote:\n');
      console.error(JSON.stringify(res.partialFailureError, null, 2).slice(0, 2000));
    }
    subidas += tanda.length;
    console.log(`  ${modoValidar ? 'Validadas' : 'Subidas'}: ${subidas}/${conversiones.length}`);
  }

  console.log(
    modoValidar
      ? '\n  Validación terminada. No se registró ninguna conversión.\n'
      : '\n  Listo. Google tarda hasta 3 horas en mostrarlas en la interfaz.\n',
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  if (e instanceof GoogleAdsApiError) {
    console.error(`\nError de Google Ads: ${e.message}`);
    if (e.guidance) console.error(`Qué hacer: ${e.guidance}`);
  } else {
    console.error('\nError:', e.message);
  }
  process.exit(1);
});
