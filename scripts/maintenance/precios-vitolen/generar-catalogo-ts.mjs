/**
 * Genera `src/services/lab-modules/vitolen/catalogo.ts` a partir de la lista
 * L96 (hoya-pentax-L96-sep-2026.json): para cada cristal cargado en el sistema,
 * su código de producto en el portal de Vitolen, su diseño y su material.
 *
 * Se GENERA, no se copia a mano: los nombres salen de `armarFichas`, la misma
 * función del cargador, así el módulo de carga encuentra cada cristal por el
 * nombre exacto con el que está en la base. `npm run check:lab-modulos`
 * verifica que el archivo generado coincida con la lista.
 *
 *   node scripts/maintenance/precios-vitolen/generar-catalogo-ts.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { leerLista, armarFichas } from './subir-catalogo-vitolen.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DESTINO = path.resolve(AQUI, '../../../src/services/lab-modules/vitolen/catalogo.ts');

/** Cómo se llama cada línea en el portal (los logos de la pantalla de carga). */
const DISENO_EN_PORTAL = {
    'lifestyle-4': 'iD LifeStyle 4',
    'array-2': 'Array 2',
    'summit': 'Summit Premium',
    'argos': 'Argos BKS',
    'mph-array-2': 'Mi Primer Hoya (Array 2)',
    'mph-summit': 'Mi Primer Hoya (Summit)',
    'tact': 'Tact BKS',
    'nulux': 'Nulux Identity V+',
    'sync-iii': 'Sync III',
    'vision-simple-sin-ar': 'Visión Simple Digital',
    'vision-simple-con-ar': 'Visión Simple Digital',
    'terminado-hoya': 'Monofocal Terminado Hoya',
    'terminado-pentax': 'Monofocal Terminado Pentax',
    'allfocus-pro': 'Pentax Allfocus Pro',
    'allfocus-flex': 'Pentax Allfocus Flex',
    'pentax-office': 'Pentax Office',
};

export function armarCatalogo(lista) {
    // El calibrado y el IVA no importan acá: solo se usan nombres y códigos.
    const { fichas } = armarFichas(lista, { calibrado: 0, iva: 0 });
    const lineaDe = new Map(lista.lineas.map(l => [l.clave, l]));
    return fichas.map(f => {
        const linea = lineaDe.get(f.linea);
        const codigos = String(f.codigos || '').split(' / ').map(s => s.trim()).filter(Boolean);
        return {
            nombre: f.name,
            linea: f.linea,
            diseno: DISENO_EN_PORTAL[f.linea] || linea.modelo,
            tipo: f.type,
            material: f.name.split(' - ')[1]?.replace(/ — .*$/, '') || '',
            indice: f.lensIndex,
            // Un código por variante (Urban/Indoor/Outdoor, Tact 40/60, Sync 5/9/13,
            // Office DP40/SP60); "10154/56" son colores de un mismo código.
            codigos,
            variantes: linea.variantes ? linea.variantes.split(' / ').map(s => s.trim().replace(/\s*\(.*\)$/, '')) : [],
            sinAntirreflejo: /SIN ANTIRREFLEJO/.test(f.name),
        };
    });
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
    const lista = leerLista();
    const catalogo = armarCatalogo(lista);
    const cuerpo = `// GENERADO por scripts/maintenance/precios-vitolen/generar-catalogo-ts.mjs
// a partir de ${path.basename(lista.fuente)} (lista ${lista.lista}). NO editar a mano:
// regenerar con \`node scripts/maintenance/precios-vitolen/generar-catalogo-ts.mjs\`.
//
// Cada cristal de Vitolen cargado en el sistema, con su código de producto en
// el portal, para que la carga asistida encuentre el material por el nombre
// exacto del producto.

export interface CristalVitolen {
    nombre: string;
    linea: string;
    diseno: string;
    tipo: string;
    material: string;
    indice: string;
    codigos: string[];
    variantes: string[];
    sinAntirreflejo: boolean;
}

export const LISTA_VITOLEN = ${JSON.stringify(lista.lista)};

export const CATALOGO_VITOLEN: CristalVitolen[] = ${JSON.stringify(catalogo, null, 4)};

export function cristalVitolenPorNombre(nombre: string | null | undefined): CristalVitolen | null {
    const n = String(nombre || '').trim().toUpperCase();
    if (!n) return null;
    return CATALOGO_VITOLEN.find(c => c.nombre.toUpperCase() === n) ?? null;
}
`;
    writeFileSync(DESTINO, cuerpo);
    console.log(`${catalogo.length} cristales → ${path.relative(process.cwd(), DESTINO)}`);
}
