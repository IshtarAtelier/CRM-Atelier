/**
 * Lo que hace que una publicación se encuentre: hashtags y texto alternativo.
 *
 * Instagram y Facebook no son buscadores, pero tienen búsqueda interna y Google
 * indexa el perfil. Lo que se puede trabajar es concreto y son tres cosas:
 *
 * 1. HASHTAGS LOCALES. El alcance útil de una óptica de barrio es geográfico:
 *    alguien que busca "óptica Cerro de las Rosas" está a quince cuadras y
 *    puede venir hoy. Los hashtags gigantes (#lentes, 4 millones de posts) no
 *    sirven: la publicación desaparece en segundos y atrae gente de otro país.
 *
 * 2. LAS PALABRAS QUE LA GENTE ESCRIBE, en el epígrafe y en la placa. No
 *    "soluciones ópticas de vanguardia" sino "multifocales", "me mareo",
 *    "cuánto cuesta". El blog del sitio ya está escrito así y por eso posiciona.
 *
 * 3. TEXTO ALTERNATIVO. Instagram lo acepta por API (`alt_text`) y casi nadie
 *    lo carga. Lo lee el buscador interno y lo lee un lector de pantalla, así
 *    que es lo único de esta lista que además sirve para que una persona ciega
 *    entienda la publicación.
 *
 * Los hashtags base están acá y no copiados en cada pieza: son los mismos para
 * todas y el día que se agregue uno, entra en las que vengan sin tocar nada.
 */

/** Los que van en TODAS: dicen qué somos y dónde estamos. */
export const HASHTAGS_BASE = [
    'opticacordoba',
    'cerrodelasrosas',
    'opticacerrodelasrosas',
    'cordobaargentina',
    'atelieroptica',
];

/**
 * Por tema. Se eligen por el pilar y por lo que la pieza trata de verdad —
 * poner #multifocales en una pieza que no habla de multifocales atrae gente
 * que se va enseguida, y eso el algoritmo lo mide y lo castiga.
 */
export const HASHTAGS_POR_TEMA = {
    multifocales: ['multifocales', 'lentesmultifocales', 'progresivos', 'presbicia'],
    receta: ['recetaoftalmologica', 'saludvisual', 'controlvisual'],
    cristales: ['antirreflejo', 'filtroazul', 'cristalesopticos'],
    armazones: ['armazones', 'anteojosrecetados', 'lentesopticos'],
    sol: ['anteojosdesol', 'lentesdesol', 'proteccionuv'],
    taller: ['laboratoriooptico', 'opticaindependiente'],
    local: ['opticaenCordoba', 'showroom'],
};

/**
 * Arma el bloque de hashtags de una pieza.
 * Máximo 12: más que eso Instagram lo lee como spam, y de todos modos los
 * últimos ya no aportan alcance.
 */
export function hashtagsDePieza(pieza) {
    const propios = (pieza.temas || []).flatMap(t => HASHTAGS_POR_TEMA[t] || []);
    const todos = [...new Set([...propios, ...HASHTAGS_BASE])].slice(0, 12);
    return todos.map(h => `#${h}`).join(' ');
}

/** El epígrafe completo: el texto de la pieza y abajo los hashtags. */
export function captionConHashtags(pieza, mensaje) {
    const tags = hashtagsDePieza(pieza);
    return tags ? `${mensaje}\n\n.\n.\n${tags}` : mensaje;
}

/** Los de salud visual: sirven para cualquier pieza, hablen de lo que hablen. */
export const HASHTAGS_SALUD = ['saludvisual', 'cuidadovisual', 'vision'];

/**
 * Ocho hashtags para un reel, con las tres familias representadas: el tema de
 * la pieza, salud visual y Córdoba.
 *
 * Ocho y no doce porque en un reel el epígrafe se ve cortado a dos líneas y
 * cada hashtag de más empuja el texto que sí importa fuera de la vista. Se
 * mezclan las tres familias a propósito: solo de tema, compite con cuentas
 * nacionales; solo locales, no aparece en ninguna búsqueda de interés.
 */
export function hashtagsDeReel(pieza, tope = 8) {
    const tema = (pieza.temas || []).flatMap(t => HASHTAGS_POR_TEMA[t] || []);
    // 3 del tema + 2 de salud + el resto locales. Si alguna familia no llega,
    // las otras completan hasta el tope.
    const mezcla = [
        ...tema.slice(0, 3),
        ...HASHTAGS_SALUD.slice(0, 2),
        ...HASHTAGS_BASE,
        ...tema.slice(3),
    ];
    return [...new Set(mezcla)].slice(0, tope).map(h => `#${h}`).join(' ');
}

/**
 * Texto alternativo de una placa.
 *
 * Sale del título y la bajada de la propia slide, sin los asteriscos del
 * resaltado. Describe lo que dice la placa, que es lo que hay que describir:
 * el texto ES el contenido de estas piezas.
 *
 * Instagram corta en 1000 caracteres; se recorta antes para no depender de eso.
 */
export function altDeSlide(slide, pieza) {
    const limpio = (t) => (t || '').replace(/\*/g, '').trim();
    const partes = [limpio(slide.title), limpio(slide.subtitle), limpio(slide.body)]
        .filter(Boolean);
    if (slide.items?.length) partes.push(slide.items.map(limpio).join('. '));
    if (slide.dato) partes.unshift(limpio(slide.dato));

    const texto = partes.join('. ').replace(/\.\.+/g, '.').trim();
    const completo = texto || `Publicación de Atelier Óptica: ${pieza.id}`;
    return completo.length > 950 ? `${completo.slice(0, 947)}...` : completo;
}
