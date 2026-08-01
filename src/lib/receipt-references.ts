/**
 * Lógica pura del auditor de comprobantes: cómo se comparan las referencias que
 * tipea un vendedor contra lo que dice el comprobante, y cómo se cruzan las dos
 * lecturas OCR. Sin dependencias, para poder testearla sola
 * (`npm run check:comprobantes`).
 *
 * El porqué de todo esto: el mail de "hay que corregirlo" sale firmado con el
 * nombre de Ishtar. Una referencia mal comparada la deja acusando a una vendedora
 * que hizo todo bien — como pasó con el comprobante de Mercado Pago de Veronica
 * Serlin, que trae DOS identificadores ("Número de operación" y "Código de
 * identificación") y el sistema tomaba uno solo.
 */

/** Una lectura del comprobante hecha por un lector OCR. */
export interface ReceiptReading {
    amount: number | null;
    /** El importe TAL CUAL está impreso ("$318.500"), sin convertir. */
    amountRaw: string | null;
    cuit: string | null;
    date: string | null;
    /** La fecha TAL CUAL está impresa ("17/07/26"), sin convertir. */
    dateRaw: string | null;
    ids: string[];
    /** Datos del cupón cuando es un ticket de posnet. */
    batchNumber: string | null;
    couponNumber: string | null;
    authNumber: string | null;
}

/**
 * Saca las etiquetas `[TX: ...]` que el auditor agrega al final de las notas para
 * rastrear duplicados, y deja solo lo que escribió la persona.
 */
export function stripTxTags(notes?: string | null) {
    return (notes || '').replace(/\s*\[TX:.*?\]\s*/g, ' ').trim();
}

/** Deja solo letras y números en mayúscula: "170.029-330 395" → "170029330395". */
export function normalizeRef(value: string) {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Forma canónica para comparar códigos alfanuméricos leídos por OCR, donde la O
 * y el 0 (o la I y el 1) se confunden todo el tiempo.
 */
export function ocrCanonical(value: string) {
    return normalizeRef(value).replace(/O/g, '0').replace(/[IL]/g, '1');
}

/** ¿La referencia que tipeó el vendedor es este identificador del comprobante? */
export function referencesMatch(userReference: string, extractedId: string) {
    const user = normalizeRef(userReference);
    const extracted = normalizeRef(extractedId);
    if (!user || !extracted) return false;
    if (user === extracted) return true;
    // Contención solo con referencias largas: con 3 o 4 dígitos cualquier cosa "coincide".
    if (user.length >= 6 && (user.includes(extracted) || extracted.includes(user))) return true;
    return ocrCanonical(userReference) === ocrCanonical(extractedId);
}

/** Solo los dígitos, para comparar CUITs escritos con o sin guiones. */
export function digitsOnly(value: string) {
    return value.replace(/\D/g, '');
}

/**
 * Parsea el importe impreso en un comprobante de forma DETERMINÍSTICA, sin
 * depender de cómo la IA interprete los separadores. Mismo blindaje que
 * `parseArgentineReceiptDate` hace con la fecha, y por la misma razón.
 *
 * El caso que lo motivó (31/7/2026): un comprobante de Ualá por **$318.500** se
 * leyó como el número `318.5` — la IA tomó el punto de MILES argentino como
 * coma decimal. El auditor comparó $318,5 contra los $318.501 cargados y salió
 * un "Monto difiere" por un pago que estaba perfecto.
 *
 * Reglas (convención argentina, tolerando también la yanqui):
 *  - "318.500" / "318,500" → 318500. Un único separador seguido de EXACTAMENTE
 *    tres dígitos es de miles: nadie escribe 318 pesos con 500 milésimos.
 *  - "1.234.567" → 1234567. Más de un separador igual siempre es de miles.
 *  - "1.234,56" y "1,234.56" → 1234.56. Con los dos, manda el último.
 *  - "318,50" / "318.50" → 318.5. Uno o dos dígitos detrás son centavos.
 */
export function parseReceiptAmount(raw?: string | number | null): number | null {
    if (raw == null) return null;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
    // Primer bloque numérico: descarta "$", "ARS", espacios y lo que venga al lado.
    const match = String(raw).replace(/\s/g, '').match(/\d[\d.,]*\d|\d/);
    if (!match) return null;
    let s = match[0];

    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    let decimalSep: string | null = null;

    if (lastDot >= 0 && lastComma >= 0) {
        decimalSep = lastDot > lastComma ? '.' : ',';
    } else if (lastDot >= 0 || lastComma >= 0) {
        const sep = lastDot >= 0 ? '.' : ',';
        const decimals = s.length - Math.max(lastDot, lastComma) - 1;
        const grupos = s.split(sep).length - 1;
        decimalSep = grupos > 1 || decimals === 3 ? null : sep;
    }

    if (decimalSep) {
        const milesSep = decimalSep === '.' ? ',' : '.';
        s = s.split(milesSep).join('').replace(decimalSep, '.');
    } else {
        s = s.replace(/[.,]/g, '');
    }

    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}

/**
 * ¿La diferencia entre lo que dice el comprobante y lo que se cargó es solo un
 * separador leído mal (×10, ×100 o ×1000), y no plata de verdad?
 *
 * Con esto NUNCA sale un reclamo por un punto de miles mal interpretado: queda
 * como nota para el admin y listo. Se prefiere perder una detección real
 * (un tipeo de 1000× es rarísimo y el admin igual lo ve) antes que mandarle una
 * acusación falsa a una vendedora con la firma de Ishtar abajo.
 */
export function looksLikeSeparatorArtifact(receiptAmount: number, loadedAmount: number) {
    if (!(receiptAmount > 0) || !(loadedAmount > 0)) return false;
    return [10, 100, 1000].some(factor => {
        const tolerancia = Math.max(receiptAmount, loadedAmount) * 0.005;
        return Math.abs(receiptAmount * factor - loadedAmount) <= tolerancia
            || Math.abs(loadedAmount * factor - receiptAmount) <= tolerancia;
    });
}

/**
 * ¿Son el mismo número del cupón? Los ceros a la izquierda no cuentan: el ticket
 * imprime "011" y la persona escribe "11", y es el mismo lote.
 */
export function sameVoucherNumber(a?: string | null, b?: string | null) {
    const na = normalizeRef(a || '').replace(/^0+/, '');
    const nb = normalizeRef(b || '').replace(/^0+/, '');
    if (!na || !nb) return false;
    return na === nb;
}

/**
 * Identificadores lo bastante largos como para etiquetar un pago y buscar
 * duplicados con ellos. Un nº de lote ("011") o de cupón ("0172") se repite todos
 * los días en cualquier terminal: usarlos para detectar duplicados sería fabricar
 * falsos positivos. Para los cobros presenciales, la clave es el trío completo
 * (ver `cardVoucherKey` en payment-card.ts).
 */
export function strongIds(ids: string[]) {
    return ids.filter(id => normalizeRef(id).length >= 8);
}

/** Une los identificadores de las dos lecturas sin repetir (comparando normalizado). */
export function mergeIds(a: string[], b: string[]): string[] {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const id of [...a, ...b]) {
        const key = normalizeRef(id);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        ids.push(id);
    }
    return ids;
}

