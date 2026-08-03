#!/usr/bin/env node
/**
 * Crea las fichas de cliente que el extractor pasivo debió crear y no creó.
 *
 * EL PROBLEMA
 * El 54% de los chats de WhatsApp de los últimos 90 días no tiene ficha de
 * cliente. Sin ficha no hay a quién buscarle órdenes, así que esas ventas son
 * invisibles para cualquier medición de retorno publicitario: es la razón por
 * la que el ROAS de Meta da 1 cierre sobre 301 conversaciones.
 *
 * NO es que el vínculo se haya roto: de 809 chats huérfanos, 808 directamente
 * NO tienen un Client con ese teléfono. La ficha nunca se creó.
 *
 * NO es una regresión vieja tampoco. Medido por mes sobre chats que cumplen la
 * regla del extractor (nombre válido + teléfono válido):
 *
 *     2026-06   253 con ficha · 154 sin ficha   (38%)
 *     2026-07   257 con ficha · 182 sin ficha   (41%)
 *
 * Es un ~40% sostenido. La causa más probable es que la extracción se programa
 * con un `setTimeout` de 20 s guardado en un Map EN MEMORIA
 * (`wa-service/index.js:1793`): si el proceso reinicia —y el bot corre sobre
 * Puppeteer, que reinicia seguido— el temporizador se pierde y nadie lo
 * reintenta. Este script es la red de seguridad; arreglar la causa es aparte.
 *
 * QUÉ CREA Y QUÉ NO
 * Aplica EXACTAMENTE la misma regla que `wa-service/passive-extractor.js`:
 * nombre válido + teléfono válido. Ante la duda no crea (mejor ninguna ficha
 * que una basura). No inventa nombres, no usa el número como nombre, y saltea
 * los chats cuyo teléfono ya tiene ficha.
 *
 * USO
 *   node scripts/maintenance/crear-fichas-chats-huerfanos.js            → informe, no escribe
 *   node scripts/maintenance/crear-fichas-chats-huerfanos.js 90 --prod  → informe contra producción
 *   node scripts/maintenance/crear-fichas-chats-huerfanos.js 90 --prod --crear
 *
 * Sin `--crear` NO TOCA NADA. Con `--crear` escribe en la base indicada.
 */

const { PrismaClient } = require('@prisma/client');
const { isPhrase } = require('../../wa-service/tools');

const args = process.argv.slice(2);
const dias = Number(args.find((a) => /^\d+$/.test(a)) || 90);
const usarProd = args.includes('--prod');
const crear = args.includes('--crear');

/** Espejo de `esNombreValido` de wa-service/passive-extractor.js:24. */
function esNombreValido(nombre) {
  if (!nombre || typeof nombre !== 'string') return false;
  const limpio = nombre.trim();
  if (limpio.length < 2) return false;
  if ((limpio.match(/\d/g) || []).length >= 5) return false;
  const generico = limpio.toLowerCase();
  if (['contacto nuevo wa', 'contacto nuevo', 'cliente', 'desconocido', '-', 'sin nombre'].includes(generico)) return false;
  try {
    if (isPhrase(limpio)) return false;
  } catch {
    /* isPhrase depende del bot; ante la duda dejamos pasar el nombre */
  }
  return true;
}

/** Espejo de `formatPhoneForWhatsApp` de src/lib/phone-utils.ts. */
function normalizar(phone) {
  if (!phone) return '';
  let b = String(phone).replace(/\D/g, '');
  if (!b) return '';
  if (b.startsWith('549')) b = b.slice(3);
  else if (b.startsWith('54')) b = b.slice(2);
  if (b.startsWith('0')) b = b.slice(1);
  if (b.length > 10) {
    const m = b.match(/^([1-3]\d{1,3})15(\d{6,8})$/);
    if (m) b = m[1] + m[2];
  }
  return '549' + b;
}

function telefonoValido(realPhone) {
  if (!realPhone) return null;
  const d = String(realPhone).replace(/\D/g, '');
  return d.length >= 8 && d.length <= 15 ? realPhone : null;
}

