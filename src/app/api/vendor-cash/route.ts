import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';

/**
 * Caja por vendedor (cuenta corriente individual).
 * Saldo = CREDITO − DEBITO. Positivo = tiene para cobrar; negativo = debe.
 *
 * Permisos:
 *  - ADMIN: ve todas las cajas y puede cargar movimientos a cualquier vendedor.
 *  - STAFF: ve y carga movimientos solo en SU propia caja.
 * (OPTICA nunca llega acá: el middleware la corta con 403.)
 */

const VALID_TYPES = ['CREDITO', 'DEBITO'];
const VALID_CATEGORIES = ['PAGO', 'COMISION', 'ADELANTO', 'POST_VENTA', 'OTRO'];

export async function GET(request: Request) {
    try {
        const actor = getActor(request);
        if (!actor.id) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }
        const isAdmin = actor.role === 'ADMIN';

        const vendors = await prisma.user.findMany({
            where: isAdmin ? { role: { in: ['STAFF', 'ADMIN'] } } : { id: actor.id },
            select: { id: true, name: true, role: true },
            orderBy: { name: 'asc' },
        });

        const sums = await prisma.vendorCashEntry.groupBy({
            by: ['vendorId', 'type'],
            _sum: { amount: true },
        });
        const balanceOf = (vendorId: string) =>
            sums
                .filter(s => s.vendorId === vendorId)
                .reduce((acc, s) => acc + (s.type === 'CREDITO' ? 1 : -1) * (s._sum.amount || 0), 0);

        const entries = await prisma.vendorCashEntry.findMany({
            where: isAdmin ? {} : { vendorId: actor.id },
            orderBy: { createdAt: 'desc' },
            take: 300,
            include: { vendor: { select: { name: true } } },
        });

        return NextResponse.json({
            isAdmin,
            vendors: vendors.map(v => ({ ...v, balance: balanceOf(v.id) })),
            entries: entries.map(e => ({
                id: e.id,
                vendorId: e.vendorId,
                vendorName: e.vendor?.name || '—',
                type: e.type,
                amount: e.amount,
                reason: e.reason,
                category: e.category,
                receiptUrl: e.receiptUrl,
                createdByName: e.createdByName,
                createdAt: e.createdAt,
            })),
        });
    } catch (error: any) {
        console.error('Error obteniendo caja de vendedores:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const actor = getActor(request);
        if (!actor.id) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }
        const isAdmin = actor.role === 'ADMIN';

        const body = await request.json();
        const { type, reason, category, receiptUrl } = body;
        // STAFF solo puede cargar en su propia caja, pida lo que pida.
        const vendorId = isAdmin && body.vendorId ? String(body.vendorId) : actor.id;

        const amount = Number(body.amount);
        if (!type || !reason || !Number.isFinite(amount) || amount <= 0) {
            return NextResponse.json({ error: 'Faltan campos obligatorios (type, amount > 0, reason)' }, { status: 400 });
        }
        if (!VALID_TYPES.includes(type)) {
            return NextResponse.json({ error: `Tipo inválido. Valores permitidos: ${VALID_TYPES.join(', ')}` }, { status: 400 });
        }
        const cat = category && VALID_CATEGORIES.includes(category) ? category : 'OTRO';

        const vendor = await prisma.user.findUnique({ where: { id: vendorId }, select: { id: true, name: true, role: true } });
        if (!vendor || vendor.role === 'OPTICA') {
            return NextResponse.json({ error: 'Vendedor no encontrado' }, { status: 404 });
        }

        const entry = await prisma.vendorCashEntry.create({
            data: {
                vendorId: vendor.id,
                type,
                amount,
                reason,
                category: cat,
                receiptUrl: receiptUrl || null,
                createdById: actor.id,
                createdByName: actor.name,
            },
        });

        await logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'CREATE',
            entityType: 'VENDOR_CASH',
            entityId: entry.id,
            details: { vendorId: vendor.id, vendorName: vendor.name, type, amount, reason, category: cat },
        });

        return NextResponse.json(entry);
    } catch (error: any) {
        console.error('Error registrando movimiento de caja de vendedor:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
