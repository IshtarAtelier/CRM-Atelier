/**
 * Lint del prompt del bot: lo que un prompt NO puede decir y lo que TIENE que
 * decir, según las decisiones de Ishtar. Una sola lista, usada en tres lugares:
 *
 *   1. CI (scripts/checks/prompt-bot.check.mjs) sobre los prompts del REPO
 *      (salesPrompt.js, executivePrompt.js, CORE_RULES de graph.js);
 *   2. el cron diario `whatsapp-calidad`, sobre el prompt VIVO de la base
 *      (SystemSetting.bot_prompt), que es el que manda y que CI no ve;
 *   3. a mano, `npm run check:prompt-bot` contra producción.
 *
 * Por qué existe (10/9/2026): el prompt vivo se edita desde el panel y nadie lo
 * versiona ni lo valida. Hoy convivían, con "prioridad absoluta", una regla que
 * decía «sos Matías de Atelier Óptica» y otra que decía «nunca te inventes un
 * nombre»; una que decía «te paso con alguien del equipo» y otra «nunca
 * derivar»; «ante la duda preguntá ¿mono o multi?» y «el tipo lo dice la
 * receta». El modelo, con dos órdenes opuestas, elige cualquiera — y eligió
 * mal en producción. Esto convierte cada decisión en un chequeo que grita.
 */

export interface HallazgoDePrompt {
    /** 'prohibido' = apareció algo que no puede estar · 'falta' = no está algo obligatorio */
    tipo: 'prohibido' | 'falta';
    regla: string;
    /** Fragmento del prompt donde se encontró (solo para 'prohibido'). */
    donde?: string;
}

/**
 * Cada patrón lleva el motivo en criollo: es lo que va a leer quien reciba el
 * mail del cron, no un programador. Se evalúan sobre el prompt completo.
 * Las excepciones (`salvo`) permiten que la regla mencione la frase para
 * PROHIBIRLA ("nunca digas 'te paso con el equipo'") sin disparar el lint.
 */
