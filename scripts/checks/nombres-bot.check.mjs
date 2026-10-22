/**
 * Con qué nombre saluda el bot ("Hola Luciano, cómo estás?"), o con ninguno.
 * Sin base ni red (también en CI).
 *
 *   npm run check:nombres-bot
 *
 * Saludar mal es peor que saludar sin nombre: "Hola Doctor", "Hola Mami",
 * "Hola Peluquería", "Hola Maximilianoluna6699". Y el nombre del paciente de la
 * receta no es el de quien escribe (la madre escribe por el hijo).
 *
 * Además fija que el espejo CommonJS de los nombres de pila
 * (wa-service/shared/nombres-de-pila.js) diga lo mismo que src/lib/nombre-genero.ts.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { primerNombreValido, nombreParaSaludar } = require('../../wa-service/shared/nombre-para-saludar.js');
const espejo = require('../../wa-service/shared/nombres-de-pila.js');
const fuente = await import('../../src/lib/nombre-genero.ts');

let fallas = 0;
const ok = (m) => console.log(`  ✅ ${m}`);
const mal = (m) => { fallas++; console.log(`  ❌ ${m}`); };
const check = (m, cond) => (cond ? ok(m) : mal(m));

console.log('\nNombres que sirven para saludar');
const SI = [
    ['Luciano', 'Luciano'],
    ['🌸Lucía🌸', 'Lucía'],
    ['Ana-Laura Pérez', 'Ana-Laura'],
    ['João Silva', 'João'],
    ['juan carlos', 'Juan'],
    ['MARIA GONZALEZ', 'Maria'],
    ['Mile', 'Mile'],
];
for (const [raw, esperado] of SI) {
    const r = primerNombreValido(raw);
    check(`"${raw}" → "${esperado}"${r !== esperado ? ` (dio "${r}")` : ''}`, r === esperado);
}

console.log('\nLo que NO es un nombre (saluda sin nombre)');
const NO = [
    'maximilianoluna6699', 'maximilianoluna', 'Doctor Juan', 'Dra. Fernández', 'Arq. Pedro', 'Profe Ana',
    'Seño Caro', 'Mami', 'Papi', 'Abu', 'Tía Marta', 'Peluquería Estilo', 'Dios es amor', 'Bendecida',
    'Ventas Rapilent', 'Óptica Centro', '🫵🏻💪', 'Ma', 'OPTIRED', '+54 9 351 555-1234',
];
for (const raw of NO) {
    const r = primerNombreValido(raw);
    check(`"${raw}" → sin nombre${r ? ` (dio "${r}")` : ''}`, r === '');
}

console.log('\nEl saludo usa a quien escribe, no al paciente de la receta');
check('perfil válido manda sobre la ficha', nombreParaSaludar({ perfil: 'Laura', ficha: { name: 'Tomás Pérez', prescriptions: [] } }) === 'Laura');
check('perfil inútil y ficha sin recetas → la ficha', nombreParaSaludar({ perfil: '🌸', ficha: { name: 'Laura Gómez', prescriptions: [] } }) === 'Laura');
check('perfil inútil y ficha CON recetas → sin nombre (puede ser el paciente)', nombreParaSaludar({ perfil: '🌸', ficha: { name: 'Tomás Pérez', prescriptions: [{ id: 1 }] } }) === '');
check('sin nada → sin nombre', nombreParaSaludar({}) === '');

const graph = readFileSync(new URL('../../wa-service/graph.js', import.meta.url), 'utf8');
check('graph.js saluda con nombreParaSaludar (perfil + ficha), no con el nombre de la ficha a secas',
    /nombreParaSaludar\(\{ perfil: state\.userName, ficha: state\.clientData \}\)/.test(graph) && !/sanitizeFirstName/.test(graph));

console.log('\nEspejo de nombres de pila (wa-service ↔ src)');
const igual = (a, b) => a.size === b.size && [...a].every(x => b.has(x));
check(`VARON: ${espejo.VARON.size} nombres, iguales a src/lib/nombre-genero.ts`, igual(espejo.VARON, fuente.VARON));
check(`MUJER: ${espejo.MUJER.size} nombres, iguales a src/lib/nombre-genero.ts`, igual(espejo.MUJER, fuente.MUJER));

console.log('');
if (fallas) { console.log(`❌ ${fallas} falla(s).`); process.exit(1); }
console.log('✅ Nombres para saludar en orden.');
