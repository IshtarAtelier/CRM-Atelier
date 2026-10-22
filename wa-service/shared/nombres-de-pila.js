'use strict';

/**
 * Nombres de pila conocidos (varón y mujer), espejo CommonJS de las listas de
 * `src/lib/nombre-genero.ts`.
 *
 * Por qué hay dos copias: el wa-service se despliega como imagen propia y su
 * Dockerfile solo copia `prisma/` y `wa-service/` — no puede importar nada de
 * `src/`. Las mantiene iguales `npm run check:nombres-bot` (sin base ni red,
 * también en CI): un nombre que se agrega allá y no acá, falla.
 *
 * Acá se usan como LISTA POSITIVA para saludar (shared/nombre-para-saludar.js):
 * un nombre de esta lista se acepta aunque las reglas de forma duden.
 * NO editar a mano sin tocar también la fuente TypeScript.
 */

const VARON = new Set([
    'juan', 'jose', 'carlos', 'luis', 'jorge', 'miguel', 'roberto', 'ricardo', 'daniel', 'pedro',
    'pablo', 'diego', 'fernando', 'gustavo', 'sergio', 'javier', 'marcelo', 'alejandro', 'raul', 'hector',
    'oscar', 'ruben', 'walter', 'claudio', 'omar', 'julio', 'mario', 'angel', 'rodolfo', 'alberto',
    'gabriel', 'martin', 'facundo', 'agustin', 'santiago', 'nicolas', 'matias', 'lucas', 'tomas', 'joaquin',
    'ignacio', 'emiliano', 'maximiliano', 'maxi', 'leandro', 'gonzalo', 'federico', 'sebastian', 'cristian', 'christian',
    'german', 'ariel', 'adrian', 'damian', 'fabian', 'marcos', 'mauricio', 'leonardo', 'lisandro', 'franco',
    'bruno', 'elias', 'ezequiel', 'ismael', 'israel', 'rafael', 'manuel', 'samuel', 'gael', 'thiago',
    'benjamin', 'bautista', 'valentin', 'lautaro', 'ciro', 'dante', 'enzo', 'luca', 'nicola', 'andres',
    'lucio', 'felipe', 'francisco', 'guillermo', 'gerardo', 'eduardo', 'esteban', 'emanuel', 'exequiel', 'hugo',
    'horacio', 'ivan', 'jonathan', 'kevin', 'lionel', 'maximo', 'nahuel', 'octavio', 'ramiro', 'rodrigo',
    'salvador', 'tobias', 'ulises', 'victor', 'vicente', 'hernan', 'mariano', 'dario', 'silvio', 'alfredo',
    'antonio', 'armando', 'benito', 'cesar', 'domingo', 'edgardo', 'eugenio', 'fabricio', 'gaston', 'humberto',
    'jesus', 'joel', 'lorenzo', 'marcelino', 'mateo', 'nestor', 'norberto', 'osvaldo', 'patricio', 'rene',
    'rolando', 'santino', 'saul', 'teodoro', 'tomy', 'wilson', 'orlando', 'olmos', 'abel', 'julian',
    'eric', 'erik', 'alexis', 'ramon', 'robert', 'axel', 'david', 'roy', 'samael', 'fran',
    'edson', 'rodri', 'seba', 'nico', 'santi', 'lucho', 'guille', 'tato', 'jonatan', 'brian',
    'braian', 'elian', 'yamil', 'said',
]);

const MUJER = new Set([
    'maria', 'ana', 'laura', 'silvia', 'monica', 'patricia', 'sandra', 'claudia', 'gabriela', 'alejandra',
    'veronica', 'natalia', 'carolina', 'romina', 'florencia', 'agustina', 'sofia', 'valentina', 'martina', 'camila',
    'julieta', 'micaela', 'antonella', 'daniela', 'mariana', 'luciana', 'lucia', 'melina', 'marcela', 'adriana',
    'cecilia', 'susana', 'graciela', 'liliana', 'norma', 'mirta', 'elsa', 'nelida', 'beatriz', 'teresa',
    'rosa', 'carmen', 'josefa', 'juana', 'marta', 'elena', 'isabel', 'raquel', 'ester', 'ruth',
    'noemi', 'mercedes', 'dolores', 'pilar', 'soledad', 'sole', 'belen', 'guadalupe', 'milagros', 'candela',
    'abril', 'catalina', 'emilia', 'renata', 'olivia', 'delfina', 'francesca', 'victoria', 'bianca', 'jazmin',
    'ailen', 'aylen', 'brenda', 'carla', 'cintia', 'debora', 'eliana', 'evelyn', 'fernanda', 'gisela',
    'ivana', 'johana', 'karina', 'leticia', 'lorena', 'macarena', 'magali', 'maite', 'malena', 'marina',
    'nadia', 'noelia', 'paola', 'paula', 'rocio', 'sabrina', 'samanta', 'tamara', 'vanesa', 'vanina',
    'yamila', 'yesica', 'andrea', 'estefania', 'anabella', 'araceli', 'aurora', 'blanca', 'celeste', 'clara',
    'constanza', 'dalia', 'eva', 'gladys', 'griselda', 'ines', 'irene', 'ivonne', 'lidia', 'luz',
    'magdalena', 'margarita', 'marisa', 'marisol', 'miriam', 'mora', 'nancy', 'nora', 'olga', 'perla',
    'ramona', 'rebeca', 'sara', 'silvana', 'stella', 'valeria', 'viviana', 'ximena', 'yanina', 'zulema',
    'alicia', 'amalia', 'antonia', 'bárbara', 'barbara', 'cristina', 'elizabeth', 'gimena', 'jimena', 'jesica',
    'lara', 'leila', 'nahir', 'nicole', 'priscila', 'rita', 'sonia', 'vera', 'virginia', 'wanda',
    'karen', 'lourdes', 'flor', 'ayelen', 'zoe', 'euge', 'romi', 'faby', 'lore', 'naty',
    'belu', 'marce', 'mary', 'sabri', 'ely', 'jime', 'miry', 'miryan', 'mirian', 'pame',
    'cari', 'yani', 'damaris', 'marisel', 'evelin', 'janet', 'lau', 'sil', 'dalit', 'caro',
    'vicky', 'meli', 'aye', 'anto', 'juli', 'nati', 'coty', 'tefi', 'pili', 'chechu',
]);

module.exports = { VARON, MUJER };