const PROHIBIDO: { re: RegExp; regla: string; salvo?: RegExp }[] = [
    {
        re: /\bMat[ií]as de Atelier\b|\bsos (siempre )?(solo )?["“]?Mat[ií]as\b|presentate como Mat/i,
        regla: 'le da un nombre propio ("Matías"). Decisión del 18/8: el bot no tiene nombre; es "la atención de Atelier Óptica".',
    },
    {
        re: /te paso con (alguien|una persona|un asesor|el equipo)|ofrec[eé] pasarlo con el equipo|te derivo con|alguien del equipo (te|va a) (responder|atender|escribir)/i,
        regla: 'le enseña a derivar ("te paso con alguien del equipo"). Regla estricta: nunca le dice al cliente que lo deriva; escribe "Lo confirmo y te escribo en un ratito 😊".',
        salvo: /(nunca|jam[aá]s|prohibido|no) (le )?(digas|decir|anunci)[^.]{0,60}(te paso con|derivo|alguien del equipo)/i,
    },
    {
        re: /(ante (cualquier )?duda[^.]{0,40}(pregunt[aá]|consult[aá])[^.]{0,30}(mono|multi))|(duda entre (mono|multi)[^.]{0,40}(pregunt[aá]|consult[aá]))|pregunt[aá]le?[^.]{0,40}(¿|si )?(busc[aá]s?|quer[eé]s?) (mono|multi)/i,
        regla: 'le ordena preguntar "¿monofocal o multifocal?". La gente no sabe qué necesita: el tipo lo dice la RECETA.',
        salvo: /(nunca|jam[aá]s|prohibido|no) (le )?pregunt[^.]{0,40}(mono|multi)/i,
    },
    {
        re: /igual se le cotiza|para que tengas (una )?idea[^.]{0,40}(presupuesto|precio|cotiz)|ya sab[eé]s que quiere multifocales/i,
        regla: 'lo autoriza a cotizar sin receta o a dar por hecho el tipo de lente por el anuncio. Un presupuesto de cristales SIEMPRE sale de una receta; el anuncio no diagnostica.',
        salvo: /(nunca|jam[aá]s|prohibido|no existe|no des)[^.]{0,40}(para que tengas una idea|igual se le cotiza)/i,
    },
    {
        re: /pendiente de lectura/i,
        regla: 'contiene "pendiente de lectura": el bot se lo dijo a una clienta como excusa para cotizar sin receta. Nada de trámite interno hacia el cliente.',
        salvo: /(nunca|jam[aá]s|prohibido|no) (le )?(digas|decir)[^.]{0,40}pendiente de lectura/i,
    },
    {
        re: /soy (un|una) (bot|ia|inteligencia artificial|asistente virtual)\b(?![^.]{0,40}(prohibid|nunca|jam[aá]s))/i,
        regla: 'le hace anunciarse como bot/IA. Regla vigente: no anuncia que es automático.',
        salvo: /prohibid|nunca|jam[aá]s/i,
    },
];

const OBLIGATORIO: { re: RegExp; regla: string }[] = [
    { re: /SIEMPRE SALE DE UNA RECETA|sin receta no hay precio de cristales/i, regla: 'falta la regla "un presupuesto de cristales SIEMPRE sale de una receta".' },
    { re: /A\.V\.[^.]{0,80}(no|NO) es (la )?adici[oó]n/i, regla: 'falta la regla "A.V. (agudeza visual) no es adición" — así se cotizaron multifocales a una miopía de -8.' },
    { re: /NO LE TIRES DATOS|no le recit|nombre t[eé]cnico del cristal/i, regla: 'falta la regla de no tirarle datos técnicos al cliente.' },
    { re: /pedir_ayuda/, regla: 'no menciona la herramienta pedir_ayuda: si no sabe algo, tiene que callarse y avisar, no inventar.' },
    { re: /Lo confirmo y te escribo en un ratito/, regla: 'falta la frase aprobada para apartarse ("Lo confirmo y te escribo en un ratito 😊").' },
    { re: /anuncio no diagnostica/i, regla: 'falta "el anuncio no diagnostica" (quien vino por un aviso de multifocales no necesariamente los necesita).' },
];

/** Recorta el contexto alrededor de una coincidencia para el reporte. */
function contexto(texto: string, m: RegExpMatchArray): string {
    const i = m.index ?? 0;
    return texto.slice(Math.max(0, i - 40), Math.min(texto.length, i + (m[0]?.length ?? 0) + 40)).replace(/\s+/g, ' ').trim();
}

/**
 * @param texto el prompt (vivo o del repo)
 * @param opciones.soloProhibido true para los prompts parciales del repo (un
 *        módulo suelto no tiene por qué contener TODAS las reglas obligatorias)
 */
export function lintPromptDelBot(texto: string, opciones: { soloProhibido?: boolean } = {}): HallazgoDePrompt[] {
    const hallazgos: HallazgoDePrompt[] = [];
    const t = texto.replace(/\r\n/g, '\n');
    for (const p of PROHIBIDO) {
        for (const m of t.matchAll(new RegExp(p.re.source, p.re.flags.includes('g') ? p.re.flags : p.re.flags + 'g'))) {
            const zona = t.slice(Math.max(0, (m.index ?? 0) - 120), (m.index ?? 0) + m[0].length + 20);
            if (p.salvo && p.salvo.test(zona)) continue;
            hallazgos.push({ tipo: 'prohibido', regla: p.regla, donde: contexto(t, m) });
        }
    }
    if (!opciones.soloProhibido) {
        for (const o of OBLIGATORIO) if (!o.re.test(t)) hallazgos.push({ tipo: 'falta', regla: o.regla });
    }
    return hallazgos;
}

/** Para el mail del cron: una línea por hallazgo, en criollo. */
export function describirHallazgos(h: HallazgoDePrompt[]): string[] {
    return h.map(x => x.tipo === 'prohibido' ? `El prompt ${x.regla} → «…${x.donde}…»` : `Al prompt le ${x.regla}`);
}
