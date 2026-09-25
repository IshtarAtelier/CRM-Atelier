/**
 * Resolutor de las opciones de cristal de la tienda: lee WebLensOption y el
 * producto vinculado de cada una, y decide si la opción se puede publicar y
 * a qué precio. Es la única fuente para GET /api/web/pricing, el checkout, la
 * landing de multifocales y la placa de redes.
 *
 * Reglas (docs/cristales-web.md):
 *  · el precio es `Product.price` (lista) del vinculado; un cristal no lleva
 *    oferta porque el CRM no la muestra en ningún lado;
 *  · el teñido se cobra por estilo desde TintStylePrice y, si no hay fila,
 *    por el precio del producto — el mismo orden que el mostrador
 *    (`applyTeñidoPromoDiscount`);
 *  · producto inexistente, archivado o a $0 → opción NO disponible, con
 *    motivo. Nunca un número de respaldo.
 */
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { logAudit } from '@/lib/audit';
import type { Actor } from '@/lib/actor';
import {
    CLAVES_OPCION,
    PREFIJO_ARCHIVADO,
    esArchivado,
    esClaveOpcion,
    indexarOpciones,
    productoEncajaEnGrupo,
    type ClaveOpcion,
    type GrupoCristal,
    type MapaOpciones,
    type MotivoNoDisponible,
    type OpcionCristalWeb,
} from '@/lib/cristales-web/claves';

/** Cliente de base con lo que este service necesita (para inyectar uno contra otra base en scripts). */
export type DbCristalesWeb = Pick<typeof prisma, 'webLensOption' | 'product' | 'tintStylePrice'>;

/** Lo que el checkout necesita del producto vinculado para la foto de la línea. Nunca la fila entera. */
export const SELECT_PRODUCTO_VINCULADO = {
    id: true, name: true, model: true, brand: true, category: true, type: true,
    laboratory: true, price: true, cost: true, is2x1: true, lensIndex: true, unitType: true, origin: true,
} satisfies Prisma.ProductSelect;

export type ProductoVinculado = Prisma.ProductGetPayload<{ select: typeof SELECT_PRODUCTO_VINCULADO }>;

export interface OpcionResuelta extends OpcionCristalWeb {
    activa: boolean;
    producto: ProductoVinculado | null;
    updatedAt: Date;
    updatedBy: string | null;
}

function motivoDe(o: { activa: boolean; product: ProductoVinculado | null }, precio: number): MotivoNoDisponible | null {
    if (!o.activa) return 'INACTIVA';
    if (!o.product) return 'SIN_PRODUCTO';
    if (esArchivado(o.product.name)) return 'ARCHIVADO';
    if (!(precio > 0)) return 'SIN_PRECIO';
    return null;
}

export async function resolverOpcionesDeCristal(db: DbCristalesWeb = prisma): Promise<OpcionResuelta[]> {
    const [filas, estilos] = await Promise.all([
        db.webLensOption.findMany({
            select: {
                clave: true, grupo: true, codigo: true, etiqueta: true, descripcion: true, badge: true,
                destacados: true, orden: true, activa: true, productId: true, updatedAt: true, updatedBy: true,
                product: { select: SELECT_PRODUCTO_VINCULADO },
            },
            orderBy: [{ grupo: 'asc' }, { orden: 'asc' }],
        }),
        db.tintStylePrice.findMany({ select: { category: true, price: true } }),
    ]);
    const precioPorEstilo = new Map(estilos.map(e => [e.category, e.price]));

    return filas
        .filter(f => esClaveOpcion(f.clave))
        .map(f => {
            const grupo = f.grupo as GrupoCristal;
            const p = f.product;
            const precioBase = p ? Number(p.price) || 0 : 0;
            // Teñido: por estilo si la tabla lo tiene, si no el producto.
            const precio = grupo === 'TENIDO' ? (precioPorEstilo.get(f.codigo) ?? precioBase) : precioBase;
            const motivo = motivoDe({ activa: f.activa, product: p }, precio);
            return {
                clave: f.clave as ClaveOpcion,
                grupo,
                codigo: f.codigo,
                etiqueta: f.etiqueta,
                descripcion: f.descripcion,
                badge: f.badge,
                destacados: f.destacados,
                orden: f.orden,
                activa: f.activa,
                disponible: motivo === null,
                motivo,
                precio: motivo === null ? Math.round(precio) : null,
                nombreProducto: p?.name?.trim() ?? null,
                is2x1: p?.is2x1 ?? false,
                productId: p?.id ?? null,
                producto: p,
                updatedAt: f.updatedAt,
                updatedBy: f.updatedBy,
            };
        });
}

/** La forma pública: sin costo, sin laboratorio, sin fila de Product. */
export function aOpcionPublica(o: OpcionResuelta): OpcionCristalWeb {
    const { producto: _p, activa: _a, updatedAt: _u, updatedBy: _b, ...publica } = o;
    return publica;
}

export async function mapaOpcionesPublico(db: DbCristalesWeb = prisma): Promise<MapaOpciones> {
    return indexarOpciones((await resolverOpcionesDeCristal(db)).map(aOpcionPublica));
}

// ── Administración (/admin/web → Cristales) ────────────────────────────────

export interface CandidatoCristal {
    id: string;
    name: string | null;
    type: string | null;
    laboratory: string | null;
    price: number;
    is2x1: boolean;
}

