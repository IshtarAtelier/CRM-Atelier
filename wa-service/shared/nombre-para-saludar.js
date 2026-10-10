'use strict';

/**
 * Con qué nombre se saluda al que escribe ("Hola Luciano, cómo estás?"), o
 * con ninguno.
 *
 * Lo decide el CÓDIGO, no el modelo: un perfil "Ventas Rapilent", "🌸Lu🌸",
 * "Dra Fernández" o "maximilianoluna6699" no es un nombre para decir "Hola X".
 * Saludar mal es peor que saludar sin nombre, así que ante la duda devuelve "".
 *
 * Vivía en graph.js como `sanitizeFirstName` (regex `[a-záéíóúüñ]{3,20}` sobre
 * el primer token). Problemas que tenía (10/10/2026):
 *  - un emoji pegado ("🌸Lucía") hacía fallar la regex y se perdía un nombre bueno;
 *  - "Ana-Laura" y "João" no pasaban;
 *  - "Doctor", "Profe", "Seño", "Mami", "Peluquería", "Bendecida" sí pasaban;
 *  - "maximilianoluna6699" se cortaba en el dígito... y a veces pasaba igual.
 *
 * Y una regla de negocio: el nombre de la RECETA no sirve para saludar. Muchas
 * veces escribe la madre por el hijo o una hija por el padre: el paciente no es
 * el que está chateando. El saludo usa el perfil de WhatsApp del que escribe y,
 * si ese no sirve, la ficha — salvo que la ficha tenga recetas cargadas, porque
 * en ese caso su nombre puede haber salido de la receta (el prompt de ventas
 * le pide al bot crear la ficha con el nombre del paciente).
 *
 * Lo fija `npm run check:nombres-bot` (sin base ni red).
 */

const { VARON, MUJER } = require('./nombres-de-pila');

/**
 * Palabras que aparecen como primer "nombre" de un perfil y no son el nombre de
 * una persona: títulos, apodos de familia, comercios, rubros, frases.
 * Se comparan sin tildes y en minúscula.
 */
const NO_SON_NOMBRES = new Set([
    // genéricos
    'cliente', 'optica', 'ventas', 'info', 'atelier', 'yo', 'hola', 'familia', 'casa', 'trabajo',
    'whatsapp', 'usuario', 'user', 'business', 'contacto', 'desconocido', 'nuevo', 'sin', 'nombre',
    // títulos y profesiones
    'dr', 'dra', 'doc', 'doctor', 'doctora', 'lic', 'licenciado', 'licenciada', 'ing', 'ingeniero', 'ingeniera',
    'arq', 'arquitecto', 'arquitecta', 'prof', 'profe', 'profesor', 'profesora', 'seno', 'senor', 'senora',
    'sr', 'sra', 'srta', 'don', 'dona', 'cdor', 'cdora', 'contador', 'contadora', 'abogado', 'abogada',
    'escribano', 'escribana', 'odontologa', 'odontologo', 'kine', 'psico', 'nutri', 'pastor', 'padre', 'hermana',
    // apodos de familia o de cariño
    'mama', 'mami', 'papa', 'papi', 'abu', 'abue', 'abuela', 'abuelo', 'tia', 'tio', 'nona', 'nono',
    'amor', 'gordo', 'gorda', 'negro', 'negra', 'flaco', 'flaca', 'bebe', 'reina', 'princesa', 'chiqui',
    // comercios y rubros
    'kiosco', 'tienda', 'local', 'taller', 'estudio', 'consultorio', 'farmacia', 'inmobiliaria',
    'peluqueria', 'barberia', 'estetica', 'veterinaria', 'ferreteria', 'panaderia', 'almacen', 'libreria',
    'remis', 'remiseria', 'agencia', 'grupo', 'distribuidora', 'servicios', 'transporte', 'emprendimiento',
    // frases religiosas o de estado que la gente se pone de perfil
    'dios', 'bendecida', 'bendecido', 'bendiciones', 'jesus te ama', 'fe', 'gracias', 'feliz',
]);

