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

const fallas = casos.filter((c) => !c.ok);
for (const c of casos) console.log(`${c.ok ? '✅' : '❌'} ${c.nombre}${c.ok || !c.detalle ? '' : `\n     ${c.detalle}`}`);
console.log(`\n${casos.length - fallas.length}/${casos.length} casos OK`);
if (fallas.length) process.exit(1);
