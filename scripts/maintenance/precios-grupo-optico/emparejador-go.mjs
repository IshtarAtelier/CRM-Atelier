/**
 * LA EQUIVALENCIA entre un cristal del CRM y su renglón en la lista de GRUPO
 * ÓPTICO. Mismo rol que emparejador.mjs para Optovisión, pero módulo aparte:
 * la lista de Grupo Óptico tiene otra forma (secciones por tipo de lente, no
 * diseños con columnas de tratamiento) y mezclarlas haría un solo archivo que
 * nadie entiende.
 *
 * DEVUELVE EL PELADO, NO EL COSTO FINAL. El costo final necesita el calibrado,
 * y en Grupo Óptico el calibrado depende del material, de si es stock o
 * laboratorio y del tipo de montaje (15 valores distintos). Ese dato es de la
 * VENTA, no del producto, así que acá no se decide: se devuelve `lista` y quien
 * quiera el costo final le suma el calibrado que corresponda.
 *
 * NO HAY IVA. Verificado el 31/8/2026 contra las 377 facturas cruzadas en
 * LabCostEntry: en todas billedTotal == billedNet, ratio 1.0000. Confirmado
 * además por Ishtar. Por eso `LaboratoryConfig` tiene iva = 0 y está bien.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aquí = dirname(fileURLToPath(import.meta.url));
export const datos = JSON.parse(readFileSync(join(aquí, 'grupo-optico-agosto-2026.json'), 'utf8'));

const norm = s => String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // saca tildes
    .toLowerCase().replace(/\s+/g, ' ').trim();

/** ¿El nombre pide el antirreflejo Essential? */
const pideEssential = n => /essential/i.test(n);

/** El índice que dice el nombre (o el campo del producto). */
function indiceDe(nombre, lensIndex) {
    const m = norm(nombre).match(/1[.,](\d{2,3})/);
    if (m) return `1.${m[1]}`;
    return lensIndex ? String(lensIndex) : null;
}

/**
 * El MATERIAL, en el vocabulario de la lista. El orden importa: "super blue"
 * tiene que ganarle a "blue", y "fotocromatico blue" a los dos.
 */
const MATERIALES = [
    [/foto\w*\s+blue\s+light\s+grey|foto\w*\s+blue\s+light\s+gris/, 'Fotocromático Blue Light Grey'],
    [/foto\w*\s+blue/, 'Fotocromático BLUE'],
    [/foto\w*\s+smart\s*color/, 'Fotocromático Smart Color'],
    [/foto\w*\s+espejado/, 'Fotocromático Espejado'],
    [/foto\w*\s+grey\s+alto|foto\w*\s+gris\s+alto/, 'Fotocromático Grey Alto Índice'],
    [/foto\w*/, 'Fotocromático Gris'],
    [/anti\s*age/, 'Anti Age Blue Light'],
    [/super\s*blue/, 'Super Blue Light'],
    [/blue\s*light|blue\b/, 'Blue Light'],
    [/gris\s*3\s*espejado|espejado/, 'Gris 3 Espejado'],
    [/polarizado/, 'Polarizado'],
    [/policarbonato|poli\b/, 'Policarbonato'],
    [/stylis/, 'Stylis'],
    [/mineral/, 'Mineral'],
    [/blanco|organico/, 'Blanco'],
];
const materialDe = nombre => MATERIALES.find(([re]) => re.test(norm(nombre)))?.[1] ?? null;

/** ¿La fila de la lista habla del mismo material? Se compara por tokens. */
function mismaFamilia(material, textoFila) {
    const t = norm(textoFila);
    switch (material) {
        case 'Fotocromático Blue Light Grey': return /foto/.test(t) && /blue/.test(t) && /(grey|gris)/.test(t);
        case 'Fotocromático BLUE': return /foto/.test(t) && /blue/.test(t);
        case 'Fotocromático Smart Color': return /foto/.test(t) && /smart\s*color/.test(t);
        case 'Fotocromático Espejado': return /foto/.test(t) && /espejado/.test(t);
        case 'Fotocromático Grey Alto Índice': return /foto/.test(t) && /alto/.test(t);
        case 'Fotocromático Gris': return /foto/.test(t) && !/blue|smart|espejado/.test(t);
        case 'Anti Age Blue Light': return /anti\s*age/.test(t);
        case 'Super Blue Light': return /super\s*blue/.test(t);
        case 'Blue Light': return /blue/.test(t) && !/super|anti\s*age|foto/.test(t);
        case 'Gris 3 Espejado': return /gris\s*3|espejado/.test(t) && !/foto/.test(t);
        case 'Polarizado': return /polarizado/.test(t);
        case 'Policarbonato': return /policarbonato/.test(t);
        case 'Stylis': return /stylis/.test(t);
        case 'Mineral': return /mineral/.test(t);
        case 'Blanco': return /blanco/.test(t) && !/blue|foto|polarizado|espejado/.test(t);
        default: return false;
    }
}

