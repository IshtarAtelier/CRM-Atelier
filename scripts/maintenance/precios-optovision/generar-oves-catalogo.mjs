#!/usr/bin/env node
// ────────────────────────────────────────────────────────────────────────────
// Genera src/lib/laboratorios/oves-catalogo.ts a partir de oves-catalogo.tsv:
// los productos que ofrece el autocompletar de OVES (portal de Optovisión)
// por clase de pedido (RXTD tallado digital / RXTT tradicional / RXSA stock
// con adicionales), tal como los devolvió `include/suggest.php?opc=producto`
// el 19/10/2026 (ver docs/oves-portal.md). Sin base ni red.
//
//   node scripts/maintenance/precios-optovision/generar-oves-catalogo.mjs
//
// El TSV es la fuente (clase, cod, linea, marca, material, diseno, promoCode,
// promoDest, label); el .ts NO se edita a mano. Para refrescarlo: volver a
// relevar el portal y reemplazar el TSV entero.
// ────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, '../../..');
const tsv = path.join(aqui, 'oves-catalogo.tsv');
const salida = path.join(raiz, 'src/lib/laboratorios/oves-catalogo.ts');

const lineas = fs.readFileSync(tsv, 'utf8').replace(/\r/g, '').split('\n').filter(Boolean);
const cabecera = lineas.shift().split('\t');
const esperada = ['clase', 'cod', 'linea', 'marca', 'material', 'diseno', 'promoCode', 'promoDest', 'label'];
if (cabecera.join() !== esperada.join()) throw new Error(`Cabecera inesperada: ${cabecera.join(',')}`);

const filas = lineas.map((l, i) => {
    const c = l.split('\t');
    if (c.length !== 9) throw new Error(`Línea ${i + 2}: ${c.length} columnas (van 9)`);
    const [clase, cod, linea, marca, material, diseno, promoCode, promoDest, label] = c;
    if (!['RXTD', 'RXTT', 'RXSA'].includes(clase)) throw new Error(`Línea ${i + 2}: clase ${clase}`);
    if (!['S', 'N'].includes(promoDest)) throw new Error(`Línea ${i + 2}: promoDest ${promoDest}`);
    return { clase, cod, linea, marca, material, diseno, promoCode, promoDest, label };
});

const vistas = new Set();
for (const f of filas) {
    const k = `${f.clase}|${f.cod}|${f.linea}|${f.marca}|${f.material}|${f.diseno}`;
    if (vistas.has(k)) throw new Error(`Repetido: ${k}`);
    vistas.add(k);
}

const esc = s => JSON.stringify(s);
const porClase = {};
for (const f of filas) porClase[f.clase] = (porClase[f.clase] || 0) + 1;

const cuerpo = filas.map(f => `    [${esc(f.clase)}, ${esc(f.cod)}, ${esc(f.linea)}, ${esc(f.marca)}, ${esc(f.material)}, ${esc(f.diseno)}, ${esc(f.promoCode)}, ${esc(f.promoDest)}, ${esc(f.label)}],`).join('\n');

const ts = `/**
 * EL CATÁLOGO DE OVES (portal de pedidos de Optovisión), GENERADO.
 *
 * No se edita a mano: sale de scripts/maintenance/precios-optovision/oves-catalogo.tsv
 * con \`node scripts/maintenance/precios-optovision/generar-oves-catalogo.mjs\`.
 * Relevado el 19/10/2026 contra \`include/suggest.php?opc=producto\` (las cinco
 * vocales como término, por clase de pedido): ${filas.length} productos
 * (${Object.entries(porClase).map(([k, v]) => `${k} ${v}`).join(', ')}). Ver docs/oves-portal.md.
 *
 * Cada fila es [clase, cod, linea, marca, material, diseno, promoCode, promoDest, label].
 * El VALUE que el portal guarda en \`hiddenLineaRX\` se arma con \`valueDeOves\`:
 * \`|cod|linea|marca|material|diseno|linea|\` (la línea va dos veces, así lo
 * manda el portal). \`promoDest=S\` marca los que pueden ser 2º par de la promo
 * XPERIO del portal (que NO usamos; ver lab-modules/optovision/promo.ts).
 */
export type ClaseDePedidoOves = 'RXTD' | 'RXTT' | 'RXSA';

export type FilaOves = readonly [clase: ClaseDePedidoOves, cod: string, linea: string, marca: string, material: string, diseno: string, promoCode: string, promoDest: 'S' | 'N', label: string];

export const OVES_CATALOGO: readonly FilaOves[] = [
${cuerpo}
];

export interface ProductoOves {
    clase: ClaseDePedidoOves;
    cod: string;
    linea: string;
    marca: string;
    material: string;
    diseno: string;
    promoCode: string;
    promoDest: 'S' | 'N';
    label: string;
    /** Lo que el portal pone en \`hiddenLineaRX\` al elegir el producto. */
    value: string;
}

export const valueDeOves = (f: { cod: string; linea: string; marca: string; material: string; diseno: string }): string =>
    \`|\${f.cod}|\${f.linea}|\${f.marca}|\${f.material}|\${f.diseno}|\${f.linea}|\`;

export const PRODUCTOS_OVES: readonly ProductoOves[] = OVES_CATALOGO.map(([clase, cod, linea, marca, material, diseno, promoCode, promoDest, label]) => ({
    clase, cod, linea, marca, material, diseno, promoCode, promoDest, label, value: valueDeOves({ cod, linea, marca, material, diseno }),
}));
`;

fs.writeFileSync(salida, ts);
console.log(`Escrito ${path.relative(raiz, salida)}: ${filas.length} productos (${Object.entries(porClase).map(([k, v]) => `${k} ${v}`).join(', ')}).`);
