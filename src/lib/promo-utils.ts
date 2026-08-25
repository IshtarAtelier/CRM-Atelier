// Centralized promotion logic for CRM-Atelier Cotizador

/**
 * Detects if a product is a multifocal/progresivo eligible for the 2x1 promotion.
 * Rules: Must contain (multifocal OR progresivo) AND (2x1).
 */
/**
 * Helper to normalize strings for robust keyword matching (removes accents and special chars).
 */
const normalizeText = (text: string): string => {
    return (text || '')
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[^a-z0-9\s]/g, " ")   // Replace special chars with spaces
        .trim();
};

export const isMultifocal2x1 = (p: any): boolean => {
    if (!p) return false;

    // Primary: explicit flag set by admin — authoritative source of truth
    if (p.is2x1 === true) return true;

    // Fallback: legacy name-based detection
    const fullSearch = normalizeText(`${p.name || ''} ${p.brand || ''} ${p.type || ''} ${p.model || ''}`);
    
    const isMT = fullSearch.includes('multifocal') || fullSearch.includes('progresivo');
    
    // Robust 2x1 detection using Regex
    // Matches: 2x1, 2 x 1, 2por1, 2 por 1, dos por uno, dosxuno
    const promoRegex = /\b(2\s?x\s?1|2\s?por\s?1|dos\s?por\s?uno|dos\s?x\s?uno)\b/i;
    const is2x1 = promoRegex.test(fullSearch);
    
    return isMT && is2x1;
};

/**
 * ¿Es un clip-on? No es un anteojo completo: se engancha sobre otro armazón.
 * Se reconoce por el nombre/marca porque en el catálogo están cargados como
 * "Armazón de Receta", igual que el resto.
 */
export const esClipOn = (p: any): boolean => {
    if (!p) return false;
    return normalizeText(`${p.name || ''} ${p.brand || ''} ${p.model || ''}`).includes('clip');
};

/**
 * ¿A este producto se le puede tildar "entra en el 2x1"?
 *
 * Son los que se le ponen en la cara al cliente: armazones de receta y lentes
 * de sol. Solo define dónde aparece el tilde en Stock; que entre o no lo dice
 * `eligible2x1`.
 */
export const puedeEntrarEn2x1 = (p: any): boolean => {
    if (!p) return false;
    const t = normalizeText(`${p.type || ''} ${p.category || ''}`);
    // 'sol' se compara por PALABRA: "Solución de limpieza" contiene 'sol' y no
    // es algo que se le pueda regalar a nadie en un 2x1.
    const palabras = t.split(/\s+/);
    return t.includes('armazon') || t.includes('marco') || t.includes('frame') || palabras.includes('sol');
};

/**
 * ¿Este armazón puede ser el bonificado de un 2x1?
 *
 * Se decide a mano, tildando el armazón en Stock (`eligible2x1`), NUNCA por la
 * marca. Antes se deducía: "Atelier" iba gratis y cualquier otro armazón se
 * bonificaba hasta el promedio de los Atelier, así que un armazón de la tienda
 * web de $160.000 se terminaba cobrando $35.143 sin que nadie lo decidiera.
 * Sin tilde, el armazón se cobra completo.
 */
export const isFrameEligible2x1 = (p: any): boolean => {
    if (!p) return false;
    return p.eligible2x1 === true;
};

/**
 * Robust check if a product is a lens/crystal.
 */
export const isCrystal = (p: any): boolean => {
    if (!p) return false;
    const type = (p.type || '').toLowerCase();
    return p.category === 'Cristal' || type.includes('cristal');
};

/**
 * Specific exclusion for 'Mi Primer Varilux' which might have different rules.
 */
export const isMiPrimerVarilux = (p: any): boolean => {
    if (!p) return false;
    return (p.name || '').toLowerCase().includes('mi primer varilux');
};

/**
 * Detects the dedicated "Teñido" treatment product (tinting: compacto,
 * degradé o según muestra — el estilo no cambia el producto, es metadata en
 * `crystalColorType` del OrderItem). El producto real en catálogo tiene
 * category: 'Tratamiento', type: 'Tratamientos' — NO 'ADDON' (a diferencia de
 * lo que asume `needsColorSelection` en crystal-color-utils.ts).
 */
