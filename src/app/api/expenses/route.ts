import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const role = request.headers.get('x-user-role') || 'STAFF';
        if (role !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const month = searchParams.get('month');
        const year = searchParams.get('year');

        if (!month || !year) {
            return NextResponse.json({ error: 'Missing month or year' }, { status: 400 });
        }

        const m = parseInt(month, 10);
        const y = parseInt(year, 10);

        const expenses = await prisma.fixedCost.findMany({
            where: {
                month: m,
                year: y
            },
            orderBy: {
                createdAt: 'asc'
            }
        });

        // Calcular dinámicamente los costos de laboratorio.
        // Límites del mes en hora argentina (UTC-3), independiente del TZ del server.
        const startDate = new Date(Date.UTC(y, m - 1, 1, 3));
        const endDate = new Date(Date.UTC(y, m, 1, 3)); // 1er día del mes siguiente

        const orders = await prisma.order.findMany({
            where: {
                orderType: 'SALE',
                isDeleted: false,
                labSentAt: {
                    gte: startDate,
                    lt: endDate
                }
            },
            select: {
                id: true,
                items: {
                    select: {
                        productCostSnapshot: true,
                        laboratorySnapshot: true,
                        eye: true,
                        quantity: true
                    }
                }
            }
        });

        const labCosts = new Map<string, number>();

        for (const order of orders) {
            for (const item of order.items) {
                if (item.laboratorySnapshot && item.productCostSnapshot) {
                    const lab = item.laboratorySnapshot.trim();
                    // El snapshot de costo de cristales es POR PAR: cada ojo (OD/OI) aporta la mitad
                    const itemCost = item.productCostSnapshot * (item.eye ? 0.5 : 1) * (item.quantity || 1);
                    labCosts.set(lab, (labCosts.get(lab) || 0) + itemCost);
                }
            }
        }

        const dynamicExpenses = Array.from(labCosts.entries()).map(([lab, amount], idx) => ({
            id: `calc-${m}-${y}-${idx}`,
            name: lab.toLowerCase().includes('laboratorio') ? lab : `Laboratorio ${lab}`,
            amount: amount,
            category: 'PROVEEDOR',
            type: 'PROVEEDOR',
            month: m,
            year: y,
            isCalculated: true
        }));

        // Opcional: filtrar de los fijos si están vacíos para evitar duplicados en la UI
        const manualToExclude = ['Laboratorio Optovision', 'Laboratorio Grupo Óptico', 'Cristaldo'];
        const filteredExpenses = expenses.filter(e => {
            if (manualToExclude.includes(e.name) && e.amount === 0) {
                // Si existe un dinámico o simplemente lo queremos ocultar
                return false; 
            }
            return true;
        });

        return NextResponse.json([...filteredExpenses, ...dynamicExpenses]);
    } catch (error: any) {
        console.error('Error fetching expenses:', error);
        return NextResponse.json({ error: error.message || 'Error fetching expenses' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const role = request.headers.get('x-user-role') || 'STAFF';
        if (role !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const body = await request.json();
        const { id, name, amount, category, type, month, year, notes } = body;

        if (!name || amount === undefined || !category || !type || !month || !year) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const actor = getActor(request);
        let expense;

        if (id) {
            // Update existing
            const previo = await prisma.fixedCost.findUnique({ where: { id } });
            expense = await prisma.fixedCost.update({
                where: { id },
                data: {
                    name,
                    amount: parseFloat(amount),
                    category,
                    type,
                    notes
                }
            });

            const before: Record<string, any> = {};
            const after: Record<string, any> = {};
            if (previo) {
                for (const campo of ['name', 'amount', 'category', 'month'] as const) {
                    if (previo[campo] !== expense[campo]) {
                        before[campo] = previo[campo];
                        after[campo] = expense[campo];
                    }
                }
            }
            await logAudit({
                userId: actor.id,
                userName: actor.name,
                action: 'UPDATE',
                entityType: 'EXPENSE',
                entityId: expense.id,
                details: {
                    descripcion: `Gasto "${expense.name}" (${expense.month}/${expense.year}) actualizado`,
                    before,
                    after,
                },
            });
        } else {
            // Create new
            expense = await prisma.fixedCost.create({
                data: {
                    name,
                    amount: parseFloat(amount),
                    category,
                    type,
                    month: parseInt(month, 10),
                    year: parseInt(year, 10),
                    notes
                }
            });

            await logAudit({
                userId: actor.id,
                userName: actor.name,
                action: 'CREATE',
                entityType: 'EXPENSE',
                entityId: expense.id,
                details: {
                    descripcion: `Gasto "${expense.name}" (${expense.month}/${expense.year}) creado`,
                    name: expense.name,
                    amount: expense.amount,
                    category: expense.category,
                    month: expense.month,
                    year: expense.year,
                },
            });
        }

        return NextResponse.json(expense);
    } catch (error: any) {
        console.error('Error saving expense:', error);
        return NextResponse.json({ error: error.message || 'Error saving expense' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const role = request.headers.get('x-user-role') || 'STAFF';
        if (role !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing expense ID' }, { status: 400 });
        }

        const previo = await prisma.fixedCost.findUnique({ where: { id } });

        await prisma.fixedCost.delete({
            where: { id }
        });

        const actor = getActor(request);
        await logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'DELETE',
            entityType: 'EXPENSE',
            entityId: id,
            details: {
                descripcion: `Gasto "${previo?.name ?? id}" eliminado`,
                snapshot: previo ? {
                    name: previo.name,
                    amount: previo.amount,
                    category: previo.category,
                    type: previo.type,
                    month: previo.month,
                    year: previo.year,
                    notes: previo.notes,
                } : null,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting expense:', error);
        return NextResponse.json({ error: error.message || 'Error deleting expense' }, { status: 500 });
    }
}
