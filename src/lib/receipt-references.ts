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
    cuit: string | null;
    date: string | null;
    ids: string[];
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
        if (key.length < 5 || seen.has(key)) continue;
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
        return { values: { amount: null, cuit: null, date: null, ids }, disagreements, bothListedIds: false };
    }

    let amount: number | null = null;
    if (primary.amount != null && supervisor.amount != null) {
        if (Math.abs(primary.amount - supervisor.amount) <= 1) {
            amount = primary.amount;
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

    let date: string | null = null;
    if (primary.date && supervisor.date) {
        if (primary.date === supervisor.date) {
            date = primary.date;
        } else {
            disagreements.push(`Los dos lectores leyeron fechas distintas (${primary.date} vs ${supervisor.date}): no se auditó la fecha.`);
        }
    }

    return {
        values: { amount, cuit, date, ids },
        disagreements,
        bothListedIds: primary.ids.length > 0 && supervisor.ids.length > 0
    };
}

const CAMPOS_JSON = `{
  "amount": número decimal del importe pagado, sin símbolos ni puntos de miles, usando punto para decimales. Si no se lee con claridad, null,
  "cuit": "el CUIT o CUIL del DESTINATARIO (el que cobra, no el que paga), sin guiones. Si no aparece o no se lee con claridad, null",
  "date": "fecha del pago en formato YYYY-MM-DD. Si no aparece o no se lee con claridad, null",
  "transaction_id": "el identificador principal: el Número de operación si aparece, si no el número de transferencia o comprobante. Si no hay, null",
  "reference_ids": ["TODOS los identificadores que figuran en el comprobante, uno por elemento, transcriptos tal cual: número de operación, código de identificación, número de comprobante, ID de transacción, código de autorización. Un mismo comprobante suele traer DOS o MÁS y hay que listarlos todos. NO incluyas CBU, CVU, alias, CUIT/CUIL, importes, fechas ni números de tarjeta. Si no hay ninguno, []"]
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
- Algunas observaciones comparan contra datos del sistema (por ejemplo, que un número ya estaba cargado en otro pago). En esas, verificá únicamente que el número citado figure en el comprobante; lo del otro pago lo aporta el sistema y se da por cierto.

Datos del sistema: cliente "${ctx.clientName}", el pago se cargó por $${ctx.loadedAmount}.

Devolvé ESTRICTAMENTE un JSON plano, un elemento por observación y en el mismo orden:
{"verificaciones": [{"n": 1, "confirmada": true, "motivo": "en una frase, qué viste en el comprobante que la confirma o la descarta"}]}
Solo el JSON, sin texto antes ni después.`;
}