/**
 * Junta todos los identificadores que devolvió la IA (principal + secundarios),
 * sin repetidos y descartando basura corta como "1" o "AR".
 */
export function collectReferenceIds(extracted: any): string[] {
    const raw = [
        extracted?.transaction_id,
        ...(Array.isArray(extracted?.reference_ids) ? extracted.reference_ids : [])
    ];

    const seen = new Set<string>();
    const ids: string[] = [];
    for (const value of raw) {
        if (typeof value !== 'string') continue;
        const id = value.trim();
        const key = normalizeRef(id);
        // Se aceptan números cortos (un nº de lote es "011") porque el vendedor
        // puede haber tipeado cualquiera de ellos como referencia; lo que NO se
        // hace con los cortos es buscar duplicados (ver `strongIds`).
        if (key.length < 3 || seen.has(key)) continue;
        seen.add(key);
        ids.push(id);
    }
    return ids;
}

/**
 * Cruza las dos lecturas del comprobante. Un dato solo queda habilitado para
 * auditar si los DOS lectores leyeron lo mismo; donde no coinciden, no se audita
 * y queda anotado para el admin. Es la garantía de que un mail firmado por Ishtar
 * nunca reclame algo que en realidad fue un error de OCR.
 */
export function crossCheckReadings(primary: ReceiptReading, supervisor: ReceiptReading | null) {
    const disagreements: string[] = [];
    const ids = mergeIds(primary.ids, supervisor?.ids || []);

    if (!supervisor) {
        disagreements.push('El segundo lector OCR no pudo leer el comprobante: se revisó con una sola lectura y no se le reclamó nada a nadie.');
        return {
            values: { amount: null, amountRaw: null, cuit: null, date: null, dateRaw: null, ids, batchNumber: null, couponNumber: null, authNumber: null },
            disagreements,
            bothListedIds: false
        };
    }

    let amount: number | null = null;
    let amountRaw: string | null = null;
    if (primary.amount != null && supervisor.amount != null) {
        if (Math.abs(primary.amount - supervisor.amount) <= 1) {
            amount = primary.amount;
            amountRaw = primary.amountRaw || supervisor.amountRaw;
        } else {
            disagreements.push(`Los dos lectores leyeron montos distintos en el comprobante ($${primary.amount.toLocaleString('es-AR')} vs $${supervisor.amount.toLocaleString('es-AR')}): no se auditó el monto.`);
        }
    } else if (primary.amount != null || supervisor.amount != null) {
        disagreements.push('Uno de los lectores no encontró el monto en el comprobante: no se auditó el monto.');
    }

    let cuit: string | null = null;
    if (primary.cuit && supervisor.cuit) {
        if (digitsOnly(primary.cuit) === digitsOnly(supervisor.cuit)) {
            cuit = primary.cuit;
        } else {
            disagreements.push(`Los dos lectores leyeron CUITs distintos (${primary.cuit} vs ${supervisor.cuit}): no se auditó el CUIT.`);
        }
    }

    // La fecha se audita a partir de la IMPRESA (dateRaw), que se parsea después
    // de forma determinística; `date` queda solo como referencia informativa.
    let dateRaw: string | null = null;
    if (primary.dateRaw && supervisor.dateRaw) {
        if (normalizeRef(primary.dateRaw) === normalizeRef(supervisor.dateRaw)) {
            dateRaw = primary.dateRaw;
        } else {
            disagreements.push(`Los dos lectores leyeron fechas distintas en el comprobante (${primary.dateRaw} vs ${supervisor.dateRaw}): no se auditó la fecha.`);
        }
    }

    let date: string | null = null;
    if (primary.date && supervisor.date && primary.date === supervisor.date) {
        date = primary.date;
    }

    // Datos del cupón: solo valen si los dos lectores leyeron el mismo número.
    const voucherField = (campo: 'batchNumber' | 'couponNumber' | 'authNumber', etiqueta: string) => {
        const a = primary[campo];
        const b = supervisor[campo];
        if (!a || !b) return null;
        if (sameVoucherNumber(a, b)) return a;
        disagreements.push(`Los dos lectores leyeron distinto el ${etiqueta} del ticket (${a} vs ${b}): no se auditó ese dato.`);
        return null;
    };

    return {
        values: {
            amount,
            amountRaw,
            cuit,
            date,
            dateRaw,
            ids,
            batchNumber: voucherField('batchNumber', 'nº de lote'),
            couponNumber: voucherField('couponNumber', 'nº de cupón'),
            authNumber: voucherField('authNumber', 'nº de autorización')
        },
        disagreements,
        bothListedIds: primary.ids.length > 0 && supervisor.ids.length > 0
    };
}

