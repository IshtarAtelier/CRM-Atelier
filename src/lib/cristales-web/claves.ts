/**
 * Claves, tipos y helpers PUROS del configurador "Arma tus lentes".
 *
 * Sin base, sin red: lo importan la tienda (navegador), el checkout, los mails
 * y los checks del CI. Todo lo que necesita la base vive en
 * src/services/cristales-web.service.ts.
 *
 * LA CLAVE ES EL CONTRATO. 'MONOFOCAL.ORGANICO_AR' es la fila de WebLensOption,
 * la card del configurador y —partida en `lensType` + `treatment`— lo que ya
 * viaja en los carritos guardados en los navegadores de los visitantes
 * (localStorage 'atelier-cart-storage') y en el apareo del 2x1
 * (`treatment === 'VARILUX'`). Por eso no se renombra nunca: agregar una
 * opción es agregar una clave nueva, no cambiar una vieja.
 *
 * Ver docs/cristales-web.md.
 */
import { TONOS_TENIDO } from '@/lib/constants/tenido';

export const GRUPOS_CRISTAL = ['MONOFOCAL', 'BIFOCAL', 'MULTIFOCAL', 'TENIDO'] as const;
export type GrupoCristal = (typeof GRUPOS_CRISTAL)[number];

export const CLAVES_OPCION = [
    'MONOFOCAL.ORGANICO_BLANCO',
    'MONOFOCAL.ORGANICO_AR',
    'MONOFOCAL.ORGANICO_BLUE',
    'MONOFOCAL.POLI_BLUE',
    'MONOFOCAL.ORGANICO_FOTOCROMATICO',
    'BIFOCAL.ORGANICO_BLANCO',
    'MULTIFOCAL.SMART_FREE',
    'MULTIFOCAL.VARILUX',
    'MULTIFOCAL.FOTOCROMATICO',
    'TENIDO.COMPACTO',
    'TENIDO.DEGRADE',
] as const;
export type ClaveOpcion = (typeof CLAVES_OPCION)[number];

export function esClaveOpcion(x: unknown): x is ClaveOpcion {
    return typeof x === 'string' && (CLAVES_OPCION as readonly string[]).includes(x);
}

export function grupoDeClave(clave: ClaveOpcion): GrupoCristal {
    return clave.split('.')[0] as GrupoCristal;
}

/** Con qué `Product.type` (o categoría, para el teñido) tiene que coincidir el producto vinculado a cada grupo. */
export const PRODUCTO_ESPERADO_POR_GRUPO: Record<GrupoCristal, { category: string; type?: string; nombreEmpiezaCon?: string }> = {
    MONOFOCAL: { category: 'Cristal', type: 'Cristal Monofocal' },
    BIFOCAL: { category: 'Cristal', type: 'Cristal Bifocal' },
    MULTIFOCAL: { category: 'Cristal', type: 'Cristal Multifocal' },
    // El teñido del mostrador: "Teñido Compacto · Grupo Óptico", categoría
    // Tratamiento. Es el mismo producto que reconoce `isTeñidoAddon`.
    TENIDO: { category: 'Tratamiento', nombreEmpiezaCon: 'Teñido' },
};

export type LensType = 'MONOFOCAL' | 'BIFOCAL' | 'MULTIFOCAL' | 'NONE';

/** Los estilos de teñido que vende la web. "Según muestra" exige traer una muestra al local: no se ofrece. */
export const ESTILOS_TENIDO_WEB = ['COMPACTO', 'DEGRADE'] as const;
export type EstiloTenidoWeb = (typeof ESTILOS_TENIDO_WEB)[number];

/**
 * Lo que el configurador guarda en el ítem del carrito y el checkout recibe.
 *
 * `color` es el TONO canónico del laboratorio ('Gris', 'Sepia'…) y `tintStyle`
 * el estilo. Los carritos anteriores al 26/9/2026 traen `color: 'Gris (COMPACTO)'`
 * (estilo adentro del texto, con acento) y sin `tintStyle`: `tenidoDeConfig()`
 * los sigue entendiendo.
 */
