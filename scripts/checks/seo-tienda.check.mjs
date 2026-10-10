#!/usr/bin/env node
/**
 * Datos para buscadores y vistas previas de la tienda, fijados.
 *
 * POR QUÉ EXISTE (auditoría del 25/9/2026, confirmado el 3/10 en producción)
 *   · /receta, /lentes-de-sol, /clip-on y /multifocales se compartían por
 *     WhatsApp SIN foto: definen su propio `openGraph` y Next no hereda la
 *     imagen del layout. Este check falla si una página pública vuelve a
 *     definir `openGraph` sin `images`.
 *   · El JSON-LD de la ficha decía `suggestedGender: "femenino"` o
 *     "femenino, masculino, unisex"; Google espera female / male / unisex.
 *     Los casos de abajo son los 13 valores que había en la base el 3/10.
 *   · Una imagen con ruta relativa en el ItemList de la home: Google pide URL
 *     completa.
 *
 * Corre sin base y sin red.
 * Uso: npm run check:seo-tienda
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generoSchemaOrg } from '../../src/lib/catalog/genero-schema.ts';
import { urlAbsoluta } from '../../src/lib/url-absoluta.ts';
import { SLUGS_HISTORICOS, slugVigenteDe } from '../../src/lib/catalog/slugs-historicos.ts';
import { enlaceDeFichaVigente, nombreDelModelo } from '../../src/lib/catalog/enlace-a-ficha.ts';

const raiz = fileURLToPath(new URL('../..', import.meta.url));
const casos = [];
const esperar = (nombre, cond, detalle) => casos.push({ nombre, ok: !!cond, detalle });

// Género: los 13 valores reales de la base (3/10/2026).
const generos = {
    'Unisex': 'unisex', 'Femenino': 'female', 'Masculino': 'male', 'FEMENINO': 'female',
    'Unisex, Femenino, Masculino': 'unisex', 'Masculino, Femenino, Unisex': 'unisex',
    'Femenino, Masculino, Unisex': 'unisex', 'Unisex, Masculino, Femenino': 'unisex',
    'FEMENINO, Masculino, Unisex': 'unisex', 'Masculino, Unisex, Femenino': 'unisex',
    'FEMENINO, Unisex': 'unisex', '': null, null: null,
};
for (const [valor, esperado] of Object.entries(generos)) {
    const v = valor === 'null' ? null : valor;
    esperar(`género ${JSON.stringify(v)} → ${esperado}`, generoSchemaOrg(v) === esperado, String(generoSchemaOrg(v)));
}

// URL completa
esperar('ruta relativa → URL completa', urlAbsoluta('/images/products/x.webp') === 'https://atelieroptica.com.ar/images/products/x.webp');
esperar('URL completa queda igual', urlAbsoluta('https://cdn.ejemplo.com/a.jpg') === 'https://cdn.ejemplo.com/a.jpg');
esperar('sin ruta → undefined', urlAbsoluta('') === undefined && urlAbsoluta(null) === undefined);
esperar('una foto embebida (data:) no se convierte en URL', urlAbsoluta('data:image/webp;base64,AAAA') === undefined);
esperar('//cdn… → https://cdn…', urlAbsoluta('//cdn.ejemplo.com/a.jpg') === 'https://cdn.ejemplo.com/a.jpg');

// Toda página pública que define openGraph trae imagen.
function paginas(dir) {
    const out = [];
    for (const nombre of readdirSync(dir)) {
        const p = join(dir, nombre);
        if (statSync(p).isDirectory()) {
            if (nombre === 'admin' || nombre === 'api') continue;
            out.push(...paginas(p));
        } else if (nombre === 'page.tsx' || nombre === 'layout.tsx') out.push(p);
    }
    return out;
}
const sinImagen = [];
for (const archivo of paginas(join(raiz, 'src/app'))) {
    const s = readFileSync(archivo, 'utf8');
    const re = /openGraph\s*:\s*\{/g;
    let m;
    while ((m = re.exec(s))) {
        let i = m.index + m[0].length, prof = 1;
        while (prof && i < s.length) { if (s[i] === '{') prof++; else if (s[i] === '}') prof--; i++; }
        if (!s.slice(m.index, i).includes('images')) sinImagen.push(relative(raiz, archivo));
    }
}
esperar('ninguna página pública define openGraph sin imagen', sinImagen.length === 0, sinImagen.join(', '));

// ── Fichas renombradas: la dirección vieja redirige (10/10/2026) ──
{
    const viejos = Object.keys(SLUGS_HISTORICOS);
    const destinos = new Set(Object.values(SLUGS_HISTORICOS));
    const cadenas = viejos.filter((v) => destinos.has(v));
    esperar('ningún destino del mapa es a su vez una dirección vieja (sin cadenas de redirects)', cadenas.length === 0, cadenas.join(', '));
    esperar('ningún slug viejo redirige a sí mismo', viejos.every((v) => SLUGS_HISTORICOS[v] !== v));
    esperar('slugVigenteDe: dirección vieja → vigente, desconocida → null',
        slugVigenteDe('atelier-tg2807-c1-116i') === 'helios-c1' && slugVigenteDe('no-existe') === null && slugVigenteDe('constructor') === null);
    const ficha = readFileSync(new URL('../../src/app/producto/[slug]/page.tsx', import.meta.url), 'utf8');
    const pagina = ficha.slice(ficha.indexOf('export default async function ProductPage'));
    esperar('la ficha busca el producto ANTES de mirar el mapa (un slug vigente nunca se redirige)',
        pagina.indexOf('getProduct(') > -1 && pagina.indexOf('slugVigenteDe(') > pagina.indexOf('getProduct('));
}

// ── Notas de la base con links a fichas dadas de baja (10/10/2026) ──
{
    const vivas = new Set(['hera-c4', 'pandora-c3', 'osiris-c4', 'armazon-receta-atelier-athena-91501-c6', 'helios-c1']);
    esperar('link a una ficha publicada: queda igual', enlaceDeFichaVigente('/producto/hera-c4', vivas) === '/producto/hera-c4');
    esperar('link absoluto a una publicada: queda igual', enlaceDeFichaVigente('https://atelieroptica.com.ar/producto/hera-c4', vivas) === 'https://atelieroptica.com.ar/producto/hera-c4');
    esperar('renombrada → la vigente', enlaceDeFichaVigente('/producto/atelier-athena-906p', vivas) === '/producto/armazon-receta-atelier-athena-91501-c6');
    esperar('dada de baja, el modelo sigue en otro color → búsqueda', enlaceDeFichaVigente('/producto/atelier-hera-dwcn', vivas) === '/tienda?q=hera');
    esperar('dada de baja sin equivalente → /tienda', enlaceDeFichaVigente('/producto/aurora-c1', vivas) === '/tienda');
    esperar('"iris" no se confunde con "osiris"', enlaceDeFichaVigente('/producto/atelier-iris-8u55', vivas) === '/tienda');
    esperar('sin dato de fichas (base caída) no se toca', enlaceDeFichaVigente('/producto/aurora-c1', null) === '/producto/aurora-c1');
    esperar('otros links no se tocan', enlaceDeFichaVigente('/blog/stellest', vivas) === '/blog/stellest' && enlaceDeFichaVigente('https://otro.com/producto/x', vivas) === 'https://otro.com/producto/x');
    esperar('nombreDelModelo saca prefijos, color y códigos', nombreDelModelo('armazon-receta-escarlata-pandora-c5-hk011') === 'pandora' && nombreDelModelo('atelier-diana-k0k7') === 'diana');
    const blog = readFileSync(new URL('../../src/app/blog/[slug]/page.tsx', import.meta.url), 'utf8');
    esperar('las notas de la base pasan sus links por enlaceDeFichaVigente', /a:\s*\(tagName[^)]*\)\s*=>[\s\S]{0,200}enlaceDeFichaVigente/.test(blog));
}

const fallas = casos.filter((c) => !c.ok);
for (const c of casos) console.log(`${c.ok ? '✅' : '❌'} ${c.nombre}${c.ok || !c.detalle ? '' : `\n     ${c.detalle}`}`);
console.log(`\n${casos.length - fallas.length}/${casos.length} casos OK`);
if (fallas.length) process.exit(1);
