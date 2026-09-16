/**
 * Sube la edad mínima de 18 a 25 en los conjuntos que todavía la tenían en 18.
 *
 * POR QUÉ (Ishtar, 15/9/2026): "no gastaría en gente de 18 si se puede elegir,
 * cambialo". El conjunto de Multifocales ya excluye a los menores de 25; los
 * de Remarketing y ATP seguían en 18. Se alinean los tres al mismo piso.
 *
 * QUÉ NO TOCA: presupuesto, objetivo, públicos, geo, plataformas. Solo
 * `targeting.age_min`.
 *
 * OJO: cambiar targeting en un conjunto ACTIVO reinicia su fase de
 * aprendizaje. Autorizado explícitamente por Ishtar el 15/9/2026.
 *
 * Uso:
 *   node scripts/maintenance/meta-publicos/subir-edad-minima.mjs            → muestra qué haría
 *   node scripts/maintenance/meta-publicos/subir-edad-minima.mjs --aplicar  → lo aplica (guarda respaldo)
 *   node scripts/maintenance/meta-publicos/subir-edad-minima.mjs --revertir <respaldo.json>
 */
import 'dotenv/config';
import { writeFileSync, readFileSync } from 'node:fs';

const API = 'https://graph.facebook.com/v21.0';
const TOKEN = process.env.META_ADS_TOKEN || process.env.META_ACCESS_TOKEN;
const CUENTA = 'act_2107444353167176';
const NUEVA_EDAD_MIN = 25;
const CONJUNTOS = ['120250649502760023', '120248841166580023']; // Remarketing, ATP

const args = process.argv.slice(2);
const APLICAR = args.includes('--aplicar');
const REVERTIR = args.includes('--revertir') ? args[args.indexOf('--revertir') + 1] : null;

if (!TOKEN) { console.error('Falta META_ADS_TOKEN en el .env'); process.exit(1); }

const get = async (path, params = {}) => {
  const u = new URL(`${API}/${path}`);
  u.searchParams.set('access_token', TOKEN);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const j = await (await fetch(u)).json();
  if (j.error) throw new Error(j.error.message);
  return j;
};
const post = async (path, campos) => {
  const body = new URLSearchParams({ access_token: TOKEN, ...campos });
  const j = await (await fetch(`${API}/${path}`, { method: 'POST', body })).json();
  if (j.error) throw new Error(j.error.message);
  return j;
};

if (REVERTIR) {
  const previo = JSON.parse(readFileSync(REVERTIR, 'utf8'));
  for (const [id, snap] of Object.entries(previo)) {
    await post(id, { targeting: JSON.stringify(snap.targeting) });
    console.log('Restaurado', snap.name);
  }
  process.exit(0);
}

const respaldo = {};
for (const id of CONJUNTOS) {
  const s = await get(id, { fields: 'name, targeting, effective_status' });
  respaldo[id] = s;
  console.log(`${s.name}: edad ${s.targeting.age_min}-${s.targeting.age_max} → ${NUEVA_EDAD_MIN}-${s.targeting.age_max}`);
}

if (!APLICAR) { console.log('\n[modo muestra] No se escribió nada. Para aplicarlo: --aplicar'); process.exit(0); }

const sello = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const archivo = `respaldo-edad-${sello}.json`;
writeFileSync(archivo, JSON.stringify(respaldo, null, 2));
console.log(`\nRespaldo: ${archivo}`);

for (const id of CONJUNTOS) {
  const nuevo = JSON.parse(JSON.stringify(respaldo[id].targeting));
  // `age_range` es un campo de SOLO LECTURA que la Graph API devuelve junto a
  // age_min/age_max (a veces desincronizado, visto en ATP: age_min:18 con
  // age_range:[24,65]). Reenviarlo tal cual en el POST tira "Invalid parameter".
  delete nuevo.age_range;
  nuevo.age_min = NUEVA_EDAD_MIN;
  await post(id, { targeting: JSON.stringify(nuevo) });
  const verif = await get(id, { fields: 'targeting' });
  console.log(`✓ ${respaldo[id].name}: ahora ${verif.targeting.age_min}-${verif.targeting.age_max}`);
}
