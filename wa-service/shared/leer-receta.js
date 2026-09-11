/**
 * Lector DEDICADO de recetas: una sola tarea, reglas estrictas, validación en
 * código. Lo llama el sistema apenas llega una foto; el bot conversacional
 * recibe los valores ya leídos en vez de "mirar la foto mientras charla".
 *
 * Por qué (10/9/2026): hasta hoy la lectura dependía de que el agente de
 * ventas, en medio de una charla, decidiera leer la foto, eligiera los valores
 * y llamara a `save_prescription_data`. Con eso se inventaron recetas (Maxi:
 * real -7.50/-8.00, guardada -6/-5.50 con una adición que no existe) y se
 * preguntó "¿monofocal o multifocal?" en vez de leer. Pedido de Ishtar: que
 * interprete mejor las recetas y dé presupuestos más acordes.
 *
 * Modelo: primero el más fino para letra manuscrita (probado 10/9: leyó EXACTA
 * la receta manuscrita de Karen, donde Flash erró el signo del cilindro); si
 * falla o no existe más —Google retiró gemini-2.5-pro sin aviso ese mismo
 * día—, cae a Flash. Configurable con MODELO_LECTURA_RECETA.
 *
 * Nada de lo que devuelve el modelo se usa sin pasar por `validar()`: un valor
 * fuera de rango clínico no se "corrige", se descarta.
 */
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { HumanMessage } = require('@langchain/core/messages');
const { tieneAdicion, adicionImplicita } = require('./tipo-de-lente');

const MODELOS = [process.env.MODELO_LECTURA_RECETA || 'gemini-3.1-pro-preview', 'gemini-2.5-flash'];
const TIMEOUT_MS = 35000;

const PROMPT = `Sos un óptico leyendo UNA foto que un cliente mandó por WhatsApp. Puede ser una receta de anteojos (Argentina, muchas veces manuscrita) o cualquier otra cosa (comprobante de pago, foto de unos anteojos, un DNI...).

Primero decidí si ES una receta de anteojos. Si no lo es, "esReceta": false y nada más.

Si es receta, leé los valores con estas reglas, que NO se negocian:
- "A.V." / "AV" / "Visión" es AGUDEZA VISUAL ("20/20", "20/25", "10/10", "1.0"): NO es adición, NO la pongas en ningún campo.
- Valores sin coma: "200" = 2.00, "125" = 1.25, "075" = 0.75, "-150" = -1.50.
- El eje va de 0 a 180 (a veces con "°"). La DIP/DNP (50 a 75) no es graduación.
- Una receta es MULTIFOCAL de una de estas DOS formas, y solo así: (a) sección "Lejos" + columna "Add"/"Adición" (un número entre +0.75 y +3.50), o (b) dos secciones "Lejos" y "Cerca", cada una con su graduación. Si solo hay "Lejos", NO hay adición.
- Si una receta dice solo el cilindro y el eje (sin esfera), la esfera es null.
- Respetá el SIGNO que ves (−/+). Si no se ve el signo, poné el valor y marcá "dudas".
- Ante la duda en un valor, null — nunca inventes para completar.
- "legible": true solo si pudiste leer con seguridad al menos los valores principales de los dos ojos.

Devolvé SOLO este JSON, sin texto alrededor:
{"esReceta":bool,"legible":bool,"odEsf":n|null,"odCil":n|null,"odEje":n|null,"oiEsf":n|null,"oiCil":n|null,"oiEje":n|null,"add":n|null,"odCercaEsf":n|null,"oiCercaEsf":n|null,"dip":n|null,"dudas":"texto corto o vacío"}`;

const enRango = (v, min, max) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max) ? v : null;
const num = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.').replace('°', ''));
    return Number.isFinite(n) ? n : null;
};

/** Filtra lo que devolvió el modelo contra los rangos clínicos. */
function validar(j) {
    const r = {
        odEsf: enRango(num(j.odEsf), -30, 30), odCil: enRango(num(j.odCil), -10, 10), odEje: enRango(num(j.odEje), 0, 180),
        oiEsf: enRango(num(j.oiEsf), -30, 30), oiCil: enRango(num(j.oiCil), -10, 10), oiEje: enRango(num(j.oiEje), 0, 180),
        add: null, odCercaEsf: enRango(num(j.odCercaEsf), -30, 30), oiCercaEsf: enRango(num(j.oiCercaEsf), -30, 30),
        dip: enRango(num(j.dip), 45, 80),
    };
    // La adición solo entra si es plausible (0,5 a 4,5): un "20" de A.V. muere acá.
    if (tieneAdicion(num(j.add))) r.add = Math.abs(num(j.add));
    if (r.odEje !== null) r.odEje = Math.round(r.odEje);
    if (r.oiEje !== null) r.oiEje = Math.round(r.oiEje);
    return r;
}

/**
 * @returns {Promise<{esReceta:boolean, legible:boolean, valores?:object, tipo?:'Monofocal'|'Multifocal', modelo?:string, dudas?:string, error?:string}>}
 */
async function leerReceta({ base64, mimeType }) {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;
    let ultimoError = null;
    for (const modelo of MODELOS) {
        try {
            const llm = new ChatGoogleGenerativeAI({ model: modelo, temperature: 0, apiKey, maxRetries: 1 });
            const res = await Promise.race([
                llm.invoke([new HumanMessage({ content: [
                    { type: 'text', text: PROMPT },
                    { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
                ] })]),
                new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout ${TIMEOUT_MS}ms`)), TIMEOUT_MS)),
            ]);
            const texto = String(res.content).replace(/```json|```/g, '').trim();
            const j = JSON.parse(texto.slice(texto.indexOf('{'), texto.lastIndexOf('}') + 1));
            if (!j.esReceta) return { esReceta: false, legible: false, modelo };
            const valores = validar(j);
            const hayOD = valores.odEsf !== null || valores.odCil !== null;
            const hayOI = valores.oiEsf !== null || valores.oiCil !== null;
            const legible = Boolean(j.legible) && hayOD && hayOI;
            const receta = { sphereOD: valores.odEsf, sphereOI: valores.oiEsf, nearSphereOD: valores.odCercaEsf, nearSphereOI: valores.oiCercaEsf };
            const multi = valores.add !== null || tieneAdicion(adicionImplicita(receta));
            return { esReceta: true, legible, valores, tipo: multi ? 'Multifocal' : 'Monofocal', modelo, dudas: j.dudas || '' };
        } catch (e) {
            ultimoError = `${modelo}: ${e.message}`;
            console.warn(`  ⚠️ [LeerReceta] ${ultimoError} — pruebo el siguiente modelo`);
        }
    }
    return { esReceta: false, legible: false, error: ultimoError };
}

module.exports = { leerReceta, validar, PROMPT };
