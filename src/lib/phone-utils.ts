/**
 * Normaliza un número de teléfono argentino para envío por WhatsApp.
 * Limpia caracteres no numéricos, remueve prefijos locales (0, 15),
 * y antepone el código internacional 549.
 * 
 * Replica la lógica de `normalizeArgentinePhone` del server-side
 * (contact.service.ts) para uso en componentes del frontend.
 * 
 * Ejemplos:
 *   "3541 15 123456"   → "5493541123456"
 *   "0351 4123456"     → "549351412345 6"
 *   "549 351 1234567"  → "5493511234567"
 *   "54 351 1234567"   → "5493511234567"
 *   "+54 9 351 123456" → "5493511234567"
 */
export function formatPhoneForWhatsApp(phone: string | null | undefined): string {
    if (!phone) return '';
    let base = phone.replace(/\D/g, '');
    if (!base) return '';

    // Strip international prefix if already present
    if (base.startsWith('549')) {
        base = base.substring(3);
    } else if (base.startsWith('54')) {
        base = base.substring(2);
    }

    // Strip leading local trunk prefix '0'
    if (base.startsWith('0')) {
        base = base.substring(1);
    }

    // Remove embedded mobile prefix '15' after area code (only if length > 10)
    if (base.length > 10) {
        const regex15 = /^([1-3]\d{1,3})15(\d{6,8})$/;
        const match = base.match(regex15);
        if (match) {
            base = match[1] + match[2];
        }
    }

    return '549' + base;
}