/** Sin tildes ni diacríticos, minúscula. "João" → "joao", "Seño" → "seno". */
function sinTildes(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Saca emojis, banderas, modificadores de tono, ZWJ y signos sueltos. Deja
 * letras (de cualquier idioma), dígitos, espacios, guiones y apóstrofos —
 * los dígitos se dejan a propósito: son la señal de "esto es un usuario".
 */
function limpiarDecoracion(raw) {
    return String(raw || '')
        .replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}‍️⃣]/gu, ' ')
        .replace(/[^\p{L}\p{M}\p{N}\s'’-]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** "ana-laura" → "Ana-Laura"; "JOÃO" → "João". */
function capitalizar(nombre) {
    return nombre
        .toLowerCase()
        .split('-')
        .map(p => p.charAt(0).toUpperCase() + p.slice(1))
        .join('-');
}

/**
 * El primer nombre utilizable de un texto de perfil o ficha, capitalizado, o "".
 * @param {string|null|undefined} raw
 * @returns {string}
 */
function primerNombreValido(raw) {
    if (!raw) return '';
    const limpio = limpiarDecoracion(raw);
    if (!limpio) return '';
    const primero = limpio.split(' ')[0];
    if (!primero) return '';

    // "maximilianoluna6699", "lu2": un dígito en el nombre es un usuario, no una persona.
    if (/\p{N}/u.test(primero)) return '';
    // Solo letras (con sus diacríticos), y un guion o apóstrofo en el medio.
    if (!/^\p{L}[\p{L}\p{M}]*(?:['’-]\p{L}[\p{L}\p{M}]*)*$/u.test(primero)) return '';

    const clave = sinTildes(primero);
    if (NO_SON_NOMBRES.has(clave)) return '';
    // Las frases de varias palabras de la lista negra ("jesus te ama") se miran
    // contra el texto entero.
    if (NO_SON_NOMBRES.has(sinTildes(limpio))) return '';

    // Lista positiva: un nombre conocido entra siempre (cada parte, si es compuesto).
    const partes = clave.split(/['’-]/);
    const conocido = partes.every(p => VARON.has(p) || MUJER.has(p));
    if (conocido) return capitalizar(primero);

    // No está en la lista: solo si tiene forma de nombre. Entre 3 y 12 letras
    // por parte (un "maximilianoluna" pegado es un usuario) y con alguna vocal.
    if (!partes.every(p => p.length >= 3 && p.length <= 12)) return '';
    if (!/[aeiouy]/.test(clave)) return '';
    // TODO EN MAYÚSCULAS y largo suele ser un comercio ("OPTIRED", "MAXIKIOSCO").
    if (primero.length > 4 && primero === primero.toUpperCase() && limpio.split(' ').length === 1) return '';
    return capitalizar(primero);
}

/**
 * El nombre con el que se saluda en este chat.
 *
 * @param {object} p
 * @param {string} [p.perfil]  nombre del perfil de WhatsApp del que escribe
 * @param {object|null} [p.ficha]  ficha del cliente ({ name, prescriptions })
 * @returns {string} el nombre de pila, o "" para saludar sin nombre
 */
function nombreParaSaludar({ perfil, ficha } = {}) {
    const delPerfil = primerNombreValido(perfil);
    if (delPerfil) return delPerfil;
    if (!ficha || !ficha.name) return '';
    // Con recetas cargadas, el nombre de la ficha puede ser el del paciente
    // (que no siempre es el que escribe). Mejor sin nombre.
    const tieneRecetas = Array.isArray(ficha.prescriptions) && ficha.prescriptions.length > 0;
    if (tieneRecetas) return '';
    return primerNombreValido(ficha.name);
}

module.exports = { nombreParaSaludar, primerNombreValido, NO_SON_NOMBRES };