export interface LensConfig {
    lensType: LensType | null;
    /** Código de la opción dentro del grupo ('ORGANICO_AR', 'VARILUX'…). Carritos viejos pueden traer 'UNICO' en bifocal. */
    treatment: string | null;
    color: string | null;
    tintStyle?: EstiloTenidoWeb | null;
    prescriptionFile: string | null;
    secondPair2x1?: boolean;
    /** Título comercial elegido, para que carrito y mails no impriman la clave cruda. */
    etiqueta?: string | null;
}

export type MotivoNoDisponible = 'SIN_PRODUCTO' | 'ARCHIVADO' | 'SIN_PRECIO' | 'INACTIVA';

/** Una opción tal como la publica GET /api/web/pricing (sin costo ni laboratorio). */
export interface OpcionCristalWeb {
    clave: ClaveOpcion;
    grupo: GrupoCristal;
    codigo: string;
    etiqueta: string;
    descripcion: string | null;
    badge: string | null;
    destacados: string[];
    orden: number;
    disponible: boolean;
    motivo: MotivoNoDisponible | null;
    /** Precio del PAR (o del teñido de un anteojo), de lista, del producto vinculado. Null si no está disponible. */
    precio: number | null;
    nombreProducto: string | null;
    is2x1: boolean;
    productId: string | null;
}

export type MapaOpciones = Partial<Record<ClaveOpcion, OpcionCristalWeb>>;

export function indexarOpciones<T extends { clave: ClaveOpcion }>(opciones: T[]): Partial<Record<ClaveOpcion, T>> {
    const mapa: Partial<Record<ClaveOpcion, T>> = {};
    for (const o of opciones) mapa[o.clave] = o;
    return mapa;
}

export function opcionesDelGrupo(mapa: MapaOpciones, grupo: GrupoCristal): OpcionCristalWeb[] {
    return Object.values(mapa)
        .filter((o): o is OpcionCristalWeb => !!o && o.grupo === grupo)
        .sort((a, b) => a.orden - b.orden);
}

/** Regla única de "este ítem lleva cristales" (antes copiada en nueve archivos). */
export function tieneCristales(lc: LensConfig | null | undefined): boolean {
    return !!lc && (lc.lensType !== 'NONE' || !!lc.color);
}

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Tono y estilo del teñido de una configuración, entendiendo también la forma
 * vieja del carrito ('Naranja (DEGRADÉ)'). `estilo` null = no se pudo leer.
 */
export function tenidoDeConfig(lc: LensConfig | null | undefined): { tono: string; estilo: EstiloTenidoWeb | 'MUESTRA' | null } | null {
    if (!lc?.color) return null;
    let tono = lc.color.trim();
    let estilo: EstiloTenidoWeb | 'MUESTRA' | null = lc.tintStyle ?? null;
    const viejo = tono.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    if (viejo) {
        tono = viejo[1].trim();
        if (!estilo) {
            const e = sinAcentos(viejo[2]).toUpperCase();
            estilo = e.includes('DEGRAD') ? 'DEGRADE' : e.includes('MUESTRA') ? 'MUESTRA' : e.includes('COMPACT') ? 'COMPACTO' : null;
        }
    }
    return { tono, estilo };
}

export function hexDeTono(tono: string | null | undefined): string | null {
    if (!tono) return null;
    return TONOS_TENIDO.find(t => t.name === tono)?.hexColor ?? null;
}

