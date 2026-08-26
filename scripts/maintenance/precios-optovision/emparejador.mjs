/**
 * LA EQUIVALENCIA entre un cristal del CRM y su renglón en la lista de
 * Optovisión. Vive en UN solo lugar a propósito: lo usan el informe
 * (emparejar-costos.mjs) y el que escribe los costos (sincronizar-costos.mjs),
 * y si cada uno tuviera su copia de las reglas, un día divergen y el informe
 * dice una cosa mientras la base guarda otra.
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
    [/new\s*editions?/i, 'Essilor New Editions (packs 2x1)', null],
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

function tratamientoDe(nombre, precios) {
    const cual = /prevencia/i.test(nombre) ? 'CRIZAL PREVENCIA'
        : /sapphire|saphire/i.test(nombre) ? 'CRIZAL SAPPHIRE'
            : /tr[íi]o|easy\s*clean/i.test(nombre) ? 'TRIO EASY CLEAN'
                : /sin\s*ar|no\s*reflex/i.test(nombre) ? 'SIN AR'
                    : /crizal|rock/i.test(nombre) ? 'CRIZAL FORTE UV'
                        : null;
    if (cual && precios[cual] != null) return { trat: cual, seguro: true };
    if (cual) return { trat: cual, seguro: false, noOfrecido: true };
    return { trat: 'CRIZAL FORTE UV', seguro: false };
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

    const trat = /prevencia/i.test(nombre) ? 'CRIZAL PREVENCIA'
        : /sapphire|saphire/i.test(nombre) ? 'CRIZAL SAPPHIRE'
            : /tr[íi]o|easy\s*clean/i.test(nombre) ? 'TRIO EASY CLEAN'
                : /sin\s*crizal|sin\s*ar/i.test(nombre) ? null
                    : /crizal/i.test(nombre) ? 'CRIZAL FORTE UV' : null;
    const extra = trat ? (m.tratamientos_sueltos.find(t => t.nombre.replace(' UV', '') === trat.replace(' UV', '')
        || t.nombre === trat)?.precio ?? 0) : 0;

    return {
        familia, material: fila.material,
        tratamiento: trat ? `${trat} (sumado aparte)` : 'sin antirreflejo',
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
            const mono = faltaConocida ? null : emparejarMonofocal(nombre);
            if (mono) {
                const nuevo = costoDe(mono.lista);
                ok.push({ ...p, ...mono, esPromo: false, costoNuevo: nuevo,
                    listaVieja: p.cost > 0 ? listaDe(p.cost) : null,
                    pct: p.cost > 0 ? (nuevo - p.cost) / p.cost * 100 : null });
                continue;
            }
            const falta = faltaConocida;
            sinLista.push({ ...p, familia: falta ? falta[1] : null, pagina: falta ? falta[2] : null,
                motivo: falta ? 'La familia todavía no está cargada de la lista' : 'No se reconoce la familia' });
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
        const lista = (m.precios[t.trat] ?? 0) / (esPromo ? 2 : 1);
        const nuevo = costoDe(lista);
        ok.push({ ...p, familia: fam[1], material: mat[1], tratamiento: t.trat, seguro: t.seguro, esPromo,
            lista, costoNuevo: nuevo, listaVieja: p.cost > 0 ? listaDe(p.cost) : null,
            pct: p.cost > 0 ? (nuevo - p.cost) / p.cost * 100 : null });
    }
    return { ok, porNombre, sinLista };
}
