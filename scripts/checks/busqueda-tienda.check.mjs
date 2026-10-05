#!/usr/bin/env node
/**
 * La búsqueda de la tienda (/tienda y la lupa del encabezado), fijada.
 *
 * POR QUÉ EXISTE
 * Re-chequeo del 28/9/2026 sobre la auditoría del 25/9: "clip on" daba 0 y
 * "clip-on" 10, "negro" daba 2 con ~29 anteojos negros, "mujer" daba 0, y la
 * lupa del encabezado era otro motor que distinguía tildes ("orion" 0,
 * "Orión" 1). Para quien busca, un 0 se lee "no tienen", no "escribiste
 * distinto". Cada caso de abajo es algo que alguien buscó o buscaría.
 *
 * Corre sin base y sin red.
 * Uso: npm run check:busqueda-tienda
 */

import { readFileSync } from 'node:fs';
import { coincideBusquedaTienda, palabrasDeBusqueda } from '../../src/lib/catalog/busqueda-tienda.ts';
import { precioParaRango, leerRangoPrecio, dentroDelRango, descuentoTransferenciaDe } from '../../src/lib/catalog/rango-precio.ts';

const casos = [];
const esperar = (nombre, cond, detalle) => casos.push({ nombre, ok: !!cond, detalle });

const clipOn = { model: 'Capri', modelCode: 'C5', brand: 'Cápsula Escarlata', category: 'Clip-On', coloresFamilia: ['negro'], shape: 'Cuadrado', material: 'Metal', gender: 'Unisex' };
const solNegro = { model: 'Zeus', modelCode: 'C33-P86', brand: 'Cápsula Escarlata', category: 'Sol', coloresFamilia: ['negro'], shape: 'Aviador', material: 'Titanio', gender: 'Masculino', polarizado: true };
const recetaCarey = { model: 'Orión C1', modelCode: 'C1', brand: 'Cápsula Escarlata', category: 'Receta', coloresFamilia: ['carey'], shape: 'Redondo', material: 'Acetato', gender: 'Femenino' };
const recetaNegraSinColorEnNombre = { model: 'Frida', modelCode: 'C7', brand: 'Cápsula Escarlata', category: 'Receta', coloresFamilia: ['negro'], shape: 'Cat-Eye', material: 'Acetato', gender: 'Femenino' };

const busca = (consulta, p) => coincideBusquedaTienda(p, consulta);

// Guiones, espacios y sinónimos de clip-on
for (const q of ['clip on', 'clip-on', 'Clip On', 'clipon', 'clipones', 'CLIP']) {
    esperar(`"${q}" encuentra el clip-on`, busca(q, clipOn));
}
// Color: por familia, no solo por nombre; y en plural
esperar('"negro" encuentra un negro sin "negro" en el nombre', busca('negro', recetaNegraSinColorEnNombre));
esperar('"negros" encuentra "negro"', busca('negros', solNegro));
esperar('"negro" no trae un carey', !busca('negro', recetaCarey));
// Tildes, en los dos sentidos
esperar('"orion" encuentra "Orión C1"', busca('orion', recetaCarey));
esperar('"ORIÓN" encuentra "Orión C1"', busca('ORIÓN', recetaCarey));
// Género, con unisex para los dos
esperar('"mujer" encuentra femenino', busca('mujer', recetaCarey));
esperar('"mujer" encuentra unisex', busca('mujer', clipOn));
esperar('"mujer" no trae masculino', !busca('mujer', solNegro));
esperar('"hombre" encuentra masculino', busca('hombre', solNegro));
// Categoría, forma, material, polarizado
esperar('"anteojos de sol" encuentra sol', busca('anteojos de sol', solNegro));
esperar('"anteojos de sol" no trae receta', !busca('anteojos de sol', recetaCarey));
esperar('"redondos" encuentra forma Redondo', busca('redondos', recetaCarey));
esperar('"aviador" encuentra forma Aviador', busca('aviador', solNegro));
esperar('"titanio" encuentra material Titanio', busca('titanio', solNegro));
esperar('"polarizados" encuentra polarizado', busca('polarizados', solNegro));
esperar('"recetados" encuentra receta', busca('recetados', recetaCarey));
// Todas las palabras cuentan (Y, no O)
esperar('"sol negro" encuentra sol negro', busca('sol negro', solNegro));
esperar('"sol negro" no trae receta negra', !busca('sol negro', recetaNegraSinColorEnNombre));
esperar('"frida c7" encuentra Frida C7', busca('frida c7', recetaNegraSinColorEnNombre));
// Lo que no hay, no aparece
esperar('"ray ban" no inventa resultados', !busca('ray ban', solNegro) && !busca('ray ban', recetaCarey));
// Consulta vacía o sin palabras que distingan: no filtra
esperar('consulta vacía no filtra', busca('', recetaCarey) && busca(null, recetaCarey));
esperar('"anteojos" solo no filtra', busca('anteojos', recetaCarey) && busca('anteojos', solNegro));
esperar('palabrasDeBusqueda("Lentes de Sol negros") = sol + negros',
    JSON.stringify(palabrasDeBusqueda('Lentes de Sol negros')) === JSON.stringify(['sol', 'negros']),
    JSON.stringify(palabrasDeBusqueda('Lentes de Sol negros')));

