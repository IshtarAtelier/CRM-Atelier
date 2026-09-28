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

import { coincideBusquedaTienda, palabrasDeBusqueda } from '../../src/lib/catalog/busqueda-tienda.ts';

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

const fallas = casos.filter((c) => !c.ok);
for (const c of casos) console.log(`${c.ok ? '✅' : '❌'} ${c.nombre}${c.ok || !c.detalle ? '' : `\n     ${c.detalle}`}`);
console.log(`\n${casos.length - fallas.length}/${casos.length} casos OK`);
if (fallas.length) process.exit(1);
