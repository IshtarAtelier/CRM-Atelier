import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';
import { invalidateWebCatalog } from '@/lib/catalog/tienda-map';

/**
 * Qué armazones de la tienda entran en el 2x1 (`eligible2x1Web`).
 *
 * POR QUÉ ES UNA RUTA APARTE Y NO EL FORM DE INVENTARIO
 * El tilde ya se puede tocar de a uno en la ficha de cada producto, pero marcar
 * una promo así son 106 fichas abiertas de a una. Esta ruta existe para
 * marcarlos de a muchos desde una sola pantalla, que es como se decide una
 * promo: mirando el catálogo entero, no producto por producto.
 *
 * ESTO MUEVE PLATA
 * Marcar un armazón lo vuelve regalable en la tienda. Por eso: solo ADMIN, y
 * cada cambio queda en el AuditLog con quién lo hizo — el mismo trato que el
 * precio.
 */

/** Los armazones publicados en la web, con su tilde actual. */
export async function GET() {
    try {
        const headersList = await headers();
        const role = headersList.get('x-user-role') || 'STAFF';
        if (role !== 'ADMIN') {
            return NextResponse.json({ error: 'Solo el administrador puede ver esta lista' }, { status: 403 });
        }

        const armazones = await prisma.product.findMany({
            where: { publishToWeb: true },
            // `select` explícito y no la fila entera: contra producción el schema
            // local está adelantado y devolver todo revienta (trampa conocida).
            select: {
                id: true, name: true, model: true, brand: true, price: true,
                category: true, stock: true, eligible2x1Web: true, imagenesCatalogo: true,
            },
            orderBy: [{ category: 'asc' }, { name: 'asc' }],
        });

        return NextResponse.json({
            armazones,
            marcados: armazones.filter(a => a.eligible2x1Web).length,
            total: armazones.length,
        });
    } catch (error) {
        console.error('[PROMO 2x1 WEB] Error al listar:', error);
        return NextResponse.json({ error: 'No se pudo leer el catálogo' }, { status: 500 });
    }
}

/**
 * Marca o desmarca en lote.
 *
 * Body: `{ ids: string[], marcar: boolean }`
 * Solo toca los ids que se mandan: el resto queda como está. No hay un "pisá
 * todo con esta lista" a propósito — un bug en el armado de la lista apagaría
 * la promo entera sin que nadie lo pida.
 */
export async function PATCH(request: Request) {
    try {
        const headersList = await headers();
        const role = headersList.get('x-user-role') || 'STAFF';
        if (role !== 'ADMIN') {
            return NextResponse.json({ error: 'Solo el administrador puede cambiar la promo' }, { status: 403 });
        }

        const body = await request.json().catch(() => null);
        const ids: unknown = body?.ids;
        const marcar = body?.marcar === true;

        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'Faltan los armazones a marcar.' }, { status: 400 });
        }
        // Tope: la tienda tiene ~106 armazones. Un lote de 5.000 ids es un error
        // o un abuso, no un pedido real.
        if (ids.length > 500) {
            return NextResponse.json({ error: 'Demasiados armazones en un solo pedido.' }, { status: 400 });
        }
        const idsLimpios = ids
            .filter((x): x is string => typeof x === 'string')
            .map(x => x.replace(/[^a-zA-Z0-9_-]/g, ''))
            .filter(Boolean);
        if (idsLimpios.length === 0) {
            return NextResponse.json({ error: 'Ningún identificador válido.' }, { status: 400 });
        }

        // `publishToWeb: true` en el where: la promo es de la TIENDA. Marcar un
        // armazón que no está publicado no haría nada visible y dejaría un tilde
        // suelto esperando a que alguien lo publique sin saberlo.
        const r = await prisma.product.updateMany({
            where: { id: { in: idsLimpios }, publishToWeb: true },
            data: { eligible2x1Web: marcar },
        });

        await invalidateWebCatalog();

        // `await` y no fire-and-forget: esto decide qué se regala. La fila del
        // audit tiene que estar commiteada antes de contestar que sí.
        const actor = getActor(request);
        await logAudit({
            action: 'UPDATE',
            entityType: 'PRODUCT',
            entityId: idsLimpios.length === 1 ? idsLimpios[0] : 'lote',
            userId: actor.id,
            userName: actor.name,
            details: `${marcar ? 'Marcó' : 'Desmarcó'} ${r.count} armazón(es) para el 2x1 de la tienda web`,
        }).catch(e => console.error('[PROMO 2x1 WEB] audit:', e));

        return NextResponse.json({ ok: true, actualizados: r.count });
    } catch (error) {
        console.error('[PROMO 2x1 WEB] Error al marcar:', error);
        return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 });
    }
}
