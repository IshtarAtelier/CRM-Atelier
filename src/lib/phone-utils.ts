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

/**
 * Las características argentinas de 3 dígitos. Junto con el 11 (2 dígitos) es
 * todo lo que hace falta para partir un número: en Argentina área + abonado
 * suman siempre 10 dígitos, así que lo que no es 11 ni está en esta lista es
 * un área de 4.
 *
 * Sin la tabla no hay forma de adivinar: "3512008711" y "3541200871" tienen la
 * misma pinta y son Córdoba capital (351) y Villa Carlos Paz (3541). Un
 * `length - 6` a ojo mostraba el número de Córdoba como "3512 008-711".
 */
const AREAS_DE_TRES = new Set([
    '220', '221', '223', '230', '236', '237', '249', '260', '261', '263', '264',
    '266', '280', '291', '297', '299', '341', '342', '343', '345', '348', '351',
    '353', '358', '362', '364', '370', '376', '379', '380', '381', '383', '385',
    '387', '388',
]);

/**
 * El teléfono como se lee, para mostrarlo en pantalla: `+54 9 351 200-8711`.
 *
 * Si el número guardado no se puede normalizar (extranjeros, cargados a medias),
 * devuelve lo que hay tal cual: mejor un número raro a la vista que ninguno.
 */
export function telefonoLegible(phone: string | null | undefined): string {
    if (!phone) return '';
    const e164 = formatPhoneForWhatsApp(phone);
    const local = e164.startsWith('549') ? e164.slice(3) : '';
    if (local.length !== 10) return phone.trim();

    const areaLen = local.startsWith('11') ? 2 : AREAS_DE_TRES.has(local.slice(0, 3)) ? 3 : 4;
    const area = local.slice(0, areaLen);
    const abonado = local.slice(areaLen);
    // `floor`, no `ceil`: el abonado de 7 dígitos se lee 3-4 ("868-5644", el
    // número de la óptica), no 4-3. Con 8 (área 11) y con 6 el corte es al medio.
    const corte = Math.floor(abonado.length / 2);
    return `+54 9 ${area} ${abonado.slice(0, corte)}-${abonado.slice(corte)}`;
}