const CAMPOS_JSON = `{
  "amount_raw": "el importe pagado EXACTAMENTE como está impreso, con sus puntos y comas tal cual y sin el signo $ (por ejemplo '318.500' o '1.234.567,89'). Copiá los caracteres uno por uno, NO conviertas nada. Si no aparece, null",
  "amount": número del importe pagado. OJO: en Argentina el PUNTO separa los MILES y la COMA los centavos, así que '$318.500' son trescientos dieciocho mil quinientos y se escribe 318500 (NUNCA 318.5). Si no se lee con claridad, null,
  "cuit": "el CUIT o CUIL del DESTINATARIO (el que cobra, no el que paga), sin guiones. Si no aparece o no se lee con claridad, null",
  "date_raw": "la fecha del pago EXACTAMENTE como está impresa en el comprobante, sin reinterpretar ni convertir (por ejemplo '17/07/26' o '17-07-2026'). Copiá los dígitos tal cual. Si no aparece, null",
  "date": "la misma fecha en formato YYYY-MM-DD. OJO: los comprobantes argentinos la imprimen DÍA/MES/AÑO, así que '17/07/26' es 2026-07-17 (NO 2017). Si no aparece o no se lee con claridad, null",
  "transaction_id": "el identificador principal: el Número de operación si aparece, si no el número de transferencia o comprobante. Si no hay, null",
  "reference_ids": ["TODOS los identificadores que figuran en el comprobante, uno por elemento, transcriptos tal cual: número de operación, código de identificación, número de comprobante, ID de transacción, número de lote, número de cupón y número/código de autorización. Un mismo comprobante suele traer DOS o MÁS y hay que listarlos todos. NO incluyas CBU, CVU, alias, CUIT/CUIL, número de establecimiento o terminal, importes, fechas ni números de tarjeta. Si no hay ninguno, []"],
  "batch_number": "si es un ticket de posnet, el Nro. de lote transcripto TAL CUAL con sus ceros a la izquierda (ej. \\"011\\"). Si no aparece, null",
  "coupon_number": "si es un ticket de posnet, el Nro. de cupón transcripto TAL CUAL con sus ceros a la izquierda (ej. \\"0172\\"). Si no aparece, null",
  "auth_number": "si es un ticket de posnet, el Nro. de autorización transcripto TAL CUAL con sus ceros a la izquierda (ej. \\"007956\\"). Si no aparece, null"
}`;