export const isTeñidoAddon = (p: any): boolean => {
    if (!p) return false;
    // El add-on de teñido se reconoce por lo que ES, no por un nombre exacto.
    //
    // La versión anterior exigía categoría 'Tratamiento' y nombre exactamente
    // "Teñido". En el catálogo real los productos se llaman "Teñido Compacto",
    // "Teñido Degradé", "Teñido según muestra" y viven en categoría Cristal, así
    // que NINGUNO entraba: el teñido de un 2x1 de multifocales se cobraba $15.000
    // por ojo cuando tenía que ir bonificado.
    //
    // Se pide que el nombre EMPIECE con teñido: alcanza para las variantes y
    // deja afuera a los cristales que solo lo mencionan (un multifocal
    // fotocromático no es un add-on de teñido y se cobra).
    const nombre = normalizeText(p.name || '');
    return nombre === 'tenido' || nombre.startsWith('tenido ');
};

/**
 * ¿Esta LÍNEA de pedido/carrito es un teñido? Mira el producto vivo o los
 * snapshots (pedidos guardados donde el producto ya no viene poblado).
 */
export const esLineaDeTenido = (item: any): boolean =>
    !!item && isTeñidoAddon(item.product || {
        name: item.productNameSnapshot,
        category: item.productCategorySnapshot,
        type: item.productTypeSnapshot,
    });

/**
 * Agrupa las líneas de teñido en TEÑIDOS lógicos: uno por anteojo.
 *
 * El teñido nuevo es UNA sola línea (no se tiñe un ojo solo — decisión del
 * 24/8/26), pero los pedidos guardados antes lo tienen partido en dos líneas
 * OD/OI. Este helper entiende las dos formas: una línea OD se aparea con la
 * siguiente línea OI del mismo producto (y armazón compatible), y una línea
 * sin ojo es un teñido entero por sí sola.
 *
 * Devuelve grupos de ÍNDICES sobre `items`, en orden de aparición. Todo lo que
 * razona sobre "un teñido" (bonificación, sincronización de color, validación)
 * lee de acá — es la única definición de qué líneas son el mismo teñido.
 */
export function gruposDeTenido(items: any[]): number[][] {
    const grupos: number[][] = [];
    if (!Array.isArray(items)) return grupos;
    const usados = new Set<number>();
    const mismoProducto = (a: any, b: any) => {
        const idA = a?.product?.id, idB = b?.product?.id;
        if (idA && idB) return idA === idB;
        const nombreDe = (it: any) => it?.product?.name || it?.productNameSnapshot || '';
        return nombreDe(a) === nombreDe(b);
    };
    items.forEach((it, i) => {
        if (usados.has(i) || !esLineaDeTenido(it)) return;
        usados.add(i);
        const grupo = [i];
        if (it.eye === 'OD' || it.eye === 'OI') {
            const otroOjo = it.eye === 'OD' ? 'OI' : 'OD';
            const j = items.findIndex((cand, k) =>
                k > i && !usados.has(k) && esLineaDeTenido(cand) && cand.eye === otroOjo
                && mismoProducto(it, cand)
                // Un armazón asignado distinto separa los teñidos; null es
                // compatible con cualquiera (la asignación a medias del par).
                && (cand.framePosition == null || it.framePosition == null || cand.framePosition === it.framePosition));
            if (j !== -1) { usados.add(j); grupo.push(j); }
        }
        grupos.push(grupo);
    });
    return grupos;
}

/**
 * Robust check if a product is a treatment (categoría 'Tratamiento').
 */
export const isTreatment = (p: any): boolean => {
    if (!p) return false;
    return p.category === 'Tratamiento';
};

/**
 * Robust check if a product is a frame (armazón).
 */
export const isFrame = (p: any): boolean => {
    if (!p) return false;
    // Robust normalization for keyword matching
    const t = normalizeText(`${p.type || ''} ${p.category || ''}`);
    const brand = normalizeText(p.brand || '');
    
    return t.includes('armazon') || t.includes('marco') || t.includes('frame') || 
           brand.includes('atelier') || t.includes('atelier');
};

/**
 * Determines the general category key for consistent styling and logic.
 */
/**
 * Determines the general category key for consistent styling and logic.
 * Improved to check both Category (Prisma) and Type (Subcategory).
 */
