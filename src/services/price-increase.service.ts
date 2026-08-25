import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import type { Actor } from '@/lib/actor';

/**
 * AUMENTOS DE PRECIO DE LISTA, hechos desde el CRM.
 *
 * Nació el 25/8/2026: los aumentos se hacían con un script suelto, solo cubrían
 * un laboratorio y NO dejaban rastro — cuando hubo que responder "¿el 7% quedó
 * aplicado?", la única evidencia era el `updatedAt` de cada producto. Ahora lo
 * hace la administradora desde una pantalla y cada cambio queda firmado.
 *
 * REGLAS DEL NEGOCIO:
 *  - Solo se toca `price` (precio de lista). `cost`, `baseCost` y
 *    `wholesalePrice` NO: un aumento es de MARGEN, no un ajuste de costo.
 *    Tocar el costo falsearía todo el cruce con las facturas del laboratorio.
 *  - Las ventas ya cerradas NO se ven afectadas: congelan su precio al
 *    cerrarse (garantizado por scripts/checks/venta-no-repricea.check.mjs).
 *    Los presupuestos SÍ siguen la lista viva, que es lo correcto.
 *  - Nada se aplica sin haberlo visto antes: `preview()` y `apply()` usan
 *    EXACTAMENTE el mismo filtro y el mismo redondeo, así lo que se confirma
 *    es lo que se guarda.
 */

export interface PriceIncreaseFilter {
    /** Valor de `Product.laboratory`. OJO: es 'GRUPO OPTICO' CON ESPACIO — el
     *  'GRUPO_OPTICO' con guión bajo es `LabCostEntry.lab`, otra cosa. */
    laboratory?: string | null;
    category?: string | null;
    brand?: string | null;
    /** Ids elegidos a mano. Si viene, manda sobre el resto de los filtros. */
    ids?: string[];
}

export interface PriceIncreaseRow {
    id: string;
    /** Hay productos sin nombre en la base: la pantalla los muestra igual. */
    name: string | null;
    brand: string | null;
    category: string;
    laboratory: string | null;
    price: number;
    nuevo: number;
}

/** Un aumento nunca puede ser negativo ni delirante: el dedo se equivoca. */
export const MAX_PCT = 100;

function nuevoPrecio(price: number, pct: number) {
    return Math.round(price * (1 + pct / 100));
}

export const PriceIncreaseService = {
    /** Los valores que existen de verdad, para armar los filtros de la pantalla. */
    async options() {
        const [laboratorios, categorias, marcas] = await Promise.all([
            prisma.product.groupBy({ by: ['laboratory'], _count: { _all: true } }),
            prisma.product.groupBy({ by: ['category'], _count: { _all: true } }),
            prisma.product.groupBy({ by: ['brand'], _count: { _all: true } }),
        ]);
        const limpiar = (rows: any[], key: string) => rows
            .filter(r => r[key])
            .map(r => ({ valor: r[key] as string, productos: r._count._all as number }))
            .sort((a, b) => b.productos - a.productos);
        return {
            laboratorios: limpiar(laboratorios, 'laboratory'),
            categorias: limpiar(categorias, 'category'),
            marcas: limpiar(marcas, 'brand'),
        };
    },

    where(filter: PriceIncreaseFilter) {
        if (filter.ids?.length) return { id: { in: filter.ids } };
        const where: any = {};
        if (filter.laboratory) where.laboratory = filter.laboratory;
        if (filter.category) where.category = filter.category;
        if (filter.brand) where.brand = filter.brand;
        return where;
    },

    /** Qué pasaría. No escribe nada. */
    async preview(filter: PriceIncreaseFilter, pct: number): Promise<PriceIncreaseRow[]> {
        const productos = await prisma.product.findMany({
            where: { ...this.where(filter), price: { gt: 0 } },
            select: { id: true, name: true, brand: true, category: true, laboratory: true, price: true },
            orderBy: [{ laboratory: 'asc' }, { brand: 'asc' }, { name: 'asc' }],
        });
        return productos.map(p => ({ ...p, nuevo: nuevoPrecio(p.price, pct) }));
    },

    /**
     * Aplica el aumento. `esperados` son los ids que la persona vio en la
     * pantalla: si en el medio cambió el catálogo, se aplica SOLO sobre esos y
     * se informa la diferencia — nunca se toca un producto que no se mostró.
     */
    async apply(filter: PriceIncreaseFilter, pct: number, actor: Actor, esperados?: string[]) {
        if (!Number.isFinite(pct) || pct <= 0 || pct > MAX_PCT) {
            throw new Error(`El aumento tiene que estar entre 0 y ${MAX_PCT}%.`);
        }
        const filas = await this.preview(filter, pct);
        const aplicables = esperados?.length
            ? filas.filter(f => esperados.includes(f.id))
            : filas;
        if (aplicables.length === 0) return { actualizados: 0, salteados: 0, filas: [] };

        // Una transacción: o suben todos o no sube ninguno. Un aumento a medias
        // deja el catálogo con dos listas de precios conviviendo.
        await prisma.$transaction(
            aplicables.map(f => prisma.product.update({
                where: { id: f.id },
                data: { price: f.nuevo },
            })),
        );

        // Firma por producto: es lo que después arma el historial de aumentos.
        // Fire-and-forget (logAudit nunca lanza): que falle el rastro no puede
        // tumbar un aumento ya aplicado.
        for (const f of aplicables) {
            logAudit({
                userId: actor.id,
                userName: actor.name,
                action: 'PRICE_OVERRIDE',
                entityType: 'PRODUCT',
                entityId: f.id,
                details: {
                    de: f.price, a: f.nuevo, pct,
                    laboratorio: f.laboratory, categoria: f.category, marca: f.brand,
                    producto: f.name,
                },
            }).catch(console.error);
        }

        return {
            actualizados: aplicables.length,
            salteados: filas.length - aplicables.length,
            filas: aplicables,
        };
    },

    /** El historial: cada aumento con su fecha, alcance y quién lo hizo. */
    async history(limite = 40) {
        const filas = await prisma.auditLog.findMany({
            where: { action: 'PRICE_OVERRIDE', entityType: 'PRODUCT' },
            select: { createdAt: true, userName: true, details: true },
            orderBy: { createdAt: 'desc' },
            take: 5000,
        });
        // Una corrida = mismo minuto, mismo porcentaje, mismo laboratorio.
        const corridas = new Map<string, any>();
        for (const f of filas) {
            const d: any = f.details || {};
            const minuto = new Date(f.createdAt).toISOString().slice(0, 16);
            const clave = `${minuto}|${d.pct}|${d.laboratorio ?? ''}`;
            if (!corridas.has(clave)) {
                corridas.set(clave, {
                    fecha: f.createdAt, quien: f.userName, pct: d.pct,
                    laboratorio: d.laboratorio ?? null, productos: 0, de: 0, a: 0,
                });
            }
            const c = corridas.get(clave);
            c.productos++;
            c.de += d.de || 0;
            c.a += d.a || 0;
        }
        return [...corridas.values()].slice(0, limite);
    },
};
