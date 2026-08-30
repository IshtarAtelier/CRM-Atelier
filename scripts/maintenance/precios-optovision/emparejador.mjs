/**
 * LA EQUIVALENCIA entre un cristal del CRM y su renglón en la lista de
 * Optovisión. Vive en UN solo lugar a propósito: lo usan el informe
 * (emparejar-costos.mjs) y el que escribe los costos (sincronizar-costos.mjs),
 * y si cada uno tuviera su copia de las reglas, un día divergen y el informe
 * dice una cosa mientras la base guarda otra. Lo usan listado-costos.mjs,
 * sincronizar-costos.mjs y la auditoría (check:auditoria-costos) — NADA más
 * debe reimplementar estas reglas.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aquí = dirname(fileURLToPath(import.meta.url));
export const datos = JSON.parse(readFileSync(join(aquí, 'varilux-agosto-2026.json'), 'utf8'));

export const CALIBRADO = 23000;
export const IVA = 21;
export const MARKUP = 2.4;
export const costoDe = lista => Math.round((lista + CALIBRADO) * (1 + IVA / 100));
export const listaDe = costo => costo / (1 + IVA / 100) - CALIBRADO;

/** Familias que SÍ están transcritas, en orden de más específica a más general. */
const FAMILIAS = [
    [/kodak.*unique/i, 'Kodak Unique DRO'],
    [/kodak.*precise/i, 'Kodak Precise Next'],
    [/kodak.*softwear/i, 'Kodak Softwear'],
    [/kodak.*(sv|monofocal)/i, 'Kodak SV Digital'],
    [/xr\s*design/i, 'Varilux XR design'],
    [/xr\s*pro/i, 'Varilux XR pro'],
    [/comfort\s*max/i, 'Varilux Comfort Max'],
    [/physio\s*3\.0/i, 'Varilux Physio 3.0'],
    [/liberty\s*3\.0/i, 'Varilux Liberty 3.0'],
    [/digitime/i, 'Varilux Digitime'],
    [/comfort/i, 'Varilux Comfort'],
    [/physio/i, 'Varilux Physio'],
];

/** Familias que el CRM tiene y la lista todavía NO: se nombran para poder
 *  decir "falta cargar la página X" en vez de un "no encontrado" mudo. */
const FALTAN_EN_LISTA = [
    [/eyezen\s*kids/i, 'Eyezen Kids', 12],
    [/eyezen/i, 'Eyezen', 11],
    [/myopilux/i, 'Myopilux', 13],
    [/stellest/i, 'Stellest (control de miopía)', 13],
    [/espace\s*plus/i, 'Espace Plus Digital', 18],
    [/interview/i, 'Essilor Interview', 18],
];

const MATERIALES = [
    [/stylis.*blue\s*uv/i, 'STYLIS 1.67 BLUE UV'],
    [/airwear.*blue\s*uv/i, 'AIRWEAR 1.59 BLUE UV'],
    [/orma.*blue\s*uv/i, 'ORMA BLUE UV'],
    [/orma.*acclimates/i, 'ORMA ACCLIMATES'],
    [/stylis.*transitions/i, 'STYLIS 1.67 TRANSITIONS GEN S'],
    [/airwear.*transitions/i, 'AIRWEAR 1.59 TRANSITIONS GEN S'],
    [/orma\s*transitions\s*xtractive/i, 'ORMA TRANSITIONS XTRACTIVE'],
    [/orma.*transitions/i, 'ORMA TRANSITIONS GEN S'],
    [/airwear.*xperio/i, 'AIRWEAR 1.59 XPERIO'],
    [/orma.*xperio/i, 'ORMA XPERIO'],
    [/stylis/i, 'STYLIS 1.67'],
    [/airwear/i, 'AIRWEAR 1.59'],
    [/orma/i, 'ORMA'],
];

const primero = (tabla, texto) => tabla.find(([re]) => re.test(texto));

