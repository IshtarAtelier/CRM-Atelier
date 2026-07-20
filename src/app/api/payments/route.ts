import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { ContactService } from '@/services/contact.service';
import { getActor } from '@/lib/actor';
import { digitsOnly, MIN_DIGITS_FOR_NUMERIC_MATCH } from '@/lib/payment-search';
import { RENDICION_CUTOFF_ISO } from '@/lib/constants';

const CASH_METHODS = ['EFECTIVO', 'CASH'];

export const dynamic = 'force-dynamic';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/**
 * Filtro de búsqueda para `q`: espeja la semántica client-side de
 * src/lib/payment-search.ts pero sobre TODO el período (clave para
 * detectar pagos duplicados aunque no estén en la página cargada).
 * Las coincidencias que requieren normalizar a dígitos (ref con guiones,
 * monto formateado, teléfono) se resuelven con un query crudo porque
 * `contains` de Prisma no puede aplicar regexp_replace.
 */
async function buildSearchWhere(q: string, fromDate: Date | null, toDate: Date | null) {
    const query = q.toLowerCase();
    const or: any[] = [
        { notes: { contains: query, mode: 'insensitive' } },
        { orderId: { contains: query, mode: 'insensitive' } },
        { order: { client: { name: { contains: query, mode: 'insensitive' } } } },
    ];

    const qDigits = digitsOnly(query);
    if (qDigits.length >= MIN_DIGITS_FOR_NUMERIC_MATCH) {
        const pattern = `%${qDigits}%`;
        // El resultado igual se intersecta con whereClause (que ya trae from/to),
        // así que acotar acá evita escanear pagos que van a descartarse después.
        const dateFilter = Prisma.sql`
            ${fromDate ? Prisma.sql`AND p."date" >= ${fromDate}` : Prisma.empty}
            ${toDate ? Prisma.sql`AND p."date" <= ${toDate}` : Prisma.empty}
        `;
        const rows = await prisma.$queryRaw<{ id: string }[]>`
            SELECT p.id
            FROM "Payment" p
            JOIN "Order" o ON o.id = p."orderId"
            LEFT JOIN "Client" c ON c.id = o."clientId"
            WHERE o."isDeleted" = false ${dateFilter} AND (
                regexp_replace(coalesce(p.notes, ''), '\\D', '', 'g') LIKE ${pattern}
                OR trunc(p.amount)::bigint::text LIKE ${pattern}
                OR regexp_replace(coalesce(c.phone, ''), '\\D', '', 'g') LIKE ${pattern}
            )`;
        if (rows.length > 0) {
            or.push({ id: { in: rows.map(r => r.id) } });
        }
    }

    return { OR: or };
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { orderId, amount, method, notes, receiptUrl, date } = body;

        if (!orderId || !method) {
            return NextResponse.json({ error: 'Datos de pago incompletos (orderId y method son obligatorios)' }, { status: 400 });
        }

        if (!amount || typeof amount !== 'number' || amount <= 0) {
            return NextResponse.json({ error: 'El monto debe ser un número positivo' }, { status: 400 });
        }

        // Blindaje del circuito de caja: un cobro EN EFECTIVO no se puede fechar
        // antes del corte de rendiciones. Sin esto, un vendedor podía cargar el
        // cobro con fecha vieja para que quede fuera de su pendiente de rendición
        // (el circuito lo excluye) pero siga sumando al efectivo esperado en caja
        // → faltante anónimo que caía sobre la encargada. Correcciones históricas
        // legítimas se hacen por otra vía (no por este alta).
        if (CASH_METHODS.includes(method) && date) {
            const d = new Date(date);
            if (!isNaN(d.getTime()) && d < new Date(RENDICION_CUTOFF_ISO)) {
                return NextResponse.json({
                    error: 'Un cobro en efectivo no puede tener fecha anterior al inicio del circuito de caja. Usá la fecha real del cobro.',
                }, { status: 400 });
            }
        }

        const result = await ContactService.addPayment(orderId, amount, method, notes, receiptUrl, date, getActor(request));
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error creating payment:', error);
        return NextResponse.json({ error: error.message || 'Error al registrar pago' }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const method = searchParams.get('method');
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const q = searchParams.get('q')?.trim() ?? '';
        const cursor = searchParams.get('cursor');
        const takeParam = Number(searchParams.get('take'));
        const take = Number.isInteger(takeParam) && takeParam > 0
            ? Math.min(takeParam, MAX_PAGE_SIZE)
            : DEFAULT_PAGE_SIZE;

        // Where del período (método + fechas + órdenes vivas): rige el resumen
        // y el desglose por método, que siempre son sobre el período completo.
        const whereClause: any = {};
        if (method) {
            // Support comma-separated methods for group filtering
            const methods = method.split(',').map(m => m.trim()).filter(Boolean);
            if (methods.length === 1) {
                whereClause.method = methods[0];
            } else if (methods.length > 1) {
                whereClause.method = { in: methods };
            }
        }

        // Límites de día en hora argentina (UTC-3), sin importar el TZ del server:
        // 'YYYY-MM-DD' → inicio 03:00 UTC / fin 02:59:59.999 UTC del día siguiente.
        const dateFilter: any = {};
        const isDateOnly = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
        if (from) dateFilter.gte = isDateOnly(from) ? new Date(`${from}T03:00:00.000Z`) : new Date(from);
        if (to) {
            if (isDateOnly(to)) {
                dateFilter.lte = new Date(new Date(`${to}T03:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000 - 1);
            } else {
                const toDate = new Date(to);
                toDate.setHours(23, 59, 59, 999);
                dateFilter.lte = toDate;
            }
        }
        if (from || to) {
            whereClause.date = dateFilter;
        }

        // Only include payments from non-deleted orders (ventas y presupuestos)
        whereClause.order = {
            isDeleted: false
        };

        // La búsqueda solo acota la lista paginada; los KPIs siguen mostrando
        // el período completo (igual que cuando el filtrado era client-side).
        const listWhere = q
            ? { AND: [whereClause, await buildSearchWhere(q, dateFilter.gte ?? null, dateFilter.lte ?? null)] }
            : whereClause;

        const [totals, byMethod, matchCount, page] = await Promise.all([
            prisma.payment.aggregate({
                where: whereClause,
                _sum: { amount: true },
                _avg: { amount: true },
                _count: true,
            }),
            prisma.payment.groupBy({
                by: ['method'],
                where: whereClause,
                _sum: { amount: true },
                _count: { _all: true },
            }),
            prisma.payment.count({ where: listWhere }),
            prisma.payment.findMany({
                where: listWhere,
                include: {
                    order: {
                        include: {
                            client: {
                                select: { id: true, name: true, phone: true }
                            }
                        }
                    }
                },
                // Orden estable (id desempata fechas iguales) para que el cursor no saltee ni repita filas
                orderBy: [{ date: 'desc' }, { id: 'desc' }],
                take: take + 1,
                ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            }),
        ]);

        const hasMore = page.length > take;
        const payments = hasMore ? page.slice(0, take) : page;

        // Format payments for response
        const formattedPayments = payments.map(p => ({
            id: p.id,
            date: p.date,
            amount: p.amount,
            method: p.method,
            notes: p.notes,
            receiptUrl: p.receiptUrl,
            clientName: p.order?.client?.name || 'Sin cliente',
            clientPhone: p.order?.client?.phone || '',
            orderId: p.orderId,
            orderTotal: p.order?.total || 0,
        }));

        return NextResponse.json({
            payments: formattedPayments,
            pageInfo: {
                nextCursor: hasMore ? payments[payments.length - 1].id : null,
                hasMore,
                matchCount,
            },
            summary: {
                grandTotal: totals._sum.amount ?? 0,
                totalCount: totals._count,
                averagePayment: totals._avg.amount ?? 0,
            },
            methodBreakdown: byMethod
                .map(g => ({ method: g.method, total: g._sum.amount ?? 0, count: g._count._all }))
                .sort((a, b) => b.total - a.total),
        });
    } catch (error: any) {
        console.error('Error fetching payments:', error);
        return NextResponse.json({ error: error.message || 'Error fetching payments' }, { status: 500 });
    }
}