/**
 * Qué opción de CRISTAL corresponde a una configuración.
 *
 * Flujo de sol (hay color): el cristal base del tipo elegido (blanco, bifocal
 * o el multifocal de entrada), el color va aparte como teñido.
 * Flujo transparente: `${lensType}.${treatment}`; el bifocal tiene una sola
 * opción, así que ignora el treatment (los carritos viejos traen 'UNICO').
 *
 * Devuelve `{ clave: null }` cuando el ítem no lleva cristales, y `{ error }`
 * cuando la combinación no existe: el checkout la rechaza, nunca la adivina.
 */
export function claveDeCristal(lc: LensConfig | null | undefined): { clave: ClaveOpcion | null; error?: string } {
    if (!tieneCristales(lc)) return { clave: null };
    const { lensType, treatment, color } = lc!;
    if (color) {
        if (lensType === 'NONE' || lensType === 'MONOFOCAL' || lensType === null) return { clave: 'MONOFOCAL.ORGANICO_BLANCO' };
        if (lensType === 'BIFOCAL') return { clave: 'BIFOCAL.ORGANICO_BLANCO' };
        if (lensType === 'MULTIFOCAL') return { clave: 'MULTIFOCAL.SMART_FREE' };
    }
    if (lensType === 'BIFOCAL') return { clave: 'BIFOCAL.ORGANICO_BLANCO' };
    if (lensType === 'MONOFOCAL' || lensType === 'MULTIFOCAL') {
        const clave = `${lensType}.${treatment ?? ''}`;
        if (esClaveOpcion(clave)) return { clave };
        return { clave: null, error: `La opción de cristal "${treatment ?? '(vacía)'}" no existe para ${lensType.toLowerCase()}.` };
    }
    return { clave: null, error: `Tipo de cristal desconocido: ${String(lensType)}.` };
}

/** Qué opción de TEÑIDO corresponde, o `{ clave: null }` si no lleva color. */
export function claveDeTenido(lc: LensConfig | null | undefined): { clave: ClaveOpcion | null; tono?: string; estilo?: EstiloTenidoWeb; error?: string } {
    const t = tenidoDeConfig(lc);
    if (!t) return { clave: null };
    if (t.estilo === 'MUESTRA') return { clave: null, error: 'El teñido "según muestra" se pide en el local con la muestra en mano; elegí compacto o degradé.' };
    if (!t.estilo) return { clave: null, error: 'Falta el estilo del teñido (compacto o degradé).' };
    return { clave: `TENIDO.${t.estilo}` as ClaveOpcion, tono: t.tono, estilo: t.estilo };
}

const TIPO_LEGIBLE: Record<string, string> = {
    MONOFOCAL: 'Monofocal',
    BIFOCAL: 'Bifocal',
    MULTIFOCAL: 'Multifocal',
    NONE: 'Sin aumento',
};

const ESTILO_LEGIBLE: Record<string, string> = { COMPACTO: 'compacto', DEGRADE: 'degradé', MUESTRA: 'según muestra' };

/**
 * La configuración en una frase, la MISMA en carrito, checkout, mails y ficha:
 * "Monofocal · Super Blue", "Sin aumento · Teñido Gris compacto",
 * "Multifocal · Varilux Premium". Con `opciones` usa el título vivo; si no,
 * el que se guardó en el ítem; y como último recurso la clave legible.
 */
export function describirConfiguracion(lc: LensConfig | null | undefined, opciones?: MapaOpciones): string {
    if (!tieneCristales(lc)) return '';
    if (lc!.secondPair2x1) return 'Multifocal · 2º par sin cargo (2x1 Varilux)';
    const partes: string[] = [];
    const tipo = lc!.lensType ? TIPO_LEGIBLE[lc!.lensType] : null;
    if (tipo) partes.push(tipo);
    const { clave } = claveDeCristal(lc);
    if (clave && lc!.lensType !== 'NONE') {
        const viva = opciones?.[clave]?.etiqueta;
        partes.push(viva ?? lc!.etiqueta ?? clave.split('.')[1].replace(/_/g, ' ').toLowerCase());
    }
    const t = tenidoDeConfig(lc);
    if (t) partes.push(`Teñido ${t.tono}${t.estilo ? ` ${ESTILO_LEGIBLE[t.estilo]}` : ''}`);
    return partes.join(' · ');
}

