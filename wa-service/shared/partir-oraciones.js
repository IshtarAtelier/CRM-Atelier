'use strict';

/**
 * Partir un texto en ORACIONES sin romper precios, links ni fotos.
 *
 * POR QUÉ existe (10/10/2026): el saneado de la salida borraba "la oración"
 * con una regex del tipo `[^.!?\n]*FRASE[^.!?\n]*[.!?]*`. Para esa regex el
 * punto de los miles es un fin de oración, así que
 *   "El Ray-Ban sale $185.000, ahí te paso la foto"
 * salía como "$185." — y un link "https://atelieroptica.com.ar/tienda" quedaba
 * cortado en "https://atelieroptica.". Pasaba en cinco filtros distintos
 * (relleno, derivación, identidad, razonamiento y placeholders).
 *
 * La regla de acá: lo que se saca, se saca ENTERO, y los límites de una
 * oración los decide UN solo divisor que sabe que estas cosas no se parten:
 *   - `[IMAGE: url]`
 *   - URLs (con o sin https, "atelieroptica.com.ar/tienda") y mails
 *   - números con separador: $185.000, 34.480, 1,50, 1.74
 *   - abreviaturas de dirección y de trato: Av., Dr., Dra., Sr., Sra., Lic., N°.
 * Antes de partir se ENMASCARAN (se reemplazan por una marca sin puntuación) y
 * después se devuelven tal cual, carácter por carácter.
 */

const PROTEGIDOS = [
    /\[IMAGE:\s*[^\]]+\]/gi,
    /\bhttps?:\/\/[^\s<>"]+[^\s<>".,!?;:)\]]/gi,
    /\bwww\.[^\s<>"]+[^\s<>".,!?;:)\]]/gi,
    /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g,
    // Dominio pelado: "atelieroptica.com.ar" o "atelieroptica.com.ar/tienda".
    /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|ar|io|app)(?:\.[a-z]{2})?(?:\/[^\s<>"]*[^\s<>".,!?;:)\]])?/gi,
    // Números con separador de miles o decimales, con o sin $.
    /\$?\s?\d+(?:[.,]\d+)+/g,
    /\b(?:Av|Avda|Dr|Dra|Sr|Sra|Srta|Lic|Ing|Prof|Nro|N°|aprox|Tel)\./g,
];

// Una marca que no tiene ni puntuación ni espacios: no puede partir nada.
const MARCA = (i) => `\u0000${i}\u0000`;
const MARCA_RE = /\u0000(\d+)\u0000/g;

function enmascarar(texto) {
    const guardados = [];
    let t = String(texto ?? '');
    for (const re of PROTEGIDOS) {
        re.lastIndex = 0;
        t = t.replace(re, (m) => { guardados.push(m); return MARCA(guardados.length - 1); });
    }
    return { t, guardados };
}

function desenmascarar(t, guardados) {
    // Las marcas pueden quedar anidadas (un número dentro de una URL ya
    // enmascarada no, pero una URL dentro de [IMAGE:] sí): se repite hasta
    // que no queda ninguna.
    let prev;
    do {
        prev = t;
        t = t.replace(MARCA_RE, (_, i) => guardados[Number(i)]);
    } while (t !== prev);
    return t;
}

/**
 * Fin de oración: . ! ? … (uno o varios), con los emojis que vengan pegados
 * atrás ("Hola! 😊 Cómo estás?" → "Hola! 😊" + "Cómo estás?").
 */
const FIN_DE_ORACION = /(?<=[.!?…]+(?:[ \t]*\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)*)[ \t]+/u;

/**
 * Las oraciones de UNA línea (no mira saltos de línea: eso es estructura y lo
 * maneja quien llama). Devuelve los pedazos originales, sin espacios en los
 * bordes. Unidos con un espacio reconstruyen la línea.
 *
 * @param {string} linea
 * @returns {string[]}
 */
function oraciones(linea) {
    const { t, guardados } = enmascarar(linea);
    return t.split(FIN_DE_ORACION)
        .map(o => desenmascarar(o, guardados).trim())
        .filter(Boolean);
}

/**
 * Saca de un bloque (puede tener varias líneas) las oraciones que cumplen
 * `quitar`. Conserva los saltos de línea; una línea que se queda sin
 * oraciones desaparece entera.
 *
 * @param {string} bloque
 * @param {(oracion: string) => boolean} quitar
 * @returns {{ bloque: string, quitadas: string[] }}
 */
function quitarOraciones(bloque, quitar) {
    const quitadas = [];
    const lineas = String(bloque ?? '').split('\n').map(linea => {
        if (!linea.trim()) return linea;
        const os = oraciones(linea);
        const quedan = os.filter(o => {
            if (quitar(o)) { quitadas.push(o); return false; }
            return true;
        });
        if (quedan.length === os.length) return linea; // intacta, carácter por carácter
        return quedan.length ? quedan.join(' ') : null;
    }).filter(l => l !== null);
    return { bloque: lineas.join('\n'), quitadas };
}

/** ¿La oración lleva un dato que no se puede perder (precio, link, foto)? */
function llevaDato(oracion) {
    return /\[IMAGE:/i.test(oracion)
        || /https?:\/\/|www\.|\.com\b|\.com\.ar\b/i.test(oracion)
        || /\$\s?\d/.test(oracion)
        || /\b\d{1,3}(?:\.\d{3})+\b/.test(oracion);
}

module.exports = { oraciones, quitarOraciones, llevaDato, enmascarar, desenmascarar };