/**
 * POLÍTICA DEL CRIZAL MÁS CARO (Ishtar, 26/8/2026): todo cristal con Crizal se
 * costea —y se cobra— con la columna MÁS CARA de su renglón (hoy Prevencia).
 * El Crizal real que lleva el par es un dato de la VENTA (elección obligatoria
 * del vendedor, plan-crizal-obligatorio.md): si sale con uno más barato, el
 * margen solo mejora — nunca queda corto. Y el nombre del producto deja de
 * decidir plata: antes 44 de 82 quedaban imposibles de costear porque decían
 * "+ CRIZAL" sin aclarar cuál.
 * Se respetan por nombre las variantes que NO llevan Crizal: "SIN AR" /
 * "Sin Crizal" (pelado) y "Trío Easy Clean".
 */
function tratamientoDe(nombre, precios) {
    if (/sin\s*ar|no\s*reflex|sin\s*crizal/i.test(nombre)) {
        if (precios['SIN AR'] != null) return { trat: 'SIN AR', seguro: true, de: 'nombre' };
        return { trat: 'SIN AR', seguro: false, noOfrecido: true };
    }
    if (/tr[íi]o|easy\s*clean/i.test(nombre)) {
        if (precios['TRIO EASY CLEAN'] != null) return { trat: 'TRIO EASY CLEAN', seguro: true, de: 'nombre' };
        return { trat: 'TRIO EASY CLEAN', seguro: false, noOfrecido: true };
    }
    const crizales = Object.entries(precios).filter(([k]) => k.startsWith('CRIZAL'));
    if (!crizales.length) return { trat: Object.keys(precios)[0], seguro: false, de: 'renglón sin columnas Crizal' };
    const caro = crizales.sort((a, b) => b[1] - a[1])[0];
    return { trat: caro[0], seguro: true, de: 'crizal más caro (política 26/8/2026)' };
}

/**
 * Segunda pasada: los MONOFOCALES de la página 20. No son diseños progresivos,
 * así que no están en `disenos` y la primera pasada los daba por desconocidos.
 * Acá la diferencia clave es que sus precios vienen SIN antirreflejo: si el
 * nombre dice "Con Crizal X" hay que sumarle el tratamiento, y si dice "Sin
 * Crizal" o "SIN AR" el precio es el pelado.
 */
const FAMILIAS_MONO = [
    [/xtractive/i, 'Transitions XTRActive'],
    [/acclimates/i, 'Acclimates'],
    [/transitions/i, 'Transitions Gen S'],
    [/xperio/i, 'Xperio'],
    [/filter\s*system|blue\s*uv/i, 'BlueUV Filter System'],
    [/stock/i, 'Monofocal de stock'],
];

/**
 * Lentes de STOCK de la página 22: el Crizal ya viene puesto — es una lente
 * entera, no se le suma tratamiento. Se reconocen por nombre casi textual.
 * (La auditoría atrapó al "Orma Blue UV Crizal Saphire HR" costeado como
 * monofocal + tratamiento: el doble de su renglón real.)
 */
/**
 * Los "ESSILOR NEW EDITIONS + AR Numax 2x1" SON la línea Sygnus NEW EDITION
 * (págs. 23-24): los materiales coinciden uno a uno, incluidos los que solo
 * existen ahí (Orgánico Espejado, Policarbonato Polarizado, Fotosensible BLC,
 * Alto Índice 1.74). El Numax es su antirreflejo y va APARTE del precio Sin AR
 * de la lista — y el 2x1 lo incluye siempre (Ishtar, 29/8/2026).
 */