// ── Revisión del 5/10: por palabra, no por pedazo de texto ──
const pegaso = { model: 'Pegaso C3', modelCode: 'C3', brand: 'Atelier', category: 'Receta', coloresFamilia: ['negro'], shape: 'Rectangular', material: 'Acetato', gender: 'Masculino' };
const otroCodigo = { model: 'Lyra', modelCode: 'BC3063', brand: 'Atelier', category: 'Receta', coloresFamilia: ['negro'], shape: 'Rectangular', material: 'Acetato', gender: 'Masculino' };
const sirio = { model: 'Sirio', modelCode: 'C2', brand: 'Atelier', category: 'Receta', coloresFamilia: ['dorado'], shape: 'Redondo', material: 'Metal', gender: 'Unisex' };
const venusC2 = { model: 'Venus C2', modelCode: 'C2', brand: 'Atelier', category: 'Receta', coloresFamilia: ['negro'], shape: 'Cuadrado', material: 'Acetato', gender: 'Femenino' };
const venusC21 = { model: 'Venus C2-1', modelCode: 'C2-1', brand: 'Atelier', category: 'Receta', coloresFamilia: ['negro'], shape: 'Cuadrado', material: 'Acetato', gender: 'Femenino' };
const calipso = { model: 'Calipso', modelCode: '9004M', brand: 'Cápsula Escarlata', category: 'Receta', coloresFamilia: ['negro'], shape: 'Ovalado', material: 'Acetato', gender: 'Femenino' };
esperar('"polaris" no trae polarizados', !busca('polaris', solNegro));
esperar('"polari" (a medio tipear) sí trae polarizados', busca('polari', solNegro));
esperar('"iris" no trae Sirio', !busca('iris', sirio));
esperar('"pegaso c3" trae Pegaso C3', busca('pegaso c3', pegaso));
esperar('"c3" no trae el código BC3063', !busca('c3', otroCodigo) && !busca('pegaso c3', otroCodigo));
esperar('"venus c2-1" trae Venus C2-1 y no Venus C2', busca('venus c2-1', venusC21) && !busca('venus c2-1', venusC2));
esperar('"venus c2" trae Venus C2', busca('venus c2', venusC2));
esperar('"9004" encuentra el código 9004M', busca('9004', calipso));
esperar('"calip" (a medio tipear) encuentra Calipso', busca('calip', calipso));
// Femeninos y plurales, en palabra entera
esperar('"negra" y "negras" encuentran negro', busca('negra', recetaNegraSinColorEnNombre) && busca('negras', solNegro));
esperar('"redonda" encuentra forma Redondo', busca('redonda', recetaCarey));
esperar('"cuadrada" encuentra forma Cuadrado', busca('cuadrada', clipOn));
esperar('"dorada" encuentra dorado', busca('dorada', sirio));
esperar('"venus" encuentra Venus', busca('venus', venusC2));
// Género: en castellano y a medio tipear
esperar('"homb" encuentra masculino', busca('homb', solNegro));
esperar('"mujeres" encuentra femenino', busca('mujeres', recetaCarey));
esperar('"ho" (dos letras) no trae todo lo de hombre', !busca('ho', solNegro) && !busca('ho', pegaso));
esperar('"ne" (dos letras) no trae todo lo negro', !busca('ne', recetaNegraSinColorEnNombre));
// Palabras que no distinguen y frases
esperar('"gafas" no filtra; "gafas de sol" es sol', busca('gafas', recetaCarey) && busca('gafas de sol', solNegro) && !busca('gafas de sol', recetaCarey));
esperar('"clip on de sol" encuentra el clip-on', busca('clip on de sol', clipOn));
esperar('"sin aumento" no se lee como "con receta"', busca('sin aumento', solNegro));
esperar('"con aumento" es receta', busca('con aumento', recetaCarey) && !busca('con aumento', solNegro));

