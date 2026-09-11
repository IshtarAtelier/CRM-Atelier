/**
 * ¿Esto es el nombre de una persona? Espejo de
 * `wa-service/shared/nombre-de-persona.js` (el bot no puede importar .ts):
 * `check:motor` corre los dos contra la misma lista.
 *
 * Por qué existe acá (11/9/2026): el motor de seguimientos, en seco, eligió
 * mandarle "Hola 🫵🏻💪, buen día!" a un lead cuyo perfil de WhatsApp son tres
 * emojis. `nombreDePila` solo miraba largo y dígitos. Un nombre necesita al
 * menos dos LETRAS.
 */
const GENERICOS = new Set(['contacto nuevo wa', 'contacto nuevo', 'cliente', 'contacto', 'desconocido', '-', 'sin nombre', 'sin', 's/n']);
const PALABRAS_DE_FRASE = /\b(hola|buen|buenos|buenas|d[ií]as|tardes|noches|c[oó]mo|info|informaci[oó]n|consulta|presupuesto|receta|turno|precio|cu[aá]nto|quiero|necesito|busco|gracias|anteojos?|lentes?|armaz[oó]n|multifocal(es)?|cerca|lejos|sol)\b/i;

export function esNombreDePersona(nombre: string | null | undefined): boolean {
    if (!nombre || typeof nombre !== 'string') return false;
    const limpio = nombre.trim();
    if (limpio.length < 2) return false;
    if ((limpio.match(/\p{L}/gu) || []).length < 2) return false;
    if ((limpio.match(/\d/g) || []).length >= 5) return false;
    if (GENERICOS.has(limpio.toLowerCase())) return false;
    if (PALABRAS_DE_FRASE.test(limpio) || limpio.split(/\s+/).length > 4) return false;
    return true;
}