/** Busca en una lista de filas la que coincide en material, índice y AR. */
function buscar(filas, { material, indice, essential }, campoPrecio) {
    const candidatas = filas.filter(f => {
        if (f[campoPrecio] == null) return false;
        if (!mismaFamilia(material, `${f.producto} ${f.grupo || ''}`)) return false;
        if (indice && f.indice && String(f.indice) !== String(indice)) return false;
        return true;
    });
    if (!candidatas.length) return null;
    // Con y sin Essential comparten material e índice: decide el nombre.
    const porAr = candidatas.filter(f => essential ? f.ar === 'ESSENTIAL' : f.ar !== 'ESSENTIAL');
    return (porAr[0] ?? candidatas[0]);
}

/** Las SECCIONES de la lista, cada una con cómo se reconoce y de dónde saca el precio. */
const SECCIONES = [
    {
        nombre: 'Bifocal digital invisible (Kriptock Invisible)',
        test: n => /kriptock\s*invisible|invisible\s*kriptock/i.test(n),
        filas: () => datos.ocupacional_y_digitales.kriptock_invisible.filas,
        precio: 'precio',
        add: () => datos.ocupacional_y_digitales.kriptock_invisible.add,
    },
    {
        nombre: 'Multifocal Smart Lens FREE',
        test: n => /smart\s*free|multifocal\s*free/i.test(n),
        filas: () => datos.multifocales.filas, precio: 'free', add: () => [0.75, 3.5],
    },
    {
        nombre: 'Multifocal Smart Lens NEW',
        test: n => /multifocal\s*new/i.test(n),
        filas: () => datos.multifocales.filas, precio: 'new', add: () => [0.75, 3.5],
    },
    {
        nombre: 'Multifocal Smart Lens ONE',
        test: n => /multifocal\s*one/i.test(n),
        filas: () => datos.multifocales.filas, precio: 'one', add: () => [0.75, 3.5],
    },
    {
        nombre: 'Control de miopía Smart MyoFix',
        test: n => /myofix/i.test(n),
        filas: () => datos.control_miopia.filas, precio: 'myofix',
    },
    {
        nombre: 'Control de miopía Smart MyoLens',
        test: n => /myolens/i.test(n),
        filas: () => datos.control_miopia.filas, precio: 'myolens',
    },
    {
        nombre: 'Ocupacional Office',
        test: n => /ocupacional|office/i.test(n),
        filas: () => datos.ocupacional_y_digitales.office.filas, precio: 'precio',
    },
    {
        nombre: 'Ultra Relax (monofocal digital)',
        test: n => /ultra\s*relax/i.test(n),
        filas: () => datos.ocupacional_y_digitales.ultra_relax.filas, precio: 'precio',
    },
    {
        nombre: 'Bifocal Flat Top / Kriptock',
        test: n => /flat\s*top|kriptock/i.test(n),
        filas: () => datos.bifocales.filas, precio: 'cnc',
    },
    {
        nombre: 'Lente de stock / rango extendido',
        test: (n, p) => p?.origin === 'STOCK' || /stock|rango\s*extendido/i.test(n),
        filas: () => datos.stock_y_rango_extendido.filas, precio: 'precio',
        // Stock y Rango Extendido comparten material: el nombre dice cuál.
        filtroExtra: (f, n) => /rango\s*extendido/i.test(n)
            ? f.disponibilidad === 'RANGO EXTENDIDO' : f.disponibilidad === 'STOCK',
    },
    {
        nombre: 'Monofocal de laboratorio (CNC)',
        test: () => true,   // el resto: monofocales tallados
        filas: () => datos.monofocal_laboratorio.filas, precio: 'cnc',
    },
];

/**
 * Reparte los productos en emparejados / sin resolver.
 * Cada emparejado trae `lista` (el PELADO, sin calibrado ni IVA) y los rangos.
 */
export function emparejar(productos) {
    const ok = [], sinResolver = [];
    for (const p of productos) {
        const nombre = String(p.name || '');
        if (/^\s*\[archivado\]/i.test(nombre)) {
            sinResolver.push({ ...p, motivo: 'Producto archivado: no se costea' });
            continue;
        }
        const material = materialDe(nombre);
        if (!material) { sinResolver.push({ ...p, motivo: 'No se reconoce el material' }); continue; }

        const indice = indiceDe(nombre, p.lensIndex);
        const essential = pideEssential(nombre);
        const sec = SECCIONES.find(s => s.test(nombre, p));

        let filas = sec.filas();
        if (sec.filtroExtra) filas = filas.filter(f => sec.filtroExtra(f, nombre));
        const fila = buscar(filas, { material, indice, essential }, sec.precio);

        if (!fila) {
            sinResolver.push({ ...p, seccion: sec.nombre, material, indice, essential,
                motivo: `La sección "${sec.nombre}" no ofrece ${material}${indice ? ` en ${indice}` : ''}${essential ? ' con Essential' : ''}` });
            continue;
        }

        ok.push({
            ...p,
            seccion: sec.nombre, material, indice, essential,
            renglon: `${fila.producto}${fila.ar ? ` (${fila.ar})` : ''}`,
            lista: fila[sec.precio],
            esf: fila.esf ?? null,
            cil: fila.cil ?? null,
            add: fila.add ?? (sec.add ? sec.add() : null),
        });
    }
    return { ok, sinResolver };
}