// ── Filtro de precio: mismo número que la tarjeta, en las cuatro páginas ──
{
    const lista = { price: 175000, salePrice: null, wholesalePrice: 60000 };
    const oferta = { price: 215000, salePrice: 160000, wholesalePrice: 0 };
    esperar('el rango compara contra el precio por transferencia (175.000 − 15% = 148.750)', precioParaRango(lista, 15) === 148750, String(precioParaRango(lista, 15)));
    esperar('con oferta, contra la oferta por transferencia (160.000 − 15% = 136.000)', precioParaRango(oferta, 15) === 136000, String(precioParaRango(oferta, 15)));
    esperar('a un mayorista, contra su precio mayorista', precioParaRango(lista, 15, true) === 60000 && precioParaRango(oferta, 15, true) === 160000);
    const hasta140 = leerRangoPrecio('', '140000');
    esperar('"Hasta $140.000": entra 136.000, no entra 148.750', dentroDelRango(136000, hasta140) && !dentroDelRango(148750, hasta140));
    esperar('sin rango no filtra', !leerRangoPrecio('', '').activo && !leerRangoPrecio(null, undefined).activo);
    esperar('un % vacío o en 0 cae al 15, como la tarjeta', descuentoTransferenciaDe(0) === 15 && descuentoTransferenciaDe('') === 15 && descuentoTransferenciaDe(undefined) === 15 && descuentoTransferenciaDe(20) === 20);
    // /receta, /lentes-de-sol y /clip-on mostraban los botones y no filtraban.
    for (const archivo of ['src/components/Storefront/ListadoCatalogoFiltrado.tsx', 'src/components/Storefront/ListadoCategoria.tsx', 'src/app/api/store/products/route.ts']) {
        const fuente = readFileSync(new URL(`../../${archivo}`, import.meta.url), 'utf8');
        esperar(`${archivo.split('/').pop()} filtra el precio con rango-precio.ts`, /dentroDelRango\(precioParaRango\(/.test(fuente));
    }
    const clipOn = readFileSync(new URL('../../src/app/clip-on/page.tsx', import.meta.url), 'utf8');
    esperar('/clip-on le pasa el rango de la URL al listado', /precioMin: texto\('precioMin'\)/.test(clipOn) && /precioMax: texto\('precioMax'\)/.test(clipOn));
}

const fallas = casos.filter((c) => !c.ok);
for (const c of casos) console.log(`${c.ok ? '✅' : '❌'} ${c.nombre}${c.ok || !c.detalle ? '' : `\n     ${c.detalle}`}`);
console.log(`\n${casos.length - fallas.length}/${casos.length} casos OK`);
if (fallas.length) process.exit(1);
