import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';
import { leerGastosDelMes } from '@/services/gastos.service';
import { esAutomatico } from '@/lib/constants/gastos-fijos';

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

        // SOLO LECTURA: devuelve lo guardado más los laboratorios (que son una
        // vista derivada de las ventas). Reconciliar la lista fija y traer los
        // importes de Meta y Google escribe, así que vive en
        // POST /api/expenses/sincronizar y se pide aparte.
        const gastos = await leerGastosDelMes(m, y);

        // El estado de carga NO se responde acá. Necesita los avisos de las
        // lecturas de Meta y Google, que solo existen cuando el mes se
        // sincroniza: calculado sobre una lectura pura daba siempre
        // "listoParaCerrar: true" aunque las plataformas estuvieran caídas.
        // Vive en POST /api/expenses/sincronizar, junto a los gastos.
        return NextResponse.json(gastos);
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

            // Un importe automático no se pisa a mano: si se pudiera, el número
            // del cierre dejaría de ser el de la plataforma y no habría forma
            // de saber cuál de los dos es el verdadero. Además el service lo
            // volvería a sobreescribir en la próxima lectura del mes.
            if (previo && esAutomatico(previo.fuente)) {
                return NextResponse.json(
                    { error: `"${previo.name}" lo calcula el sistema: no se edita a mano.` },
                    { status: 409 },
                );
            }
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

        // Los conceptos de la lista fija no se borran: tienen que estar todos
        // los meses. Borrar uno era la forma silenciosa de que un gasto
        // desapareciera del resultado del negocio.
        if (previo?.obligatorio) {
            return NextResponse.json(
                { error: `"${previo.name}" es un gasto fijo: está todos los meses y no se puede borrar. Si de verdad no corresponde más, hay que sacarlo de la lista de conceptos.` },
                { status: 409 },
            );
        }

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