export function getCategoryKey(type: string | null, category?: string | null): string {
    const p = { type, category };
    
    if (isFrame(p)) return 'Armazón';
    if (isCrystal(p)) return 'Cristal';
    if (isTreatment(p)) return 'Tratamiento';

    // Fallbacks for other specific types
    const t = normalizeText(type || '');
    if (t.includes('sol')) return 'Lente de sol';
    if (t.includes('contacto')) return 'Lente de contacto';
    if (t.includes('accesorio')) return 'Accesorio';
    if (t.includes('reloj')) return 'Reloj';
    if (t.includes('líquido') || t.includes('solución') || t.includes('liquido')) return 'Líquido / Solución';
    if (t.includes('joyeria')) return 'Joyería';
    
    return 'Otros';
}
/**
 * Safely parses a price value to a number.
 */
export const safePrice = (price: any): number => {
    if (price === null || price === undefined || isNaN(Number(price))) return 0;
    return Number(price);
};

/**
 * Arma los renglones de carrito para un cristal recién agregado (siempre entra
 * como par: OD + OI, cada ojo a la mitad del precio de lista del par).
 *
 * Si el cristal tiene el 2x1 (y no es Mi Primer Varilux), el SEGUNDO par se
 * agrega solo, sin cargo — es lo que la promo promete, así que el cotizador lo
 * pone de entrada. Cada renglón se puede editar o borrar: si el cliente no
 * quiere el segundo par, se saca de la lista y al guardar el server recobra
 * el par restante completo (recalculateCrystalPrices no regala pares sueltos).
 *
 * Usado por los DOS cotizadores (ficha y página) — un solo lugar arma esto.
 */
export const armarParesDeCristal = (product: any, prevItems: any[] = []): any[] => {
    // El TEÑIDO es uno por anteojo, no uno por ojo: no existe teñir un solo
    // cristal del par (decisión del 24/8/26). Entra como UNA línea, sin ojo,
    // al precio del par entero — antes se partía en OD/OI como un cristal y
    // cada mitad terminaba cobrando el precio del estilo COMPLETO: el teñido
    // se facturaba dos veces.
    if (isTeñidoAddon(product)) {
        return [{ product, quantity: 1, customPrice: safePrice(product?.price), uid: Date.now() }];
    }
    const sprice = safePrice(product?.price);
    const porOjo = Math.round(sprice / 2);
    const ts = Date.now();
    const par = (precio: number, esPromo: boolean, off: number) => ([
        { product, quantity: 1, customPrice: precio, eye: 'OD', isPromo: esPromo, uid: ts + off },
        { product, quantity: 1, customPrice: precio, eye: 'OI', isPromo: esPromo, uid: ts + off + 1 },
    ]);
    const es2x1 = isMultifocal2x1(product) && !isMiPrimerVarilux(product);
    if (!es2x1) return par(porOjo, false, 0);

    // ¿El carrito ya tiene un par 2x1 sin compañero? Pasa cuando borraron el
    // segundo par automático para cambiarlo por otra variante (un Transitions
    // con un Orma blanco se combinan: la promo es por PAR, no por variante).
    // En ese caso este agregado ES el segundo par — no se le suma otro gratis.
    // Los precios finales los pone recalculateCrystalPrices (cobra el par más
    // caro y regala el más barato), acá solo importa cuántos renglones entran.
    const pares2x1Existentes = prevItems.filter(it =>
        it?.eye === 'OD' && isCrystal(it.product) && isMultifocal2x1(it.product) && !isMiPrimerVarilux(it.product)
    ).length;
    if (pares2x1Existentes % 2 !== 0) return par(0, true, 0);

    return [...par(porOjo, false, 0), ...par(0, true, 2)];
};

/**
 * Etiqueta de la bonificación para TODAS las pantallas (carrito, venta, PDF).
 * Un solo lugar decide cómo se lee: si mañana cambia el texto, cambia acá.
 */
export const etiquetaBonificacion2x1 = (mode: 'GRATIS' | 'MITAD' | null | undefined): string =>
    mode === 'MITAD' ? '50% OFF · 2x1' : 'SIN CARGO · 2x1';

/**
 * Deduce el modo desde una venta GUARDADA, sin recalcular: el nombre de la
 * promo persistido lleva "(50%)" cuando fue mitad. Para todo lo demás, gratis.
 */