/** Los productos que se pueden vincular a cada grupo: del tipo correcto, no archivados, con precio. */
export async function candidatosPorGrupo(db: DbCristalesWeb = prisma): Promise<Record<GrupoCristal, CandidatoCristal[]>> {
    const filas = await db.product.findMany({
        where: {
            OR: [
                { category: 'Cristal', type: { in: ['Cristal Monofocal', 'Cristal Bifocal', 'Cristal Multifocal'] } },
                { category: 'Tratamiento', name: { startsWith: 'Teñido', mode: 'insensitive' } },
            ],
            price: { gt: 0 },
            NOT: { name: { startsWith: PREFIJO_ARCHIVADO } },
        },
        select: { id: true, name: true, type: true, category: true, laboratory: true, price: true, is2x1: true },
        orderBy: [{ price: 'asc' }],
    });
    const porGrupo: Record<GrupoCristal, CandidatoCristal[]> = { MONOFOCAL: [], BIFOCAL: [], MULTIFOCAL: [], TENIDO: [] };
    for (const f of filas) {
        if (esArchivado(f.name)) continue;
        for (const grupo of Object.keys(porGrupo) as GrupoCristal[]) {
            if (productoEncajaEnGrupo(grupo, f)) porGrupo[grupo].push({ id: f.id, name: f.name, type: f.type, laboratory: f.laboratory, price: f.price, is2x1: f.is2x1 });
        }
    }
    return porGrupo;
}

export interface CambioOpcion {
    clave: string;
    /** `undefined` = no tocar; `null` = desvincular. */
    productId?: string | null;
    etiqueta?: string;
    descripcion?: string | null;
    badge?: string | null;
    destacados?: string[];
    activa?: boolean;
}

export class CambioInvalidoError extends Error {}

/**
 * Aplica cambios del CRM, de a uno, validando que el producto encaje en el
 * grupo. Cada fila queda en el AuditLog con quién la cambió: esto decide qué
 * se vende y a qué precio en la web.
 */
export async function actualizarOpciones(cambios: CambioOpcion[], actor: Actor, db: DbCristalesWeb = prisma): Promise<{ actualizadas: ClaveOpcion[] }> {
    const actualizadas: ClaveOpcion[] = [];
    for (const c of cambios) {
        if (!esClaveOpcion(c.clave)) throw new CambioInvalidoError(`La opción "${c.clave}" no existe.`);
        const actual = await db.webLensOption.findUnique({
            where: { clave: c.clave },
            select: { clave: true, grupo: true, etiqueta: true, descripcion: true, badge: true, destacados: true, activa: true, productId: true, product: { select: { name: true } } },
        });
        if (!actual) throw new CambioInvalidoError(`La opción "${c.clave}" no está cargada en la base.`);

        const data: Prisma.WebLensOptionUpdateInput = { updatedBy: actor.name };
        let nombreNuevo: string | null | undefined;
        if (c.productId !== undefined) {
            if (c.productId === null) {
                data.product = { disconnect: true };
                nombreNuevo = null;
            } else {
                const p = await db.product.findUnique({
                    where: { id: String(c.productId).replace(/[^a-zA-Z0-9_-]/g, '') },
                    select: { id: true, name: true, category: true, type: true, price: true },
                });
                if (!p) throw new CambioInvalidoError(`El producto elegido para "${actual.etiqueta}" no existe.`);
                if (!productoEncajaEnGrupo(actual.grupo as GrupoCristal, p)) {
                    throw new CambioInvalidoError(`"${p.name?.trim()}" no es un ${actual.grupo === 'TENIDO' ? 'teñido' : `cristal ${actual.grupo.toLowerCase()}`}: no se puede vincular a "${actual.etiqueta}".`);
                }
                if (esArchivado(p.name)) throw new CambioInvalidoError(`"${p.name?.trim()}" está archivado: desarchivalo en el inventario antes de vincularlo.`);
                if (!(p.price > 0)) throw new CambioInvalidoError(`"${p.name?.trim()}" no tiene precio cargado.`);
                data.product = { connect: { id: p.id } };
                nombreNuevo = p.name;
            }
        }
        if (typeof c.etiqueta === 'string') {
            const e = c.etiqueta.trim();
            if (!e) throw new CambioInvalidoError('La etiqueta no puede quedar vacía.');
            data.etiqueta = e.slice(0, 80);
        }
        if (c.descripcion !== undefined) data.descripcion = c.descripcion ? String(c.descripcion).trim().slice(0, 200) : null;
        if (c.badge !== undefined) data.badge = c.badge ? String(c.badge).trim().slice(0, 40) : null;
        if (Array.isArray(c.destacados)) data.destacados = c.destacados.map(d => String(d).trim().slice(0, 60)).filter(Boolean).slice(0, 5);
        if (typeof c.activa === 'boolean') data.activa = c.activa;

        await db.webLensOption.update({ where: { clave: c.clave }, data, select: { clave: true } });
        actualizadas.push(c.clave);

        // `await`: decide qué se vende en la web. La fila del audit tiene que
        // estar antes de contestar que sí.
        await logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'UPDATE',
            entityType: 'WEB_LENS_OPTION',
            entityId: c.clave,
            details: {
                before: { productId: actual.productId, producto: actual.product?.name?.trim() ?? null, etiqueta: actual.etiqueta, activa: actual.activa },
                after: {
                    productId: c.productId === undefined ? actual.productId : c.productId,
                    producto: nombreNuevo === undefined ? (actual.product?.name?.trim() ?? null) : (nombreNuevo?.trim() ?? null),
                    etiqueta: data.etiqueta ?? actual.etiqueta,
                    activa: data.activa ?? actual.activa,
                },
            },
        });
    }
    return { actualizadas };
}

/** Las claves que la tabla debería tener; sirve para que un check avise si falta una fila. */
export const CLAVES_ESPERADAS: readonly ClaveOpcion[] = CLAVES_OPCION;
