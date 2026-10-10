/**
 * El email del checkout: cuándo se guarda.
 *
 * El servidor rechaza un email malformado (el cron de carritos abandonados le
 * escribiría a una dirección basura). El navegador sincroniza el formulario
 * cada 2 s mientras se tipea, así que a mitad de camino ("maria@gm") el pedido
 * entero rebotaba con 400 y se perdían también el nombre y el teléfono que ya
 * estaban bien. Una sola regla para los dos lados: el navegador no manda un
 * email que el servidor va a rechazar.
 */

const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Sin espacios de más: los teclados de celular lo agregan al usar una sugerencia. */
export function emailLimpio(email: unknown): string {
  return typeof email === 'string' ? email.trim() : '';
}

/** true si el email (ya limpio o no) tiene un formato que se puede guardar. */
export function emailValido(email: unknown): boolean {
  return FORMATO_EMAIL.test(emailLimpio(email));
}