export const modoBonificacionGuardada = (appliedPromoName?: string | null): 'GRATIS' | 'MITAD' =>
    appliedPromoName?.includes('(50%)') ? 'MITAD' : 'GRATIS';

/**
 * ── Regla canónica del 2x1 de multifocales ──────────────────────────────────
 * Los DOS lugares que mueven plata con esta promo (PricingService para totales
 * y recalculateCrystalPrices para los cristales) leen de acá. Si la regla
 * cambia, se toca este archivo y nada más.
 */

/**
 * ¿La venta tiene la promo 2x1 activa? La enciende un CRISTAL con el 2x1
 * tildado (o detectado por nombre, legacy), excluyendo Mi Primer Varilux.
 * Los armazones nunca la encienden: solo pueden ser el bonificado.
 */
export const contarPares2x1 = (items: any[]): number => {
    if (!Array.isArray(items)) return 0;
    // Un par = OD + OI del mismo cristal 2x1. Un ítem sin ojo asignado ya ES
    // un par (los cristales se venden POR PAR y así llegan cuando el server
    // recalcula: sus selects no traen `eye`).
    let pares = 0;
    const ojos: Record<string, { od: number; oi: number }> = {};
    for (const it of items) {
        if (!it || !isCrystal(it.product) || !isMultifocal2x1(it.product) || isMiPrimerVarilux(it.product)) continue;
        const cant = it.quantity || 1;
        if (it.eye !== 'OD' && it.eye !== 'OI') { pares += cant; continue; }
        const pid = it.product?.id || 'unknown';
        ojos[pid] = ojos[pid] || { od: 0, oi: 0 };
        if (it.eye === 'OD') ojos[pid].od += cant;
        else ojos[pid].oi += cant;
    }
    for (const p of Object.values(ojos)) pares += Math.min(p.od, p.oi);
    return pares;
};

export const hasActive2x1Promo = (items: any[]): boolean => {
    if (!Array.isArray(items)) return false;
    // La promo pide el PAR completo: un solo ojo (reposición de un cristal
    // roto, caso real) no es un 2x1 y no puede bonificar ningún armazón.
    // Un ítem sin ojo asignado cuenta como par: los cristales se venden POR PAR
    // y así llegan cuando el server recalcula (sus selects no traen `eye`).
    const ojos: Record<string, { od: boolean; oi: boolean }> = {};
    for (const it of items) {
        if (!it || !isCrystal(it.product) || !isMultifocal2x1(it.product) || isMiPrimerVarilux(it.product)) continue;
        if (it.eye !== 'OD' && it.eye !== 'OI') return true; // sin ojo = par entero
        const pid = it.product?.id || 'unknown';
        ojos[pid] = ojos[pid] || { od: false, oi: false };
        if (it.eye === 'OD') ojos[pid].od = true;
        else ojos[pid].oi = true;
        if (ojos[pid].od && ojos[pid].oi) return true;
    }
    return false;
};

/**
 * Elige el armazón bonificado de un 2x1 y devuelve cuánto descontar.
 *
 * Regla completa (confirmada por Ishtar el 22/8/26):
 *  - Solo corre si `hasActive2x1Promo` (la valida acá adentro: ningún llamador
 *    puede saltearla por olvido).
 *  - Candidatos: armazones, y cualquier producto tildado a mano (`eligible2x1`)
 *    aunque su categoría no diga "armazón" (lentes de sol).
 *  - La cantidad expande: 2 unidades del mismo armazón son 2 candidatos.
 *  - DOS O MÁS tildados: el más caro de la venta se cobra siempre; el
 *    bonificado es el más caro de los siguientes que esté tildado, y va sin
 *    cargo ENTERO — sin topes ni promedios escondidos.
 *  - UN SOLO tildado: queda al 50%, sea el caro o el barato. Vale igual si es
 *    el ÚNICO armazón de la venta (el otro es del cliente) o si lo acompaña
 *    un armazón sin promo. Ni gratis ni entero: mitad.
 *  - Sin tildados: no se descuenta nada — un armazón fuera de la promo se
 *    cobra completo aunque haya cristales 2x1.
 *  - Con UN SOLO par de cristales: tampoco. El cliente no se está llevando el
 *    2x1, así que el armazón va entero.
 *  - Un CLIP-ON que es el ÚNICO armazón de la venta va entero: el otro anteojo
 *    lo arma el cliente con el suyo y el clip-on se engancha sobre ese mismo.
 *    Con otro armazón de la óptica al lado (entre o no en la promo) sí se
 *    bonifica.
 *
 * Acepta ítems con `price` (ventas guardadas) o `customPrice` (cotizador).
 */