async function main() {
  const prisma = usarProd
    ? new PrismaClient({ datasources: { db: { url: process.env.PROD_DATABASE_URL } } })
    : new PrismaClient();

  const desde = new Date(Date.now() - dias * 864e5);

  const huerfanos = await prisma.whatsAppChat.findMany({
    where: { createdAt: { gte: desde }, clientId: null },
    select: { id: true, waId: true, realPhone: true, profileName: true, adTag: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  // Índice de teléfonos ya fichados, para no duplicar.
  const clientes = await prisma.client.findMany({ select: { id: true, phone: true } });
  const porTelefono = new Map();
  for (const c of clientes) {
    const k = normalizar(c.phone);
    if (k && !porTelefono.has(k)) porTelefono.set(k, c.id);
  }

  const aCrear = [];
  const descartes = { sinNombre: 0, sinTelefono: 0, yaExiste: 0 };

  for (const ch of huerfanos) {
    const telefono = telefonoValido(ch.realPhone);
    if (!telefono) {
      descartes.sinTelefono++;
      continue;
    }
    if (!esNombreValido(ch.profileName)) {
      descartes.sinNombre++;
      continue;
    }
    const clave = normalizar(telefono);
    if (porTelefono.has(clave)) {
      // La ficha existe pero el chat quedó suelto: se revincula, no se duplica.
      aCrear.push({ chat: ch, telefono, clave, clienteExistente: porTelefono.get(clave) });
      descartes.yaExiste++;
      continue;
    }
    aCrear.push({ chat: ch, telefono, clave, clienteExistente: null });
  }

  const nuevas = aCrear.filter((x) => !x.clienteExistente);
  const revincular = aCrear.filter((x) => x.clienteExistente);
  const conEtiqueta = nuevas.filter((x) => x.chat.adTag).length;

  console.log(`\n═══ Fichas faltantes · últimos ${dias} días · base ${usarProd ? 'PRODUCCIÓN' : 'local'} ═══\n`);
  console.log(`  Chats sin ficha            : ${huerfanos.length}`);
  console.log(`  Fichas a CREAR             : ${nuevas.length}   (${conEtiqueta} vienen de un anuncio)`);
  console.log(`  Chats a REVINCULAR         : ${revincular.length}   (la ficha ya existe)`);
  console.log(`  Descartados                : ${descartes.sinNombre} sin nombre usable · ${descartes.sinTelefono} sin teléfono\n`);

  if (!aCrear.length) {
    console.log('  Nada para hacer.\n');
    await prisma.$disconnect();
    return;
  }

  console.log('  Muestra de lo que se crearía:');
  for (const x of nuevas.slice(0, 8)) {
    console.log(`    ${x.chat.profileName.trim().padEnd(28)} ${x.telefono.padEnd(16)} ${x.chat.adTag ? '[' + x.chat.adTag + ']' : ''}`);
  }

  if (!crear) {
    console.log('\n  Ensayo: no se tocó nada. Para aplicar, agregá --crear\n');
    await prisma.$disconnect();
    return;
  }

  let creadas = 0;
  let revinculadas = 0;
  for (const x of aCrear) {
    try {
      let clientId = x.clienteExistente;
      if (!clientId) {
        const nuevo = await prisma.client.create({
          data: {
            name: x.chat.profileName.trim(),
            phone: x.telefono,
            // De dónde vino: si el chat trae etiqueta de anuncio se respeta,
            // si no queda como contacto de WhatsApp. Nunca se inventa un origen.
            contactSource: x.chat.adTag ? 'Anuncio' : 'WhatsApp',
            adTag: x.chat.adTag || null,
          },
          select: { id: true },
        });
        clientId = nuevo.id;
        creadas++;
      } else {
        revinculadas++;
      }
      await prisma.whatsAppChat.update({ where: { id: x.chat.id }, data: { clientId } });
    } catch (e) {
      console.error(`    ✗ ${x.chat.profileName}: ${e.message}`);
    }
  }

  console.log(`\n  ✅ ${creadas} fichas creadas · ${revinculadas} chats revinculados a una ficha existente.\n`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('\nError:', e.message);
  process.exit(1);
});
