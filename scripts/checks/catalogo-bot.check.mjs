/**
 * Un clip-on, un solo precio: el bot cotiza y manda fotos del MISMO universo.
 * Sin base ni red (también en CI).
 *
 *   npm run check:catalogo-bot
 *
 * Por qué (auditoría del 10/10/2026): `get_price_list` encontraba "Classic"
 * (marca Clip-on, NO publicado, $200.000) buscando "clip" en el nombre, y
 * `send_product_photos` mostraba Cápsula Escarlata ($175.000) por la categoría
 * de la tienda. Dos precios para el mismo pedido en la misma charla.
 * Criterio: el bot ofrece lo publicado en la tienda, en la categoría que ve el
 * cliente (src/lib/catalogo-del-bot.ts).
 */
import { readFileSync } from 'node:fs';
const { resolverPedidoDelBot, filtrosDeArmazonDelBot, esCategoriaDeArmazon, CATEGORIA_DE_TIENDA } = await import('../../src/lib/catalogo-del-bot.ts');

let fallas = 0;
const ok = (m) => console.log(`  ✅ ${m}`);
const mal = (m) => { fallas++; console.log(`  ❌ ${m}`); };
const check = (m, cond) => (cond ? ok(m) : mal(m));
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('\nEl pedido del modelo se normaliza igual para cotizar y para fotos');
check('search "clip on" sin categoría → CLIPON y sin texto', igual(resolverPedidoDelBot(null, 'clip on'), { categoria: 'CLIPON', search: null }));
check('search "clipones" con CLIPON → CLIPON y sin texto', igual(resolverPedidoDelBot('CLIPON', 'clipones'), { categoria: 'CLIPON', search: null }));
check('search "Clip-On" con categoría ARMAZON → CLIPON', resolverPedidoDelBot('armazon', 'Clip-On').categoria === 'CLIPON');
check('un modelo puntual dentro de CLIPON se conserva ("Torino")', igual(resolverPedidoDelBot('clipon', 'Torino'), { categoria: 'CLIPON', search: 'Torino' }));
check('los cristales no se tocan ("clip" en MULTIFOCAL no cambia la categoría)', resolverPedidoDelBot('MULTIFOCAL', 'clip').categoria === 'MULTIFOCAL');
check('ARMAZON, SOL y CLIPON son categorías de armazón; MONOFOCAL no', esCategoriaDeArmazon('ARMAZON') && esCategoriaDeArmazon('SOL') && esCategoriaDeArmazon('CLIPON') && !esCategoriaDeArmazon('MONOFOCAL'));

console.log('\nEl universo de un armazón es lo publicado en la tienda');
const f = filtrosDeArmazonDelBot('CLIPON');
check('exige publishToWeb', f.some(x => igual(x, { publishToWeb: true })));
check(`exige la categoría de la tienda ("${CATEGORIA_DE_TIENDA.CLIPON}") activa`, f.some(x => igual(x, { webProducts: { some: { category: 'Clip-On', isActive: true } } })));
check('exige un precio real', f.some(x => igual(x, { price: { gt: 1 } })));

console.log('\nLa ruta usa el resolvedor en las DOS ramas');
const ruta = readFileSync(new URL('../../src/app/api/bot/pricing/route.ts', import.meta.url), 'utf8');
check('resuelve el pedido con resolverPedidoDelBot', ruta.includes('resolverPedidoDelBot(searchParams.get(\'category\'), searchParams.get(\'search\'))'));
check('los armazones usan filtrosDeArmazonDelBot sin depender de paraFotos', /if \(category && esArmazon\) \{\s*filtros\.push\(\.\.\.filtrosDeArmazonDelBot\(category\)\)/.test(ruta));
check('ya no busca clip-ons por "clip" en el nombre o la marca', !/contains: 'clip'/.test(ruta) && !/sanitizedSearch = 'clip'/.test(ruta));
check('los armazones no dependen de "recomendados" (0 marcados)', /!paraFotos && !esArmazon && \(onlyBotRecommended \|\| !search\)/.test(ruta));
check('la plata sigue saliendo de PricingService', ruta.includes('PricingService.preciosVidriera('));

console.log('');
if (fallas) { console.log(`❌ ${fallas} falla(s).`); process.exit(1); }
console.log('✅ Catálogo del bot: un universo para cotizar y para fotos.');