export const pick2x1FrameDiscount = (
    items: any[]
): { discount: number; itemName: string | null; item: any | null; mode: 'GRATIS' | 'MITAD' | null } => {
    const nada = { discount: 0, itemName: null, item: null, mode: null as null };
    if (!hasActive2x1Promo(items)) return nada;

    // El armazón bonificado es la contraparte del 2x1: si el cliente se lleva
    // UN SOLO par de cristales, no está usando la promo y el armazón se cobra
    // entero — ni gratis ni al 50%. El 50% es para cuando SÍ se lleva los dos
    // pares y el segundo armazón lo pone él. (Ishtar, 24/8/26.)
    if (contarPares2x1(items) < 2) return nada;

    const precioDe = (it: any) => safePrice(it.customPrice !== undefined ? it.customPrice : it.price);
    const nombreDe = (it: any) => `${it.product?.brand || ''} ${it.product?.name || 'Armazón'}`.trim();

    const candidatos = (items || []).flatMap(it => {
        if (!it || (!isFrame(it.product) && !isFrameEligible2x1(it.product))) return [];
        // Tope defensivo: la cantidad viene del cliente y acá dimensiona un array.
        return Array.from({ length: Math.min(it.quantity || 1, 100) }).map(() => it);
    });

    const tildados = candidatos.filter(it => isFrameEligible2x1(it.product));

    // UN SOLO tildado → 50% off. Cubre las dos ventas reales: "traigo mi
    // armazón y compro uno" (un solo armazón en la venta) y la mezcla con un
    // armazón que no entra en la promo.
    if (tildados.length === 1) {
        const tildado = tildados[0];
        // Un CLIP-ON que es el ÚNICO armazón de la venta se cobra entero: el
        // otro anteojo lo arma el cliente con su propio armazón, y el clip-on
        // se engancha sobre ese mismo — no es un segundo anteojo.
        // Si en cambio la venta lleva OTRO armazón de la óptica (aunque ese no
        // entre en la promo), el clip-on sí va al 50%. (Ishtar, 24/8/26.)
        if (esClipOn(tildado.product) && candidatos.length === 1) return nada;
        return { discount: Math.round(precioDe(tildado) / 2), itemName: `${nombreDe(tildado)} (50%)`, item: tildado, mode: 'MITAD' as const };
    }

    // Dos o más tildados: el más caro de la venta se cobra, el mejor de los
    // siguientes tildados va gratis entero.
    const ordenados = [...candidatos].sort((a, b) => precioDe(b) - precioDe(a));
    const bonificado = ordenados.slice(1).find(it => isFrameEligible2x1(it.product));
    if (!bonificado) return nada;

    return { discount: precioDe(bonificado), itemName: nombreDe(bonificado), item: bonificado, mode: 'GRATIS' as const };
};



/**
 * Recalculates the prices of crystal items based on 2x1 promo rules.
 * Mutates the items in-place (updating item.customPrice / item.price and item.isPromo).
 * Returns true if any prices or flags were modified, false otherwise.
 */
