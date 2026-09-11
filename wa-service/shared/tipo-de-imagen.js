/**
 * El tipo REAL de una imagen, leído de sus primeros bytes.
 *
 * Por qué existe (10/9/2026): las fotos que llegan por WhatsApp se guardan SIN
 * extensión (Meta no manda nombre de archivo para las fotos), así que
 * /api/storage/view las sirve como `application/octet-stream`. El bot tenía
 * `if (!mimeType.startsWith('image/')) return null` y las DESCARTABA antes de
 * mostrárselas al modelo: el modelo sabía que había llegado una imagen pero no
 * la veía. Con Maxi inventó los 6 valores de la receta; con Karen dijo "ya
 * tengo tu receta" y preguntó "¿monofocales o multifocales?". No era falta de
 * capacidad del modelo: estaba ciego.
 *
 * Los bytes no mienten; la cabecera del servidor sí puede.
 */
function detectarTipoDeImagen(buf) {
    if (!buf || buf.length < 12) return null;
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg';
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'image/png';
    if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
    if (buf.slice(0, 3).toString('ascii') === 'GIF') return 'image/gif';
    const marca = buf.slice(4, 12).toString('ascii');
    if (/^ftyp(heic|heix|mif1|msf1|avif)/.test(marca)) return marca.includes('avif') ? 'image/avif' : 'image/heic';
    return null;
}

module.exports = { detectarTipoDeImagen };
