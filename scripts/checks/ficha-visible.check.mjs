#!/usr/bin/env node
/**
 * El nombre y el precio de la ficha de producto TIENEN que salir visibles del
 * servidor. Este check falla el build si alguien vuelve a ponerles una
 * animación de entrada.
 *
 * QUÉ PASÓ (hallazgo A-01, auditoría del 2/9/2026)
 * El bloque de compra de `/producto/[slug]` usaba `motion.*` de framer-motion
 * con `initial={{ y: 20, opacity: 0 }}`. En el render del servidor eso se
 * serializa como `style="opacity:0"` en el HTML, y la animación que lo lleva a
 * 1 solo corre cuando el componente cliente hidrata. Cuando la hidratación
 * falla —y fallaba, por un `toLocaleString()` sin idioma, ver A-14 y
 * `src/lib/format-precio.ts`— esos nodos se quedan en `opacity: 0` PARA
 * SIEMPRE: el nombre, el precio, el SKU y la descripción quedan en el HTML
 * (Google los indexa) pero la persona no los ve. Scrollear no los revela.
 *
 * Estuvo así en producción, en la única página donde se decide la compra.
 *
 * LA REGLA QUE ESTE CHECK DEFIENDE
 * El estado final es el default; la animación es la excepción. Nombre, marca,
 * SKU, precio y CTA se renderizan visibles, sin `initial`. Si algo tiene que
 * animarse, que sea algo que no sea la venta.
 *
 * POR QUÉ ES ESTÁTICO Y NO UN TEST DE NAVEGADOR
 * Corre sin base y sin red, así que puede ir en CI y en el pre-deploy sin
 * levantar nada. Un test de navegador sobre la opacidad computada sería más
 * fiel, pero también más frágil y mucho más lento — y lo que hay que impedir
 * es que el `initial` vuelva al archivo, que es exactamente lo que se ve acá.
 *
 * Uso: node scripts/checks/ficha-visible.check.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '../..');

const FICHA = 'src/app/producto/[slug]/ProductClient.tsx';
const src = readFileSync(resolve(raiz, FICHA), 'utf8');

const problemas = [];

// ── 1. El bloque de compra no puede tener animación de entrada ──────────────
//
// Se busca `initial={{ ... opacity: 0 ... }}` en elementos `motion.*` que NO
// estén dentro de un AnimatePresence (los acordeones y el lightbox sí pueden
// animar: son cosas que aparecen por una acción de la persona, no el contenido
// que tiene que estar desde el primer pintado).
//
// El criterio práctico: `initial` con `opacity: 0` sobre motion.h1 / motion.p /
// motion.div de primer nivel del panel de compra. Se detecta por la etiqueta y
// se exceptúan las que abren dentro de un AnimatePresence.
const lineas = src.split('\n');
let dentroDeAnimatePresence = 0;

for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];

    if (/<AnimatePresence/.test(linea)) dentroDeAnimatePresence++;
    if (/<\/AnimatePresence>/.test(linea)) dentroDeAnimatePresence = Math.max(0, dentroDeAnimatePresence - 1);
    if (dentroDeAnimatePresence > 0) continue;

    // `initial` con opacidad 0 (en cualquiera de sus formas de escritura).
    if (/initial=\{\{[^}]*opacity:\s*0/.test(linea)) {
        // DOS excepciones declaradas, las dos por el mismo motivo: son cosas
        // que solo existen DESPUÉS de que la persona hizo clic, así que para
        // cuando se montan la hidratación ya ocurrió. No pueden quedar
        // congeladas en opacity:0 como el bloque de compra.
        //
        //   1. La galería de fotos (la secundaria entra con un fundido).
        //   2. Lo que está adentro de un `{showAlgo && (` — modales como el
        //      configurador de cristales.
        //
        // La ventana hacia atrás es de 30 líneas, no de 10. Con 10 este check
        // dio un falso positivo el 2/9/26: agregarle accesibilidad al modal
        // (role, aria-modal, aria-label, ref) empujó el `{showConfigurator && (`
        // fuera de la ventana y el check marcó como bug algo que estaba bien.
        // Un check que se rompe cuando el código mejora entrena a ignorarlo.
        const contexto = lineas.slice(Math.max(0, i - 30), i).join('\n');
        const esGaleria = /activeImageIndex|AnimatePresence|lightbox|Lightbox/.test(contexto);
        const esModalPorClic = /\{\s*(show|is|open|mostrar|abierto)[A-Za-z]*\s*&&\s*\(/.test(contexto);
        // Y por si el bloque condicional queda aún más lejos: un elemento con
        // role="dialog" arriba es, por definición, algo que se abre a pedido.
        const esDialogo = /role="dialog"/.test(contexto);
        if (esGaleria || esModalPorClic || esDialogo) continue;

        problemas.push({
            linea: i + 1,
            texto: linea.trim().slice(0, 100),
        });
    }
}

// ── 2. El h1 con el modelo tiene que ser un h1 plano ────────────────────────
if (/<motion\.h1/.test(src)) {
    problemas.push({
        linea: lineas.findIndex(l => /<motion\.h1/.test(l)) + 1,
        texto: 'El <h1> del producto es un motion.h1 — tiene que ser un <h1> plano.',
    });
}

// ── 3. Nada de formato de precio sin idioma en la tienda pública ────────────
// El `toLocaleString()` a secas es lo que rompió la hidratación (A-14).
const PUBLICOS = [
    'src/app/producto/[slug]/ProductClient.tsx',
    'src/components/Storefront/LensConfigurator.tsx',
    'src/components/Storefront/CustomGlassesBuilder.tsx',
];
for (const archivo of PUBLICOS) {
    const contenido = readFileSync(resolve(raiz, archivo), 'utf8');
    contenido.split('\n').forEach((l, i) => {
        if (/toLocaleString\(\s*\)/.test(l)) {
            problemas.push({
                linea: `${archivo}:${i + 1}`,
                texto: `toLocaleString() sin idioma — usar formatearPrecio() de src/lib/format-precio.ts. ${l.trim().slice(0, 70)}`,
            });
        }
    });
}

if (problemas.length) {
    console.error(`\n❌ La ficha de producto puede quedar invisible (${problemas.length} problema(s)):\n`);
    for (const p of problemas) {
        console.error(`   ${typeof p.linea === 'number' ? `${FICHA}:${p.linea}` : p.linea}`);
        console.error(`      ${p.texto}\n`);
    }
    console.error('   Regla: el estado final es el default; la animación es la excepción.');
    console.error('   El nombre y el precio salen visibles del servidor. Ver A-01 en el encabezado de este check.\n');
    process.exit(1);
}

console.log('✅ La ficha de producto renderiza nombre y precio visibles (sin animación de entrada) y sin formato de precio sin idioma.');