export function recalculateCrystalPrices(items: any[]): boolean {
    if (!items || items.length === 0) return false;
    let modified = false;

    // 1. Gather all crystal items. El teñido NO entra: aunque en el catálogo
    // viva como categoría Cristal, su precio lo pone applyTeñidoPromoDiscount
    // (por teñido entero, no por ojo) — pasarlo por acá lo partía a la mitad.
    const crystalItems = items.filter(i => isCrystal(i.product) && !isTeñidoAddon(i.product));

    // For any crystal that is NOT a 2x1 multifocal, its price should be sprice / 2
    const regularCrystals = crystalItems.filter(i => !isMultifocal2x1(i.product) || isMiPrimerVarilux(i.product));
    for (const item of regularCrystals) {
        const expectedPrice = Math.round(safePrice(item.product?.price) / 2);
        const currentPrice = item.customPrice !== undefined ? item.customPrice : item.price;
        if (currentPrice !== expectedPrice) {
            if (item.customPrice !== undefined) item.customPrice = expectedPrice;
            else item.price = expectedPrice;
            modified = true;
        }
        if (item.isPromo !== false) {
            item.isPromo = false;
            modified = true;
        }
    }

    // 2. Process 2x1 Multifocal crystals
    const promoCrystals = crystalItems.filter(i => isMultifocal2x1(i.product) && !isMiPrimerVarilux(i.product));

    // To resolve the Product-ID Coupling Bug, we pair up ALL 2x1 multifocal crystals together.
    // Group them by product ID first to make pairs of the same model.
    const groupedByProduct: Record<string, { od: any[], oi: any[] }> = {};
    for (const item of promoCrystals) {
        const pId = item.product?.id || 'unknown';
        if (!groupedByProduct[pId]) {
            groupedByProduct[pId] = { od: [], oi: [] };
        }
        if (item.eye === 'OD') {
            groupedByProduct[pId].od.push(item);
        } else if (item.eye === 'OI') {
            groupedByProduct[pId].oi.push(item);
        } else {
            // Unspecified eye? Treat as standard price
            const expectedPrice = Math.round(safePrice(item.product?.price) / 2);
            const currentPrice = item.customPrice !== undefined ? item.customPrice : item.price;
            if (currentPrice !== expectedPrice) {
                if (item.customPrice !== undefined) item.customPrice = expectedPrice;
                else item.price = expectedPrice;
                modified = true;
            }
            if (item.isPromo !== false) {
                item.isPromo = false;
                modified = true;
            }
        }
    }

    // Form pairs
    interface CrystalPair {
        productId: string;
        price: number;
        od: any;
        oi: any;
    }
    const pairs: CrystalPair[] = [];
    const unmatched: any[] = [];

    for (const [pId, lists] of Object.entries(groupedByProduct)) {
        const minLen = Math.min(lists.od.length, lists.oi.length);
        for (let idx = 0; idx < minLen; idx++) {
            const od = lists.od[idx];
            const oi = lists.oi[idx];
            pairs.push({
                productId: pId,
                price: safePrice(od.product?.price),
                od,
                oi
            });
        }
        // Add unmatched to unmatched list
        if (lists.od.length > minLen) {
            unmatched.push(...lists.od.slice(minLen));
        }
        if (lists.oi.length > minLen) {
            unmatched.push(...lists.oi.slice(minLen));
        }
    }

    // Sort pairs by price descending so the CHEAPEST pairs are free!
    pairs.sort((a, b) => b.price - a.price);

    // Apply 2x1 pricing:
    // First pair (index 0) -> paid (each eye gets Math.round(price / 2))
    // Second pair (index 1) -> free (each eye gets 0, isPromo = true)
    // Third pair (index 2) -> paid
    // Fourth pair (index 3) -> free
    // etc.
    pairs.forEach((pair, pairIdx) => {
        const isFree = pairIdx % 2 !== 0;
        const expectedPrice = isFree ? 0 : Math.round(pair.price / 2);

        // Update OD
        const odPrice = pair.od.customPrice !== undefined ? pair.od.customPrice : pair.od.price;
        if (odPrice !== expectedPrice) {
            if (pair.od.customPrice !== undefined) pair.od.customPrice = expectedPrice;
            else pair.od.price = expectedPrice;
            modified = true;
        }
        if (pair.od.isPromo !== isFree) {
            pair.od.isPromo = isFree;
            modified = true;
        }

        // Update OI
        const oiPrice = pair.oi.customPrice !== undefined ? pair.oi.customPrice : pair.oi.price;
        if (oiPrice !== expectedPrice) {
            if (pair.oi.customPrice !== undefined) pair.oi.customPrice = expectedPrice;
            else pair.oi.price = expectedPrice;
            modified = true;
        }
        if (pair.oi.isPromo !== isFree) {
            pair.oi.isPromo = isFree;
            modified = true;
        }
    });

    // Unmatched eyes are charged full price (sprice / 2) and are not promo
    unmatched.forEach(item => {
        const expectedPrice = Math.round(safePrice(item.product?.price) / 2);
        const currentPrice = item.customPrice !== undefined ? item.customPrice : item.price;
        if (currentPrice !== expectedPrice) {
            if (item.customPrice !== undefined) item.customPrice = expectedPrice;
            else item.price = expectedPrice;
            modified = true;
        }
        if (item.isPromo !== false) {
            item.isPromo = false;
            modified = true;
        }
    });

    return modified;
}