// ── Reglas puras sobre el producto vinculado (las usan el service, el CRM y los checks) ──

export const PREFIJO_ARCHIVADO = '[ARCHIVADO]';

/** Un producto archivado sigue existiendo (las ventas viejas cuelgan de él) pero no se vende. Mismo criterio laxo que el cotizador. */
export function esArchivado(name: string | null | undefined): boolean {
    return /^\s*\[archivado\]/i.test(name || '');
}

const normalizar = (s: string | null | undefined) => sinAcentos(s || '').toLowerCase().trim();

/** ¿El producto sirve para este grupo? (tipo de cristal correcto, o un "Teñido …" de categoría Tratamiento). */
export function productoEncajaEnGrupo(
    grupo: GrupoCristal,
    p: { category: string | null; type: string | null; name: string | null } | null | undefined,
): boolean {
    if (!p) return false;
    const esperado = PRODUCTO_ESPERADO_POR_GRUPO[grupo];
    if (p.category !== esperado.category) return false;
    if (esperado.type && p.type !== esperado.type) return false;
    if (esperado.nombreEmpiezaCon && !normalizar(p.name).startsWith(normalizar(esperado.nombreEmpiezaCon))) return false;
    return true;
}

/**
 * Avisos sobre un vínculo que es válido pero probablemente no es lo que se
 * quiere publicar. No bloquean: se muestran en /admin/web y los lista el check
 * de vínculos.
 */
export function avisosDeVinculo(
    clave: ClaveOpcion,
    p: { name: string | null; is2x1: boolean; cost?: number | null; laboratory?: string | null } | null | undefined,
): string[] {
    if (!p) return [];
    const avisos: string[] = [];
    const n = normalizar(p.name);
    // "Mi primer" tiene restricciones de adición: no puede ser el precio que se
    // publica para un multifocal (bug del 10/8/2026, $673.298 por par).
    if (grupoDeClave(clave) === 'MULTIFOCAL' && n.includes('mi primer')) {
        avisos.push('Es un "Mi primer": tiene restricciones de adición y no sirve como precio publicado.');
    }
    // La card de Varilux promete el 2x1. Si el producto no es 2x1 el laboratorio
    // cobra el segundo par y la tienda lo estaría regalando.
    if (clave === 'MULTIFOCAL.VARILUX' && !p.is2x1) {
        avisos.push('No es un producto 2x1: la tienda deja de ofrecer el segundo par sin cargo.');
    }
    if (p.cost !== undefined && !(Number(p.cost) > 0)) avisos.push('No tiene costo cargado: el cruce con el laboratorio no va a poder controlarlo.');
    if (p.laboratory !== undefined && !p.laboratory) avisos.push('No tiene laboratorio cargado.');
    return avisos;
}

/**
 * El "desde" de multifocales: el más barato de los multifocales disponibles.
 * Null si no hay ninguno — la landing no muestra el ancla y la placa no se
 * genera (regla R6), nunca un número inventado.
 */
export function precioMultifocalDesdeDe(opciones: Pick<OpcionCristalWeb, 'grupo' | 'disponible' | 'precio'>[]): number | null {
    const precios = opciones
        .filter(o => o.grupo === 'MULTIFOCAL' && o.disponible && typeof o.precio === 'number' && o.precio > 0)
        .map(o => o.precio as number);
    return precios.length ? Math.min(...precios) : null;
}

/** ¿La opción de Varilux habilita el segundo par sin cargo? Solo si está disponible y su producto es 2x1. */
export function variluxHabilita2x1(opciones: MapaOpciones): boolean {
    const v = opciones['MULTIFOCAL.VARILUX'];
    return !!v && v.disponible && v.is2x1;
}
