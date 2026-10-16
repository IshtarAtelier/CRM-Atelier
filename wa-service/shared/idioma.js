'use strict';

/**
 * ¿En qué idioma está la respuesta del bot? Sin dependencias (lo cargan los
 * checks de CI, que corren sin `wa-service/node_modules`, y no hay ninguna
 * librería de detección instalada).
 *
 * POR QUÉ así y no por línea (10/10/2026): la primera versión del candado
 * miraba cada LÍNEA y la borraba si tenía 3 palabras "inglesas". Tres fallas:
 *   - falsos positivos: "Ray-Ban Wayfarer, the best seller" o un modelo con
 *     nombre en inglés silenciaban una línea buena;
 *   - el portugués pasaba entero (el modelo lo mezcla cuando el cliente
 *     escribe "obrigada");
 *   - "no" estaba en las dos listas y sumaba para los dos lados.
 * Ahora se mira la respuesta ENTERA y el resultado no es borrar líneas:
 * es RECHAZAR el mensaje (y que el grafo le pida al modelo que lo rehaga en
 * castellano, ver `graph.js`). Una respuesta mitad en inglés no se arregla
 * sacándole la mitad.
 *
 * Solo cuentan PALABRAS FUNCIONALES (artículos, pronombres, auxiliares):
 * son las que no aparecen en un nombre de producto. Además se ignoran los
 * links, las fotos, lo que va entre *asteriscos* (así se escriben los nombres
 * de modelo y los precios) y lo que va entre comillas.
 */

// Ninguna de estas existe en castellano. Sacadas a propósito: no, a, me, he,
// so, la, de, con, son — ambiguas.
const INGLES = new Set(('the and is are was were have has had you she it we they should would will ' +
    'not to of in on for with that this these those if does did according instructions user customer ' +
    'respond reply message already been be my further because then there what which can could need ' +
    'needs any about from at by an or but i i\'m don\'t doesn\'t i\'ll won\'t can\'t how your our their ' +
    'his her them do here just only also than when where who why').split(' '));

const ESPANOL = new Set(('el la los las de que y en un una unos unas por para con se lo le les te tu ' +
    'es son está estás estoy tenés tengo querés podés hola gracias dale si sí no muy más pero como al ' +
    'del mi su sus nos ya hay acá ahí también cuando donde qué cómo cuál esto eso este esta ese esa ' +
    'nosotros vos ustedes tenemos hacemos sale salen precio').split(' '));

// Formas que el castellano no tiene. "aqui", "porque", "dia" quedan afuera:
// en WhatsApp se escriben así en castellano también.
const PORTUGUES = new Set(('você voce vocês não nao obrigado obrigada também tambem muito muita isso ' +
    'essa esse uma com meu minha seus suas tem são sao estou ele ela nós então entao pra olá ola bom ' +
    'tudo bem fazer posso podemos').split(' '));

/** Lo que no se cuenta: no es prosa del modelo sino datos o nombres. */
function sinDatos(texto) {
    return String(texto ?? '')
        .replace(/\[IMAGE:[^\]]*\]/gi, ' ')
        .replace(/https?:\/\/\S+|www\.\S+/gi, ' ')
        .replace(/\*[^*\n]{1,80}\*/g, ' ')
        .replace(/"[^"\n]{1,80}"|“[^”\n]{1,80}”/g, ' ');
}

/**
 * @param {string} texto  la respuesta ENTERA (todas las burbujas juntas)
 * @returns {{ idioma: 'es'|'en'|'pt', en: number, es: number, pt: number }}
 */
function detectarIdioma(texto) {
    const palabras = sinDatos(texto).toLowerCase().match(/[a-záéíóúñüçãõâêô']+/g) || [];
    let en = 0, es = 0, pt = 0;
    for (const p of palabras) {
        if (INGLES.has(p)) en++;
        if (ESPANOL.has(p)) es++;
        if (PORTUGUES.has(p) || /(?:ção|ções|ão)$/.test(p)) pt++;
    }
    let idioma = 'es';
    // Un par de palabras sueltas en inglés en una respuesta castellana es un
    // nombre de producto o una frase hecha. Hacen falta varias y que superen
    // CLARAMENTE a las castellanas.
    if ((en >= 4 && en > es * 2) || (en >= 3 && es === 0)) idioma = 'en';
    else if ((pt >= 3 && pt > es) || (pt >= 2 && es === 0)) idioma = 'pt';
    return { idioma, en, es, pt };
}

/** ¿Hay que rechazar esta respuesta por idioma? */
function noEsCastellano(texto) {
    return detectarIdioma(texto).idioma !== 'es';
}

module.exports = { detectarIdioma, noEsCastellano };