/**
 * Bonifica el tratamiento de Teñido (compacto, degradé o según muestra — son
 * estilos del mismo producto "Teñido") cuando la orden tiene la promo 2x1
 * multifocal activa Y el Teñido es el ÚNICO tratamiento agregado. Si hay
 * cualquier otro ítem de categoría 'Tratamiento' además del Teñido, no se
 * bonifica.
 *
 * Cuando NO es elegible para la bonificación, el precio se resuelve por
 * ESTILO (item.crystalColorType → COMPACTO/MUESTRA/DEGRADE) usando
 * `tintStylePrices` (cargado en Stock → Paleta de Colores). Si el estilo no
 * tiene precio cargado, o el ítem todavía no tiene estilo elegido, cae al
 * precio de lista del producto "Teñido".
 *
 * Mutates the items in-place (updating item.customPrice / item.price and item.isPromo).
 * Returns true if any prices or flags were modified, false otherwise.
 */
export function applyTeñidoPromoDiscount(items: any[], tintStylePrices?: Record<string, number>): boolean {
    if (!items || items.length === 0) return false;

    // Los teñidos LÓGICOS (uno por anteojo), no las líneas sueltas: los pedidos
    // viejos tienen el teñido partido en dos líneas OD/OI y las dos son EL MISMO
    // teñido — cobrarlas por separado lo facturaba dos veces.
    const grupos = gruposDeTenido(items);
    if (grupos.length === 0) return false;

    const hasMultifocalPromo = hasActive2x1Promo(items);
    // "Solo ese tratamiento": ningún OTRO tratamiento además del teñido.
    //
    // Antes se comparaban cantidades (`treatmentItems.length === teñidoItems.length`),
    // lo que daba falso apenas el teñido dejaba de ser categoría Tratamiento —
    // 0 tratamientos contra 2 teñidos no es igual, y la promo no se aplicaba.
    // Lo que importa es si hay otro tratamiento, no cuántos.
    const otrosTratamientos = items.filter(i => isTreatment(i.product) && !isTeñidoAddon(i.product));
    const promoActiva = hasMultifocalPromo && otrosTratamientos.length === 0;

    let modified = false;
    const setLinea = (item: any, precio: number, promo: boolean) => {
        const actual = item.customPrice !== undefined ? item.customPrice : item.price;
        if (actual !== precio) {
            if (item.customPrice !== undefined) item.customPrice = precio;
            else item.price = precio;
            modified = true;
        }
        if (item.isPromo !== promo) {
            item.isPromo = promo;
            modified = true;
        }
    };

    grupos.forEach((grupo, gi) => {
        // Con la promo 2x1 se bonifica UN SOLO teñido (el primero cargado, que
        // es el del 1º armazón): el del segundo anteojo se le cobra al cliente
        // (Ishtar, 24/8/26). Antes se regalaban TODOS los teñidos del pedido.
        const bonificado = promoActiva && gi === 0;
        const primera = items[grupo[0]];
        const stylePrice = primera.crystalColorType ? tintStylePrices?.[primera.crystalColorType] : undefined;
        // El precio es POR TEÑIDO (el par de cristales de un anteojo): si el
        // teñido está partido en dos líneas viejas, se reparte entre ellas.
        // Sin precio de estilo ni producto poblado (producto borrado del
        // catálogo), se conserva lo que la venta ya cobraba — nunca poner $0
        // por no saber el precio.
        const totalActual = grupo.reduce((s, idx) => {
            const it = items[idx];
            return s + safePrice(it.customPrice !== undefined ? it.customPrice : it.price) * (it.quantity || 1);
        }, 0);
        const totalGrupo = bonificado ? 0 : (stylePrice ?? (primera.product ? safePrice(primera.product.price) : totalActual));
        const porLinea = Math.round(totalGrupo / grupo.length);
        grupo.forEach((idx, k) => {
            const precio = k === 0 ? totalGrupo - porLinea * (grupo.length - 1) : porLinea;
            setLinea(items[idx], precio, bonificado);
        });
    });

    return modified;
}