/**
 * Consigna de cada lector. Se corre DOS veces con textos redactados distinto para
 * que los dos lectores no compartan el mismo sesgo: lo que uno malinterprete, el
 * otro lo desmiente.
 */
export function readerSystemPrompt(role: 'principal' | 'supervisor') {
    if (role === 'principal') {
        return `Eres un experto auditor de pagos. Analiza el comprobante adjunto y extrae la información ESTRICTAMENTE en este JSON plano:
${CAMPOS_JSON}
Solo devuelve el JSON, sin texto antes ni después.`;
    }

    return `Sos el segundo lector de un control cruzado: otra persona ya leyó este mismo comprobante y tu lectura se va a comparar con la suya.
Transcribí LITERALMENTE lo que ves, carácter por carácter, sin interpretar, completar ni corregir nada.
Prestá especial atención a distinguir la letra O del cero y la I del uno.
Si un dato no se lee con total claridad, devolvé null en vez de adivinar.
Devolvé ESTRICTAMENTE este JSON plano:
${CAMPOS_JSON}
Solo el JSON, sin texto antes ni después.`;
}

/** Texto que acompaña a la imagen en cada lectura. */
export function readerUserPrompt(role: 'principal' | 'supervisor') {
    return role === 'principal'
        ? 'Por favor, analiza este comprobante según las instrucciones.'
        : 'Transcribí los datos de este comprobante según las instrucciones.';
}

/**
 * Consigna del control final, el que decide si una observación llega a salir en
 * un mail firmado por Ishtar.
 */
export function verifierSystemPrompt(ctx: { clientName: string; loadedAmount: number }) {
    return `Sos el control de calidad final de una óptica. Con las observaciones que apruebes se le va a mandar un mail a los vendedores firmado con el nombre y apellido de la dueña, así que una observación equivocada la deja quedando mal a ella.

Mirá el comprobante adjunto y decidí, UNA POR UNA, si cada observación es cierta.

Reglas:
- Confirmá SOLO si lo que dice la observación se ve en el comprobante sin ninguna duda.
- Ante la mínima duda, ambigüedad o dato ilegible: confirmada = false.
- Un comprobante trae VARIOS identificadores (por ejemplo "Número de operación" y "Código de identificación"). Si la observación dice que una referencia no figura, revisá TODOS los números y códigos del comprobante antes de confirmar: si esa referencia aparece en cualquiera de ellos, la observación es FALSA.
- Las diferencias de formato no son errores: puntos, guiones, espacios o mayúsculas distintas son el mismo dato.
- Con los importes, leé a la argentina: el PUNTO separa los MILES y la COMA los centavos. "$318.500" son trescientos dieciocho mil quinientos, o sea el mismo importe que "318500". Si la única diferencia entre el comprobante y lo cargado es dónde cae un punto o una coma, la observación es FALSA.
- Algunas observaciones comparan contra datos del sistema (por ejemplo, que un número ya estaba cargado en otro pago). En esas, verificá únicamente que el número citado figure en el comprobante; lo del otro pago lo aporta el sistema y se da por cierto.

Datos del sistema: cliente "${ctx.clientName}", el pago se cargó por $${ctx.loadedAmount.toLocaleString('es-AR')}.

Devolvé ESTRICTAMENTE un JSON plano, un elemento por observación y en el mismo orden:
{"verificaciones": [{"n": 1, "confirmada": true, "motivo": "en una frase, qué viste en el comprobante que la confirma o la descarta"}]}
Solo el JSON, sin texto antes ni después.`;
}
