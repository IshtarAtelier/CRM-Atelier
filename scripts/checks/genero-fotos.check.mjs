// ────────────────────────────────────────────────────────────────────────────
// A UN HOMBRE NO SE LE MANDAN MONTURAS DE MUJER.
//
// 16/9/2026 (Ishtar: "vi que confunde, si es hombre envía de mujer"): el
// filtro por género dependía de que el MODELO dedujera el género del nombre y
// lo pasara. Cuando no lo pasaba —lo habitual— no se filtraba nada. Ahora lo
// deduce el servidor de la ficha, y el que manda las fotos pone primero lo que
// de verdad corresponde.
//
// Puro: sin base y sin red.
//   node --experimental-strip-types --import ./scripts/checks/_alias.mjs scripts/checks/genero-fotos.check.mjs
// ────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { generoDeNombre } from '../../src/lib/nombre-genero.ts';

let ok = 0;
const fallas = [];
const check = (nombre, cond, extra = '') => {
    if (cond) { ok++; console.log(`  ✓ ${nombre}`); }
    else { fallas.push(nombre); console.log(`  ✗ ${nombre} ${extra}`); }
};

console.log('\nNombres que SÍ se saben');
for (const [n, esperado] of [
    ['Juan', 'HOMBRE'], ['Carlos Alberto', 'HOMBRE'], ['Maxi', 'HOMBRE'], ['Matias Turchi', 'HOMBRE'],
    ['Nicolas', 'HOMBRE'], ['Tomas', 'HOMBRE'], ['Germán', 'HOMBRE'], ['José María', 'HOMBRE'],
    ['María', 'MUJER'], ['Soledad', 'MUJER'], ['Milena Magallanes', 'MUJER'], ['Guadalupe', 'MUJER'],
    ['Andrea', 'MUJER'], ['Eva', 'MUJER'], ['Belén', 'MUJER'], ['Nahir', 'MUJER'],
    // Terminan en -a y son varón: la lista manda sobre la regla de la -a.
    ['Luca', 'HOMBRE'], ['Nicola', 'HOMBRE'],
]) {
    const r = generoDeNombre(n);
    check(`"${n}" → ${esperado}`, r === esperado, `(dio ${r})`);
}

console.log('\nAnte la duda, NADA (y el catálogo no se filtra)');
for (const n of ['Alex', 'Cris', 'Elia', 'Pérez', '', 'Jo', '3515551234', '🫵🏻💪']) {
    check(`"${n}" → null`, generoDeNombre(n) === null, `(dio ${generoDeNombre(n)})`);
}
check('null / undefined no rompen', generoDeNombre(null) === null && generoDeNombre(undefined) === null);