function emparejarNewEditions(nombre) {
    if (!/new\s*editions?/i.test(nombre)) return null;
    const ne = datos.sygnus?.familias.find(f => /NEW EDITION/i.test(f.familia));
    const numax = datos.sygnus?.numax ?? 0;
    if (!ne || !numax) return null;
    const REGLAS = [
        [/alto\s*[íi]ndice|1\.74/i, /Alto Índice/i],
        [/policarbonato\s*polarizado/i, /Policarbonato Polarizado/i],
        [/org[áa]nico\s*espejado/i, /^Orgánico Espejado/i],
        [/fotosensible\s*blc/i, /Fotosensible BLC/i],
        [/stylis.*transitions/i, /Stylis 1\.67 Transitions/i],
        [/stylis.*blue/i, /Stylis BLUE UV/i],
        [/stylis/i, /^Stylis 1\.67$/i],
        [/airwear.*transitions/i, /Airwear 1\.59 Transitions/i],
        [/airwear.*xperio/i, /Airwear 1\.59 Xperio/i],
        [/airwear.*blue/i, /Airwear BLUE UV/i],
        [/airwear/i, /^Airwear 1\.59$/i],
        [/orma.*transitions/i, /^Orma Transitions GEN S$/i],
        [/orma.*xperio/i, /Orma Xperio/i],
        [/orma.*acclimates/i, /Orma Acclimates/i],
        [/orma.*blue|blue\s*uv.*orma/i, /^Orma BLUE UV$/i],
        [/orma/i, /^Orma$/i],
    ];
    const regla = REGLAS.find(([enNombre]) => enNombre.test(nombre));
    const fila = regla ? ne.filas.find(f => regla[1].test(f.material)) : null;
    if (!fila) return null;
    return {
        familia: 'Sygnus NEW EDITION', material: `${fila.material} + AR Numax`,
        tratamiento: 'AR Numax (incluido en el 2x1)',
        lista: fila.precio + numax, seguro: true,
    };
}

function emparejarLenteStock(nombre) {
    const stock = datos.crizal?.lentes_de_stock || [];
    const cual = /rock/i.test(nombre) ? /ROCK/
        : /(sapphire|saphire)\s*hr/i.test(nombre) ? /SAPPHIRE HR/
            : /orma\s*crizal\s*prevencia/i.test(nombre) ? /^ORMA CRIZAL PREVENCIA$/
                : null;
    if (!cual) return null;
    const fila = stock.find(f => cual.test(f.nombre));
    if (!fila) return null;
    return {
        familia: 'Lente de stock (pág. 22)', material: fila.nombre,
        tratamiento: 'incluido (lente de stock)', lista: fila.precio,
        seguro: true, renglonStock: true,
    };
}

function emparejarMonofocal(nombre) {
    const m = datos.monofocales;
    if (!m) return null;
    const fam = primero(FAMILIAS_MONO, nombre);
    // Sin familia reconocida, el genérico "otros monofocales" se tragaba
    // CUALQUIER producto que dijera Orma/Airwear/Stylis — Eyezen y Myopilux
    // incluidos, que son diseños propios con otro precio. Solo se acepta el
    // genérico si el nombre dice que es un monofocal.
    if (!fam && !/monofocal/i.test(nombre)) return null;
    const familia = fam ? fam[1] : 'Otros monofocales de laboratorio';
    const g = m.grupos.find(x => x.familia === familia);
    if (!g) return null;

    // Material. En la página 20 hay filas de ORMA repetidas que se distinguen
    // por el rango (stock / tallado / colores); el nombre del producto usa esas
    // mismas palabras, así que se aprovechan para elegir la fila correcta.
    const mat = /stylis/i.test(nombre) ? 'STYLIS 1.67'
        : /airwear/i.test(nombre) ? 'AIRWEAR 1.59'
            : /orma/i.test(nombre) ? 'ORMA' : null;
    if (!mat) return null;
    let candidatas = g.filas.filter(f => f.material === mat || f.material === `${mat} (colores)`);
    if (candidatas.length > 1) {
        if (/\(stock\)|de\s*stock/i.test(nombre)) candidatas = candidatas.filter(f => /stock/i.test(f.rango || ''));
        else if (/colores/i.test(nombre)) candidatas = candidatas.filter(f => /colores/i.test(f.material));
        else candidatas = candidatas.filter(f => !/stock/i.test(f.rango || '') && !/colores/i.test(f.material));
    }
    const fila = candidatas[0];
    if (!fila) return null;

    // REGLA DE ISHTAR (30/8/2026): TODO monofocal DE LABORATORIO se costea con
    // el mejor Crizal sumado (Prevencia) — salvo los de stock. El "SIN AR" que
    // traen algunos nombres describe el precio de LISTA (la pág. 20 lista sin
    // AR), no el producto: el Crizal que realmente lleva es dato de la venta,
    // y el costo siempre asume el mejor. Solo el monofocal de stock queda
    // pelado (y las lentes de stock de la pág. 22, que van por otro camino).
    const sueltos = m.tratamientos_sueltos || [];
    const esStock = familia === 'Monofocal de stock' || /\(stock\)|de\s*stock/i.test(nombre);
    let trat = null, extra = 0;
    if (!esStock) {
        const caro = sueltos.filter(t => /^CRIZAL/.test(t.nombre)).sort((a, b) => b.precio - a.precio)[0];
        trat = caro ? `${caro.nombre} (mejor crizal, política 30/8)` : null;
        extra = caro?.precio ?? 0;
    }

    return {
        familia, material: fila.material,
        tratamiento: trat ? `${trat}, sumado aparte` : 'sin antirreflejo',
        lista: fila.precio + extra,
        seguro: true,
    };
}


