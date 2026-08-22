/**
 * Comparación de secretos en tiempo constante.
 *
 * Un `===` sobre strings corta en el primer byte distinto, así que el tiempo de
 * respuesta filtra cuántos caracteres del principio acertaste. Con eso un
 * atacante reconstruye el secreto byte por byte en vez de tener que adivinarlo
 * entero.
 *
 * Esta función ya existía dentro de `src/middleware.ts`, donde protege la
 * `BOT_API_KEY`. Vive acá porque los crons la necesitan igual y no pueden
 * importarla del middleware: hoy todos comparan su `CRON_SECRET` con `!==`,
 * teniendo la versión correcta a un import de distancia.
 *
 * Nota: la comparación de longitud sí es temprana. Filtra el LARGO del secreto,
 * que no es un dato útil para reconstruirlo — y sin ella habría que recorrer el
 * más largo de los dos, que filtra lo mismo.
 */
export function safeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    const encoder = new TextEncoder();
    const aBuf = encoder.encode(a);
    const bBuf = encoder.encode(b);
    let result = 0;
    for (let i = 0; i < aBuf.length; i++) {
        result |= aBuf[i] ^ bBuf[i];
    }
    return result === 0;
}

/**
 * Lee el secreto de un cron desde el header `Authorization: Bearer <token>`.
 *
 * El `.replace('Bearer ', '')` que usaban los crons no está anclado: reemplaza
 * la primera aparición esté donde esté, así que un token que contenga esa
 * subcadena se deforma. Acá se exige el prefijo al principio y nada más.
 */
export function tokenBearer(header: string | null): string {
    if (!header || !header.startsWith('Bearer ')) return '';
    return header.slice('Bearer '.length).trim();
}