console.log('\nEl género lo decide el SERVIDOR, no el modelo');
const ruta = readFileSync(new URL('../../src/app/api/bot/pricing/route.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
check('la ruta lo deduce de la ficha cuando el bot no lo pasa', ruta.includes('generoDeNombre(ficha?.name)'));
check('lo que mande el modelo tiene prioridad', ruta.includes("if (genero !== 'HOMBRE' && genero !== 'MUJER' && clientIdConsulta)"));
check('el catálogo devuelve el género del armazón', ruta.includes('genero: p.gender || null') && (ruta.match(/^\s*gender: true,$/gm) || []).length === 3);
check('se siguen excluyendo los claramente del otro género', ruta.includes("const opuesto = genero === 'HOMBRE' ? 'femenino' : 'masculino'"));

const tools = readFileSync(new URL('../../wa-service/tools.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
check('el que manda fotos pasa SIEMPRE el clientId', tools.includes('if (fichaDelChat?.clientId) params.clientId = fichaDelChat.clientId;'));
check('el género pesa más que "recomendado" y "publicado"', tools.includes('puntajeDeGenero(p) * 10'));

console.log('\nAl cliente no se le nombra el género, y se le manda el catálogo');
{
    const tools = readFileSync(new URL('../../wa-service/tools.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    check('el bot tiene prohibido decir "unisex" / "de hombre" / "de mujer"', tools.includes('PROHIBIDO decirle al cliente que un armazón es "unisex"'));
    check('después de las fotos manda el link del catálogo', tools.includes('MANDALE TAMBIÉN el catálogo'));
    // El link, armado como lo arma el bot.
    const trozo = tools.slice(tools.indexOf('const CATEGORIA_A_SLUG'), tools.indexOf('/**\n * Tool: mandarle al cliente hasta 3 fotos'));
    const linkDelCatalogo = new Function(`${trozo}; return linkDelCatalogo;`)();
    const B = 'https://atelieroptica.com.ar';
    for (const [genero, categoria, esperado] of [
        ['HOMBRE', 'ARMAZON', `${B}/catalogo/hombre`],
        ['MUJER', 'ARMAZON', `${B}/catalogo/mujer`],
        ['MUJER', 'SOL', `${B}/catalogo/mujer/sol`],
        ['HOMBRE', 'CLIPON', `${B}/catalogo/hombre/clip-on`],
        [null, 'SOL', `${B}/catalogo/sol`],
        [null, 'CLIPON', `${B}/catalogo/clip-on`],
        [null, 'ARMAZON', `${B}/tienda`],
        ['MUJER', 'RECETA', `${B}/catalogo/mujer`],
    ]) {
        const r = linkDelCatalogo(genero, categoria, null);
        check(`${genero || 'sin género'} + ${categoria} → ${esperado.replace(B, '')}`, r === esperado, `(dio ${r})`);
    }

    const { generoDeSlug, tipoDeSlug, rutaDeCatalogo, etiquetaDeGenero, TIPOS_DE_CATALOGO } = await import('../../src/lib/constants/genero-catalogo.ts');
    check('/catalogo/hombre lleva al filtro homme', generoDeSlug('hombre')?.id === 'homme' && generoDeSlug('mujer')?.id === 'femme');
    check('los tres tipos tienen dirección propia', TIPOS_DE_CATALOGO.length === 3 && tipoDeSlug('clip-on')?.categoria === 'Clip-On' && tipoDeSlug('sol')?.categoria === 'Sol');
    check('escrito a mano también entra: "clipon", "CLIP ON", "Hombre"', tipoDeSlug('clipon')?.categoria === 'Clip-On' && tipoDeSlug('CLIP ON')?.categoria === 'Clip-On' && generoDeSlug('Hombre')?.id === 'homme');
    check('una palabra que no es ni género ni tipo no se interpreta', generoDeSlug('cualquiera') === null && tipoDeSlug('cualquiera') === null);
    // Ningún link del catálogo puede terminar en error: lo reenvían y lo copian mal.
    const pagina = readFileSync(new URL('../../src/app/catalogo/[[...partes]]/page.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    check('un link mal copiado abre la tienda, no un 404', !pagina.includes('notFound') && pagina.includes("redirect(query.size ? `/tienda?${query}` : '/tienda')"));
    check('una parte que no se entiende se ignora y se abre el resto', pagina.includes('// Ni género ni tipo, o repetida: se ignora y se sigue.'));
    check('el bot y la web arman la MISMA dirección', rutaDeCatalogo('mujer', 'sol') === '/catalogo/mujer/sol' && linkDelCatalogo('MUJER', 'SOL', null).endsWith(rutaDeCatalogo('mujer', 'sol')));
    check('el chip del filtro ya no muestra "homme" crudo', etiquetaDeGenero('homme') === 'Homme');
}

console.log('\nDe dónde salen las fotos, y que no sean siempre las mismas');
{
    const tools = readFileSync(new URL('../../wa-service/tools.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    const ruta = readFileSync(new URL('../../src/app/api/bot/pricing/route.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    check('el que manda fotos pide el catálogo PUBLICADO', tools.includes("params.paraFotos = '1'"));
    check('para fotos, la ruta exige publicado en la tienda', ruta.includes('productWhere.publishToWeb = true'));
    check('para fotos NO se exige "recomendado" (no hay ninguno marcado)', ruta.includes("if (!paraFotos && (onlyBotRecommended || !search))"));
    check('cada cliente arranca en un punto distinto del catálogo', tools.includes('const semilla') && tools.includes('const corrimiento'));

    // La rotación, tal como la hace el bot: mismo cliente = mismos modelos;
    // clientes distintos = modelos distintos; y nunca rompe la prioridad.
    const MAX = 3;
    const catalogo = Array.from({ length: 20 }, (_, i) => ({ name: `M${String(i + 1).padStart(2, '0')}`, genero: i === 7 ? 'Masculino' : 'Unisex', publishToWeb: true }));
    const puntaje = p => ((p.genero || '').toLowerCase().includes('masculino') ? 3 : 2) * 10 + 1;
    const elegir = (id) => {
        const semilla = String(id).split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
        const ordenados = [...catalogo].sort((a, b) => puntaje(b) - puntaje(a));
        const corrimiento = ordenados.length > MAX ? semilla % ordenados.length : 0;
        return [...ordenados.slice(corrimiento), ...ordenados.slice(0, corrimiento)]
            .sort((a, b) => puntaje(b) - puntaje(a)).slice(0, MAX).map(p => p.name);
    };
    const juan = elegir('cli-juan'), sole = elegir('cli-sole');
    check('dos clientes distintos ven modelos distintos', juan.join() !== sole.join(), `${juan} vs ${sole}`);
    check('el mismo cliente ve siempre los mismos', elegir('cli-juan').join() === juan.join());
    check('el que de verdad le corresponde sigue saliendo primero', elegir('cli-juan')[0] === 'M08' && elegir('cli-sole')[0] === 'M08');
}

console.log('\nOrden de las fotos: primero lo que corresponde');
{
    // Reproduce el puntaje de sendProductPhotos sobre un catálogo de mentira.
    const puntajeDeGenero = (p, generoEfectivo) => {
        const g = (p.genero || '').toLowerCase();
        if (!g.trim()) return 0;
        if (!generoEfectivo) return g.includes('unisex') ? 1 : 0;
        const propio = generoEfectivo === 'HOMBRE' ? 'masculino' : 'femenino';
        if (g.includes(propio)) return 3;
        if (g.includes('unisex')) return 2;
        return 0;
    };
    const puntaje = (p, ge) => puntajeDeGenero(p, ge) * 10 + (p.botRecommended ? 2 : 0) + (p.publishToWeb ? 1 : 0);
    const catalogo = [
        { name: 'Adhara (sin dato)', genero: null, publishToWeb: true },
        { name: 'Bravo (Femenino)', genero: 'Femenino', publishToWeb: true },
        { name: 'Cosmos (Masculino)', genero: 'Masculino', publishToWeb: true },
        { name: 'Duna (Unisex)', genero: 'Unisex', publishToWeb: true },
    ];
    const ordenar = ge => [...catalogo].sort((a, b) => puntaje(b, ge) - puntaje(a, ge)).map(p => p.name);
    const paraHombre = ordenar('HOMBRE');
    const paraMujer = ordenar('MUJER');
    check('a un hombre le sale PRIMERO el masculino', paraHombre[0].includes('Masculino'), paraHombre.join(' > '));
    check('a un hombre el unisex va segundo, el sin dato después', paraHombre[1].includes('Unisex'), paraHombre.join(' > '));
    check('a una mujer le sale PRIMERO el femenino', paraMujer[0].includes('Femenino'), paraMujer.join(' > '));
    check('sin saber el género, el unisex va primero', ordenar(null)[0].includes('Unisex'), ordenar(null).join(' > '));
    check('el "sin dato" nunca le gana a uno que sí corresponde', !paraHombre[0].includes('sin dato') && !paraMujer[0].includes('sin dato'));
}

console.log(`\n${ok} ok, ${fallas.length} fallas`);
if (fallas.length) { console.log('FALLAS:', fallas.join(' · ')); process.exit(1); }