/** Reparte los productos en emparejados / sin lista / problema de nombre. */
export function emparejar(productos) {
    const ok = [], porNombre = [], sinLista = [];
    for (const p of productos) {
        const nombre = String(p.name || '');
        const fam = primero(FAMILIAS, nombre);
        if (!fam) {
            const faltaConocida = primero(FALTAN_EN_LISTA, nombre);
            const mono = faltaConocida ? null : (emparejarNewEditions(nombre) ?? emparejarLenteStock(nombre) ?? emparejarMonofocal(nombre));
            if (mono) {
                const nuevo = costoDe(mono.lista);
                ok.push({ ...p, ...mono, esPromo: false, costoNuevo: nuevo,
                    listaVieja: p.cost > 0 ? listaDe(p.cost) : null,
                    pct: p.cost > 0 ? (nuevo - p.cost) / p.cost * 100 : null });
                continue;
            }
            sinLista.push({ ...p,
                familia: faltaConocida ? faltaConocida[1] : null,
                pagina: faltaConocida ? faltaConocida[2] : null,
                motivo: faltaConocida ? 'La familia todavía no está cargada de la lista' : 'No se reconoce la familia' });
            continue;
        }
        const d = datos.disenos.find(x => x.nombre === fam[1]);
        const mat = primero(MATERIALES, nombre);
        const m = mat ? d?.materiales.find(x => x.material === mat[1]) : null;
        if (!m) {
            porNombre.push({ ...p, familia: fam[1], material: mat?.[1] || null,
                motivo: mat ? `La familia no ofrece "${mat[1]}"` : 'No se reconoce el material' });
            continue;
        }
        const t = tratamientoDe(nombre, m.precios);
        if (t.noOfrecido) {
            porNombre.push({ ...p, familia: fam[1], material: mat[1], motivo: `La familia no ofrece "${t.trat}"` });
            continue;
        }
        const esPromo = /mi\s*primer/i.test(nombre);
        // Una celda null/0 en la lista NO es un precio: emparejar igual haría
        // que --aplicar escriba cost=$27.830 (solo calibrado) en un cristal de
        // $500.000, en silencio. Mejor que caiga a "revisar a mano".
        const celda = m.precios[t.trat];
        if (!celda || celda <= 0) {
            porNombre.push({ ...p, familia: fam[1], material: mat[1],
                motivo: `El renglón no tiene precio en ${t.trat}` });
            continue;
        }
        const lista = celda / (esPromo ? 2 : 1);
        const nuevo = costoDe(lista);
        ok.push({ ...p, familia: fam[1], material: mat[1], tratamiento: t.trat, seguro: t.seguro, esPromo,
            lista, costoNuevo: nuevo, listaVieja: p.cost > 0 ? listaDe(p.cost) : null,
            pct: p.cost > 0 ? (nuevo - p.cost) / p.cost * 100 : null });
    }
    return { ok, porNombre, sinLista };
}
