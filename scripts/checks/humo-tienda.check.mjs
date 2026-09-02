#!/usr/bin/env node
/**
 * Tests de humo de la tienda — Anexo D del plan de modernización UX (2/9/2026).
 *
 * Abre el sitio en un navegador real y verifica lo que ninguna revisión de
 * código puede: que el nombre y el precio se VEAN, que no haya nodos fantasma,
 * que los precios estén en formato argentino y que los presupuestos de layout
 * y de área táctil se cumplan.
 *
 * POR QUÉ NO ES @playwright/test
 * El plan escribe los tests para ese runner, pero el proyecto ya tiene la
 * librería `playwright` instalada (la usa el render de las placas de redes) y
 * NO tiene el runner, que es un paquete aparte. Todo lo que verifica algo acá
 * vive en `scripts/checks/*.check.mjs` y corre con `npm run check:*`. Se sigue
 * esa convención: mismas aserciones, cero dependencias nuevas, y el mismo
 * comando que el resto. El propio plan avisa que los archivos que menciona son
 * hipótesis y que hay que confirmar contra el código antes de editar.
 *
 * DOS NIVELES, A PROPÓSITO
 *   BLOQUEANTE — lo de la Fase 0. Si falla, el proceso sale con código 1.
 *                Son los que hoy pasan: no se agrega una alarma que ya suena.
 *   PRESUPUESTO — los topes de layout y accesibilidad de las Fases 1 y 3.
 *                Hoy varios no se cumplen todavía; se reportan con el número
 *                real y NO cortan. A medida que se cumplen, se pasan a
 *                bloqueantes moviéndolos de lista. Es el mismo criterio que
 *                `orden-del-repo.deuda.json`: la deuda conocida no frena, la
 *                deuda nueva sí.
 *
 * Uso:
 *   npm run check:humo                       (contra http://localhost:3000)
 *   BASE_URL=http://localhost:3005 npm run check:humo
 *   BASE_URL=https://atelieroptica.com.ar npm run check:humo
 *
 * Necesita el sitio levantado. Si no responde, avisa y sale con 1.
 */

import { chromium } from 'playwright';

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const MOBILE = { width: 375, height: 812 };

/** Fichas a auditar. Se puede pasar otra lista con FICHAS=a,b,c */
const FICHAS = (process.env.FICHAS || 'roma-c1,andromeda-c3,hestia-c1')
  .split(',').map(s => s.trim()).filter(Boolean);

const bloqueantes = [];
const presupuestos = [];
const fallo = (lista, id, detalle) => lista.push({ id, detalle });

const ok = (t) => console.log(`  ✅ ${t}`);
const mal = (t) => console.log(`  ❌ ${t}`);
const info = (t) => console.log(`  ·  ${t}`);

