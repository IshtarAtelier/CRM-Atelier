// ────────────────────────────────────────────────────────────────────────────
// Verificación de la compuerta de "enviar a fábrica" / "convertir en venta".
// Deja FIJA la regla de la seña contra regresiones — fue la causa raíz del bug:
// el cliente usaba 40%, el servidor 50%, y el botón ignoraba la autorización.
//
// Correr:  npm run check:gate
// Usa el type-stripping nativo de Node ≥22.17 para importar el módulo .ts directo.
// ────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import {
  MIN_DEPOSIT_RATIO,
  minimumDeposit,
  meetsMinimumDeposit,
  effectiveAuthorization,
  depositClearsFactoryGate,
  canAuthorizeLowDeposit,
} from '../../src/lib/factory-gate.ts';

let passed = 0;
const check = (name, cond) => {
  assert.ok(cond, `FALLÓ: ${name}`);
  passed++;
  console.log(`  ✓ ${name}`);
};

console.log('\nCompuerta de fábrica — regla de la seña\n');

// — Umbral único —
check('el umbral es 50%', MIN_DEPOSIT_RATIO === 0.5);
check('minimumDeposit(100000) === 50000', minimumDeposit(100000) === 50000);
check('minimumDeposit(null) === 0', minimumDeposit(null) === 0);

// — Cobertura de la seña —
check('paga 50% justo → cubre', meetsMinimumDeposit(50000, 100000));
check('paga 49% → NO cubre', !meetsMinimumDeposit(49000, 100000));

// — Compuerta SIN autorización —
check('seña insuficiente sin autorizar → BLOQUEADO',
  depositClearsFactoryGate({ paid: 30000, total: 100000, authorizedByAdmin: false }) === false);
check('seña suficiente → pasa aunque no esté autorizada',
  depositClearsFactoryGate({ paid: 60000, total: 100000, authorizedByAdmin: false }) === true);

// — Compuerta CON autorización del admin (el caso del bug) —
check('seña insuficiente PERO autorizada → ENVÍA a fábrica',
  depositClearsFactoryGate({ paid: 30000, total: 100000, authorizedByAdmin: true }) === true);
check('seña 0 autorizada → pasa',
  depositClearsFactoryGate({ paid: 0, total: 100000, authorizedByAdmin: true }) === true);

// — Autorización efectiva (footgun de autorizar + enviar en el mismo request) —
check('autoriza en el mismo PATCH (incoming true, DB false) → efectiva true',
  effectiveAuthorization(true, false) === true);
check('no toca la autorización (incoming undefined) → usa la de la DB',
  effectiveAuthorization(undefined, true) === true);
check('des-autoriza en el request (incoming false) → efectiva false',
  effectiveAuthorization(false, true) === false);

// — Quién puede autorizar —
check('ADMIN puede autorizar', canAuthorizeLowDeposit('ADMIN') === true);
check('STAFF (vendedor) NO puede autorizar', canAuthorizeLowDeposit('STAFF') === false);
check('rol indefinido NO puede autorizar', canAuthorizeLowDeposit(undefined) === false);

// — Escenario integral: el admin autoriza → el vendedor SÍ puede enviar —
check('el vendedor no autoriza pero SÍ envía un pedido ya autorizado',
  canAuthorizeLowDeposit('STAFF') === false &&
  depositClearsFactoryGate({ paid: 20000, total: 100000, authorizedByAdmin: true }) === true);

console.log(`\n✅ ${passed} checks OK — compuerta de fábrica blindada\n`);
