#!/usr/bin/env node
// ────────────────────────────────────────────────────────────────────────────
// Carga o muestra los CÓDIGOS DE VENDEDOR de Optovisión (los que el laboratorio
// le asignó a cada persona del equipo, ej. VERO02): el asunto del mail de la
// promo los lleva (lab-modules/optovision/promo-mail.ts). Viven en
// SystemSetting `optovision_codigos_vendedor` como JSON { "Nombre como figura
// en labSentBy": "CODIGO" }.
//
//   node scripts/maintenance/precios-optovision/codigos-vendedor.mjs                   → muestra
//   node scripts/maintenance/precios-optovision/codigos-vendedor.mjs --set "Verónica Pérez=VERO02"
//   … --prod   → contra PROD_DATABASE_URL (ESCRIBE en producción: solo con OK de Ishtar)
//
// Sin --prod pega a DATABASE_URL del .env (la base local).
// ────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
config();

const args = process.argv.slice(2);
const prod = args.includes('--prod');
const url = prod ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) { console.error(prod ? 'Falta PROD_DATABASE_URL' : 'Falta DATABASE_URL'); process.exit(1); }
const prisma = new PrismaClient({ datasources: { db: { url } } });
const KEY = 'optovision_codigos_vendedor';

const fila = await prisma.systemSetting.findUnique({ where: { key: KEY } });
let mapa = {};
try { mapa = fila?.value ? JSON.parse(fila.value) : {}; } catch { mapa = {}; }
const sets = args.filter(a => a.startsWith('--set')).length ? args.flatMap((a, i) => (a === '--set' ? [args[i + 1]] : a.startsWith('--set=') ? [a.slice(6)] : [])) : [];
for (const s of sets) {
    const [nombre, codigo] = String(s).split('=');
    if (!nombre || !codigo) { console.error(`--set espera "Nombre=CODIGO", vino "${s}"`); process.exit(1); }
    mapa[nombre.trim()] = codigo.trim().toUpperCase();
}
if (sets.length) {
    await prisma.systemSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: JSON.stringify(mapa) }, update: { value: JSON.stringify(mapa) } });
    console.log(`Guardado en ${prod ? 'PRODUCCIÓN' : 'la base local'}.`);
}
console.log(JSON.stringify(mapa, null, 2));
await prisma.$disconnect();
