#!/usr/bin/env node
/**
 * Verificación de un token de Meta ANTES de usarlo en cualquier otro script.
 *
 * Chequea: identidad, scopes otorgados, tipo de token (SYSTEM_USER vs USER)
 * y expiración. Escribe el detalle en scripts/ads/token_info.json (gitignoreado)
 * e imprime un veredicto en lenguaje claro.
 *
 * Uso:
 *   node scripts/ads/verify_token.js            → verifica META_ADS_TOKEN (lectura)
 *   node scripts/ads/verify_token.js --write    → verifica META_ADS_WRITE_TOKEN
 *
 * Salida: exit 0 = usable; exit 2 = NO usar (problema duro).
 */

const fs = require('fs');
const path = require('path');
const { get, debugToken, MetaApiError } = require('./lib/meta_client');

const checkingWrite = process.argv.includes('--write');

async function main() {
  const varName = checkingWrite ? 'META_ADS_WRITE_TOKEN' : 'META_ADS_TOKEN';
  const token = process.env[varName];
  if (!token) {
    console.error(`No hay ${varName} en el entorno.`);
    process.exit(2);
  }

  // /me sí funciona con cualquier tipo de token (USER o SYSTEM_USER).
  const me = await get('me', { fields: 'id,name' }, token);
  // Los scopes salen de debug_token.scopes — funciona para todo tipo de token,
  // a diferencia de /me/permissions, que es un edge de User y no existe en
  // SystemUser (el tipo de token recomendado por scripts/ads/CLAUDE.md).
  const debug = await debugToken(token);

  const info = debug.data || {};
  if (info.is_valid === false) {
    console.error(`\n✗ Meta reporta el token como inválido: ${info.error?.message || 'sin detalle'}.`);
    process.exit(2);
  }
  const granted = Array.isArray(info.scopes) ? info.scopes : [];
  const expiresAt = Number(info.expires_at || 0);
  const type = info.type || 'unknown';

  const out = {
    checked_token: varName,
    me,
    permissions_granted: granted,
    type,
    expires_at: expiresAt,
    app_id: info.app_id,
    checked_at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(__dirname, 'token_info.json'), JSON.stringify(out, null, 2));

  console.log(`\n=== Verificación de token (${varName}) ===\n`);
  console.log(`Identidad: ${me.name || me.id}`);
  console.log(`Tipo: ${type}`);
  console.log(`Scopes: ${granted.join(', ') || '(ninguno)'}`);
  console.log(
    `Expira: ${expiresAt === 0 ? 'nunca (token de sistema)' : new Date(expiresAt * 1000).toISOString().slice(0, 10)}`,
  );

  let hardFail = false;
  const warnings = [];

  if (!checkingWrite && granted.includes('ads_management')) {
    warnings.push(
      'Este token de LECTURA tiene ads_management: puede modificar anuncios. ' +
        'Conviene regenerarlo solo con ads_read y usar un token aparte para escritura.',
    );
  }
  if (checkingWrite && !granted.includes('ads_management')) {
    console.error('\n✗ El token de escritura NO tiene ads_management — no sirve para escribir.');
    hardFail = true;
  }
  if (!checkingWrite && !granted.includes('ads_read') && !granted.includes('ads_management')) {
    console.error('\n✗ El token no tiene ads_read — no va a poder leer campañas.');
    hardFail = true;
  }
  if (type === 'USER') {
    warnings.push(
      'Token personal (emitido a tu nombre): funciona, pero un problema afecta tu cuenta personal. ' +
        'Mejor un token de usuario de sistema del Business Manager.',
    );
  }
  if (expiresAt > 0) {
    const daysLeft = Math.floor((expiresAt * 1000 - Date.now()) / 864e5);
    if (daysLeft < 0) {
      console.error('\n✗ El token ya expiró.');
      hardFail = true;
    } else if (daysLeft < 7) {
      warnings.push(`El token expira en ${daysLeft} día(s) — regenerarlo pronto.`);
    }
  }

  for (const w of warnings) console.log(`\n⚠ ${w}`);
  if (hardFail) process.exit(2);
  console.log('\n✓ Token usable.');
}

main().catch((e) => {
  const msg = e instanceof MetaApiError ? `${e.message}\n${e.guidance}` : e.message;
  console.error(`\n✗ ${msg}`);
  process.exit(2);
});
