/**
 * El estándar de calidad, escrito como código y no como criterio.
 *
 * Corre ANTES de renderizar y es BLOQUEANTE: si una regla falla, no se genera
 * ninguna imagen. Esa es toda la gracia. Una advertencia que se puede ignorar
 * deja de mirarse en tres semanas, y si quien arma la pieza es un agente, nunca
 * se miró.
 *
 * Las reglas están numeradas para que el error sea citable: el mensaje dice
 * "R3" y quien lo lee sabe qué arreglar sin interpretar prosa.
 *
 * R1  portada, bisagra y cierre llevan imagen
 * R2  un carrusel de 5 o más slides declara su bisagra
 * R3  nunca más de 3 slides seguidas sin imagen
 * R4  como máximo el 60% de las slides con imagen
 * R5  toda imagen citada existe de verdad en el banco
 * R6  una pieza con precio se genera desde la base, nunca a mano  ← propia
 *
 * Única excepción: `images_waived` a nivel pieza, CON una razón escrita. Sin
 * razón no hay excepción — una excepción sin motivo es la puerta por la que se
 * cae el estándar entero. R5 y R6 no se eximen nunca.
 */

const error = (regla, mensaje) => ({ nivel: 'error', regla, mensaje });
const aviso = (regla, mensaje) => ({ nivel: 'aviso', regla, mensaje });

/** Detecta un precio escrito a mano: "$120.000", "120000 pesos", "$ 89.900". */
function pareceUnPrecio(texto) {
    if (!texto) return false;
    return /\$\s?\d|(\b\d{4,}\s*(pesos|ars)\b)/i.test(String(texto));
}

/** Todo el texto visible de una slide, para revisarlo de una. */
function textoDeSlide(slide) {
    return [slide.title, slide.subtitle, slide.body, ...(slide.items || [])]
        .filter(Boolean).join(' ');
}

export function validarPieza(pieza) {
    const problemas = [];
    const slides = pieza.slides || [];

    if (!pieza.id) problemas.push(error('R0', 'La pieza no tiene `id` (se usa para la carpeta de salida).'));
    if (!slides.length) {
        problemas.push(error('R0', 'La pieza no tiene slides.'));
        return problemas;
    }

    // La excepción, y su condición: tiene que venir con una razón escrita.
    const eximida = typeof pieza.images_waived === 'string' && pieza.images_waived.trim().length > 8;
    if (pieza.images_waived && !eximida) {
        problemas.push(error('R0', '`images_waived` necesita una razón escrita, no `true` ni un texto vacío.'));
    }
    const nivelImagen = eximida ? aviso : error;

    // ── R5: las imágenes citadas existen (nunca se exime) ───────────────────
    for (const [i, s] of slides.entries()) {
        if (s.image && !s.imagenResuelta) {
            problemas.push(error('R5', `Slide ${i + 1}: la imagen "${s.image}" no existe en public/images/.`));
        }
    }

    // ── R6: los precios se generan desde la base (nunca se exime) ───────────
    // Es la regla que hace IMPOSIBLE publicar un precio viejo, en vez de que sea
    // "algo a tener cuidado". Una pieza con precio tiene que venir del generador
    // que lee la base, y ese le pone `fuente: "base"`.
    if (pieza.fuente !== 'base') {
        for (const [i, s] of slides.entries()) {
            if (pareceUnPrecio(textoDeSlide(s))) {
                problemas.push(error('R6',
                    `Slide ${i + 1}: tiene un precio escrito a mano. Las piezas con precio se generan ` +
                    `desde la base (que es la que sabe el precio de hoy), no se tipean.`));
            }
        }
    }

    // ── R1: portada, bisagra y cierre llevan imagen ─────────────────────────
    const conRol = (rol) => slides.filter(s => s.role === rol);
    const obligatorias = [
        ['portada', slides[0]],
        ['cierre', slides[slides.length - 1]],
        ...conRol('bisagra').map(s => ['bisagra', s]),
    ];
    for (const [nombre, slide] of obligatorias) {
        if (slide && !slide.image) {
            problemas.push(nivelImagen('R1', `La slide de ${nombre} (${slide.type}) tiene que llevar imagen.`));
        }
    }

    // ── R2: 5 slides o más declaran su bisagra ──────────────────────────────
    if (slides.length >= 5 && !conRol('bisagra').length) {
        problemas.push(nivelImagen('R2',
            `El carrusel tiene ${slides.length} slides y no declara su bisagra. ` +
            `Marcá con \`"role": "bisagra"\` la slide donde el contenido gira de "esto es un problema" a "esto se resuelve".`));
    }

    // ── R3: nunca más de 3 seguidas sin imagen ──────────────────────────────
    let seguidas = 0;
    for (const [i, s] of slides.entries()) {
        seguidas = s.image ? 0 : seguidas + 1;
        if (seguidas > 3) {
            problemas.push(nivelImagen('R3', `Slides ${i - 2} a ${i + 1}: cuatro seguidas sin imagen.`));
            break;
        }
    }

    // ── R4: como máximo el 60% con imagen ───────────────────────────────────
    //
    // Solo para carruseles. La regla existe porque en una secuencia que se
    // desliza, alternar foto y texto es lo que hace que la foto jerarquice: si
    // son todas foto, ninguna resalta.
    //
    // Una story de una sola placa no es una secuencia: se ve a pantalla
    // completa, dura 24 horas y la foto de fondo ES el formato. Aplicarle un
    // porcentaje no significa nada — con una sola slide, o da 0% o da 100%.
    if (slides.length > 1) {
        const conImagen = slides.filter(s => s.image).length;
        const porcentaje = Math.round((conImagen / slides.length) * 100);
        if (porcentaje > 60) {
            problemas.push(nivelImagen('R4',
                `${porcentaje}% de las slides tienen imagen (máximo 60%). Si todo es foto, la foto deja de jerarquizar.`));
        }
    }

    return problemas;
}
