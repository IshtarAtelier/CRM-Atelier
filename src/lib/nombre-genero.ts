/**
 * ¿El nombre de pila es de varón o de mujer? Y si no se sabe con seguridad,
 * `null` — nunca una suposición.
 *
 * Por qué existe (16/9/2026, Ishtar: "vi que confunde, si es hombre envía de
 * mujer"): el bot mandaba fotos de armazones filtrando por un `genero` que
 * DEDUCÍA EL MODELO del nombre de pila. Cuando no lo pasaba —que es lo
 * frecuente— no se filtraba nada, y a un hombre le llegaban monturas de mujer.
 * Ahora lo deduce el servidor de la ficha, con esta tabla, y el modelo ya no
 * decide.
 *
 * Criterio: primero la lista de nombres (manda sobre cualquier regla: "Andrea"
 * y "Guadalupe" son mujer en Argentina, "Luca" y "Nicola" varón); después la
 * terminación, con las excepciones que la rompen. Ante la duda, `null`: el
 * catálogo no se filtra y se muestran unisex y de los dos lados, que es el
 * error barato. Mostrarle a una persona algo que claramente no es para ella es
 * el error caro.
 */

const VARON = new Set([
    'juan', 'jose', 'carlos', 'luis', 'jorge', 'miguel', 'roberto', 'ricardo', 'daniel', 'pedro',
    'pablo', 'diego', 'fernando', 'gustavo', 'sergio', 'javier', 'marcelo', 'alejandro', 'raul', 'hector',
    'oscar', 'ruben', 'walter', 'claudio', 'omar', 'julio', 'mario', 'angel', 'rodolfo', 'alberto',
    'gabriel', 'martin', 'facundo', 'agustin', 'santiago', 'nicolas', 'matias', 'lucas', 'tomas', 'joaquin',
    'ignacio', 'emiliano', 'maximiliano', 'maxi', 'leandro', 'gonzalo', 'federico', 'sebastian', 'cristian', 'christian',
    'german', 'ariel', 'adrian', 'damian', 'fabian', 'marcos', 'mauricio', 'leonardo', 'lisandro', 'franco',
    'bruno', 'elias', 'ezequiel', 'ismael', 'israel', 'rafael', 'manuel', 'samuel', 'daniel', 'gael',
    'thiago', 'benjamin', 'bautista', 'valentin', 'lautaro', 'ciro', 'dante', 'enzo', 'luca', 'nicola',
    'andres', 'lucio', 'felipe', 'francisco', 'guillermo', 'gerardo', 'eduardo', 'esteban', 'emanuel', 'exequiel',
    'hugo', 'horacio', 'ivan', 'jonathan', 'kevin', 'lionel', 'maximo', 'nahuel', 'octavio', 'ramiro',
    'rodrigo', 'salvador', 'tobias', 'ulises', 'victor', 'vicente', 'hernan', 'mariano', 'dario', 'silvio',
    'alfredo', 'antonio', 'armando', 'benito', 'cesar', 'domingo', 'edgardo', 'eugenio', 'fabricio', 'gaston',
    'humberto', 'jesus', 'joel', 'lorenzo', 'marcelino', 'mateo', 'nestor', 'norberto', 'osvaldo', 'patricio',
    'rene', 'rolando', 'santino', 'saul', 'teodoro', 'tomy', 'wilson', 'orlando', 'olmos', 'abel',
    // Nombres y apodos que aparecen en el padrón de Atelier y la regla no resolvía.
    'julian', 'eric', 'erik', 'alexis', 'ramon', 'robert', 'axel', 'david', 'roy', 'samael',
    'fran', 'edson', 'rodri', 'seba', 'nico', 'santi', 'lucho', 'guille', 'tato', 'kevin',
    'jonatan', 'brian', 'braian', 'elian', 'yamil', 'said', 'omar', 'raul', 'ruben', 'walter',
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
    // Nombres y apodos que aparecen en el padrón de Atelier y la regla no resolvía.
    'karen', 'lourdes', 'flor', 'ayelen', 'zoe', 'euge', 'romi', 'faby', 'lore', 'naty',
    'belu', 'marce', 'mary', 'sabri', 'ely', 'jime', 'miry', 'miryan', 'mirian', 'pame',
    'cari', 'yani', 'damaris', 'marisel', 'evelin', 'janet', 'lau', 'sil', 'dalit', 'caro',
    'vicky', 'meli', 'aye', 'anto', 'juli', 'nati', 'coty', 'tefi', 'pili', 'chechu',
]);

/**
 * Nombres terminados en -a que NO son de mujer y que la lista de arriba no
 * cubre (los que sí están —Luca, Nicola— los resuelve la lista, que manda
 * primero). Acá caen formas cortas y variantes: devuelven `null`, nunca MUJER.
 */
const EXCEPCIONES_TERMINACION = /^(elia|jeremia|matia|tobia|isaia|zacaria)$/;

export type GeneroDePersona = 'HOMBRE' | 'MUJER';

/** Solo el primer nombre, sin tildes ni signos, en minúscula. */
function normalizar(nombre: string): string {
    return (nombre || '')
        .trim()
        .split(/\s+/)[0]
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-zñ]/g, '');
}

export function generoDeNombre(nombre: string | null | undefined): GeneroDePersona | null {
    const pila = normalizar(nombre || '');
    if (pila.length < 3) return null;

    if (VARON.has(pila)) return 'HOMBRE';
    if (MUJER.has(pila)) return 'MUJER';

    // Regla de terminación, solo para lo que la lista no cubre.
    if (EXCEPCIONES_TERMINACION.test(pila)) return null;
    if (pila.endsWith('a')) return 'MUJER';
    if (pila.endsWith('o')) return 'HOMBRE';

    return null;
}