async function main() {
  const navegador = await chromium.launch();
  const contexto = await navegador.newContext({ viewport: MOBILE });
  const page = await contexto.newPage();

  // Errores de consola POR PÁGINA, no acumulados.
  //
  // La primera versión de este check juntaba todo en una lista sola, así que
  // decía "3 errores de hidratación" sin poder nombrar en cuál de las cinco
  // páginas estaban — y hubo que aislarlo a mano. Un check que detecta un
  // problema pero no dice dónde obliga a repetir su propio trabajo.
  let rutaActual = '/';
  const erroresPorRuta = new Map();
  page.on('console', m => {
    if (m.type() !== 'error') return;
    if (!erroresPorRuta.has(rutaActual)) erroresPorRuta.set(rutaActual, []);
    erroresPorRuta.get(rutaActual).push(m.text());
  });
  /** Navega dejando registrado a qué ruta pertenecen los errores que salgan. */
  const ir = async (ruta, opciones = {}) => {
    rutaActual = ruta;
    return page.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle', timeout: 30000, ...opciones });
  };

  try {
    await ir('/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  } catch {
    console.error(`\n❌ No responde ${BASE}. Levantá el sitio (npm run dev) o pasá BASE_URL.\n`);
    await navegador.close();
    process.exit(1);
  }

  // ── D.1 · Nombre y precio visibles en la ficha ────────────────────────────
  //
  // El corazón del Anexo D. Siete nodos del bloque de compra quedaban en
  // opacity:0 para siempre cuando la hidratación fallaba: estaban en el HTML
  // (Google los indexaba) pero nadie los veía, en la única página donde se
  // decide la compra.
  console.log('\n▶ D.1 · Nombre y precio visibles en la ficha');
  let fichasAuditadas = 0;
  for (const slug of FICHAS) {
    const url = `${BASE}/producto/${slug}`;
    const r = await ir(`/producto/${slug}`).catch(() => null);
    if (!r || r.status() >= 400) {
      info(`${slug}: no existe en esta base, se saltea`);
      continue;
    }
    fichasAuditadas++;

    const medido = await page.evaluate(() => {
      const leer = (el) => {
        if (!el) return null;
        const cs = getComputedStyle(el);
        return { op: +cs.opacity, vis: cs.visibility, tf: cs.transform, txt: (el.textContent || '').trim().slice(0, 40) };
      };
      const h1 = document.querySelector('h1');
      // El precio no tiene data-testid en este proyecto: se lo busca por forma
      // ("$" + dígitos), que es como lo ve una persona.
      const precio = [...document.querySelectorAll('span, p')]
        .find(e => e.children.length === 0 && /^\$\s?[\d.]+$/.test((e.textContent || '').trim()));
      return { h1: leer(h1), precio: leer(precio) };
    });

    for (const [nombre, m] of Object.entries(medido)) {
      if (!m) {
        mal(`${slug}: no se encontró el ${nombre}`);
        fallo(bloqueantes, 'D.1', `${slug}: no se encontró el ${nombre}`);
        continue;
      }
      if (!(m.op > 0.99) || m.vis !== 'visible') {
        mal(`${slug} · ${nombre} "${m.txt}" — opacidad ${m.op}, visibility ${m.vis}`);
        fallo(bloqueantes, 'D.1', `${slug}: el ${nombre} tiene opacidad ${m.op}`);
      } else {
        ok(`${slug} · ${nombre} visible ("${m.txt}")`);
      }
    }
  }
  if (fichasAuditadas === 0) {
    mal('Ninguna de las fichas existe en esta base. Pasá FICHAS=slug1,slug2.');
    fallo(bloqueantes, 'D.1', 'no se pudo auditar ninguna ficha');
  }

  // ── D.2 · Guard genérico anti-fantasmas ──────────────────────────────────
  console.log('\n▶ D.2 · Sin contenido fantasma');
  const fantasmas = await page.evaluate(() =>
    [...document.querySelectorAll('*')]
      .filter(el => el.children.length === 0
        && (el.textContent || '').trim()
        && el.getBoundingClientRect().width > 30
        && +getComputedStyle(el).opacity < 0.99)
      .map(el => `${el.tagName}: ${(el.textContent || '').trim().slice(0, 40)}`)
      .slice(0, 10)
  );
  if (fantasmas.length) {
    fantasmas.forEach(f => mal(f));
    fallo(bloqueantes, 'D.2', `${fantasmas.length} nodo(s) con texto e invisibles`);
  } else {
    ok('Ningún nodo con texto queda invisible');
  }

  // ── D.5 · Formato de precios ─────────────────────────────────────────────
  //
  // Una coma de miles es la firma de toLocaleString() sin idioma: el servidor
  // resuelve en-US y el navegador es-AR, el HTML no coincide y React tira el
  // árbol al hidratar. Es la causa raíz más probable de D.1.
  console.log('\n▶ D.5 · Precios en formato es-AR');
  const conComa = await page.evaluate(() =>
    (document.body.innerText.match(/\$\s?\d{1,3},\d{3}/g) || []).slice(0, 8)
  );
  if (conComa.length) {
    conComa.forEach(p => mal(`precio con coma: ${p}`));
    fallo(bloqueantes, 'D.5', `${conComa.length} precio(s) en formato en-US`);
  } else {
    ok('Ningún precio con coma de miles');
  }

  // ── Errores de hidratación en consola ────────────────────────────────────
  console.log('\n▶ Errores de hidratación en consola');
  let totalHidratacion = 0;
  for (const [ruta, errores] of erroresPorRuta) {
    const h = errores.filter(e => /Hydration|hydrated|418|423|425/.test(e));
    if (!h.length) continue;
    totalHidratacion += h.length;
    mal(`${ruta} — ${h.length} error(es)`);
    // El nodo que difiere aparece después de los "..." del árbol que imprime
    // React; es la única parte del mensaje que dice QUÉ se rompió.
    const arbol = h[0].slice(h[0].indexOf('...'));
    arbol.split('\n').filter(l => /^[+-]\s/.test(l.trim())).slice(0, 2)
      .forEach(l => info(l.trim().slice(0, 120)));
  }
  if (totalHidratacion) {
    fallo(bloqueantes, 'hidratación', `${totalHidratacion} error(es) de hidratación`);
  } else {
    ok('Cero errores de hidratación en todas las rutas auditadas');
  }

  // ── D.3 · Presupuesto de layout (PRESUPUESTO, no bloqueante todavía) ─────
  console.log('\n▶ D.3 · Presupuesto de scroll y alto');
  await ir('/tienda');
  const tienda = await page.evaluate(() => {
    const c = document.querySelector('a[href^="/producto/"]');
    return {
      primerProducto: c ? Math.round(c.getBoundingClientRect().top + scrollY) : null,
      alto: document.body.scrollHeight,
    };
  });
  const medir = (etiqueta, valor, tope, id) => {
    if (valor === null) { info(`${etiqueta}: no se pudo medir`); return; }
    if (valor <= tope) ok(`${etiqueta}: ${valor} px (tope ${tope})`);
    else { mal(`${etiqueta}: ${valor} px — se pasa por ${valor - tope} px del tope de ${tope}`); fallo(presupuestos, id, `${etiqueta} ${valor} px > ${tope}`); }
  };
  medir('Scroll al 1er producto (tienda)', tienda.primerProducto, 650, 'D.3');
  medir('Alto total de /tienda', tienda.alto, 7000, 'D.3');

  await ir('/');
  const home = await page.evaluate(() => document.body.scrollHeight);
  medir('Alto total del home', home, 6000, 'D.3');

  // ── D.4 · Tap targets (PRESUPUESTO) ──────────────────────────────────────
  console.log('\n▶ D.4 · Área táctil mínima de 44 px');
  await ir('/tienda');
  const chicos = await page.evaluate(() =>
    [...document.querySelectorAll('button, a, input, [role=button]')]
      .filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.height < 44 || r.width < 44);
      })
      .map(el => `${(el.textContent || el.tagName).trim().slice(0, 24)} [${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}]`)
  );
  if (chicos.length) {
    mal(`${chicos.length} elemento(s) por debajo de 44 px`);
    chicos.slice(0, 6).forEach(c => info(c));
    fallo(presupuestos, 'D.4', `${chicos.length} targets < 44 px`);
  } else {
    ok('Todos los targets llegan a 44 px');
  }

  await navegador.close();

  // ── Veredicto ────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  if (presupuestos.length) {
    console.log(`\n⚠️  ${presupuestos.length} presupuesto(s) sin cumplir todavía (no cortan):`);
    presupuestos.forEach(p => console.log(`   · [${p.id}] ${p.detalle}`));
    console.log('   Son los topes de las Fases 1 y 3. Al cumplirse, pasarlos a bloqueantes.');
  }
  if (bloqueantes.length) {
    console.log(`\n❌ ${bloqueantes.length} falla(s) BLOQUEANTE(S):`);
    bloqueantes.forEach(b => console.log(`   · [${b.id}] ${b.detalle}`));
    console.log('\n   Regla: el estado final es el default; la animación es la excepción.');
    console.log('   El nombre y el precio salen visibles del servidor.\n');
    process.exit(1);
  }
  console.log('\n✅ Los tests bloqueantes del Anexo D pasan: nombre y precio visibles,');
  console.log('   sin contenido fantasma, sin errores de hidratación y precios en es-AR.\n');
}

main().catch(err => {
  console.error('\n❌ El check de humo se rompió:', err?.message);
  process.exit(1);
});
