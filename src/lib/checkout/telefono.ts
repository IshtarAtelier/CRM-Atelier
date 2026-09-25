/**
 * El WhatsApp del checkout: qué se acepta al tipear y qué se guarda.
 *
 * Antes el campo validaba con `^\+?[0-9]{9,15}$`, así que rechazaba los
 * números como los escribe la gente ("351 123-4567", "+54 9 351 123 4567") y
 * el comprador se trababa en el paso que menos tendría que frenarlo
 * (auditoría del 25/9/2026). Ahora se acepta cualquier separador común al
 * tipear y lo que se guarda son solo los dígitos: la normalización al formato
 * de WhatsApp (549…) la hace el servidor con `normalizeArgentinePhone`.
 */

/** Dígitos, espacios, guiones, paréntesis y puntos, con un "+" opcional adelante. */
const CARACTERES_PERMITIDOS = /^\+?[\d\s\-().]*$/;

/** Cuántos dígitos puede tener un teléfono (con o sin 54 / 9 / 0 / 15 adelante). */
const MIN_DIGITOS = 9;
const MAX_DIGITOS = 15;

export const MENSAJE_TELEFONO_INVALIDO =
  'Ingresá tu WhatsApp con código de área, por ejemplo 351 123-4567.';

/** "+54 9 (351) 123-4567" → "5493511234567". */
export function telefonoADigitos(telefono: string | null | undefined): string {
  return (telefono || '').replace(/\D/g, '');
}

/** true si el texto tipeado es un teléfono que se puede guardar. */
export function telefonoValido(telefono: string | null | undefined): boolean {
  const texto = (telefono || '').trim();
  if (!CARACTERES_PERMITIDOS.test(texto)) return false;
  const digitos = telefonoADigitos(texto).length;
  return digitos >= MIN_DIGITOS && digitos <= MAX_DIGITOS;
}
