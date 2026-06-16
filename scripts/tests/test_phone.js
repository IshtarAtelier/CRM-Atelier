function normalizePhone(phone) {
    if (!phone) return null;
    let digits = phone.replace(/\D/g, '');
    if (!digits) return null;

    if (digits.startsWith('549')) {
        return digits;
    }
    
    if (digits.startsWith('54')) {
        digits = '9' + digits.substring(2);
        // Podría seguir teniendo un 15 adentro? (ej: +54 11 15 2233 4455 -> 54111522334455 -> 9111522334455 -> Wait, no, si le agrego el 54 se convierte en 5491115...)
        // Mejor procesar el 15 ANTES de agregar el 549.
    }

    // Process from scratch:
    let base = phone.replace(/\D/g, '');
    if (base.startsWith('549')) {
        base = base.substring(3);
    } else if (base.startsWith('54')) {
        base = base.substring(2);
    }
    
    if (base.startsWith('0')) {
        base = base.substring(1);
    }
    
    const regex15 = /^([1-3]\d{1,3})15(\d{6,8})$/;
    const match = base.match(regex15);
    if (match) {
        base = match[1] + match[2];
    }
    
    return '549' + base;
}

console.log(normalizePhone('11 2233 4455')); // 5491122334455
console.log(normalizePhone('011 15 2233 4455')); // 5491122334455
console.log(normalizePhone('03541 15 215971')); // 5493541215971
console.log(normalizePhone('+54 9 3541 215971')); // 5493541215971
console.log(normalizePhone('3541215971')); // 5493541215971
console.log(normalizePhone('+54 11 15 2233 4455')); // 5491122334455
