import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';

export async function GET(request: Request) {
    try {
        const role = request.headers.get('x-user-role') || 'STAFF';
        if (role !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const year = searchParams.get('year');

        const targets = await prisma.monthlyTarget.findMany({
            where: year ? { year: parseInt(year, 10) } : undefined,
            orderBy: [{ year: 'desc' }, { month: 'desc' }]
        });

        return NextResponse.json(targets);
    } catch (error) {
        console.error('Error fetching monthly targets:', error);
        return NextResponse.json({ error: 'Error fetching targets' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const role = request.headers.get('x-user-role') || 'STAFF';
        if (role !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const body = await request.json();
        const { target1, target2, target3, month, year, currency } = body;

        const currentMonth = month || new Date().getMonth() + 1;
        const currentYear = year || new Date().getFullYear();
        // "USD" = los valores se convierten a ARS con el blue del día; "ARS" = fijos.
        const targetCurrency = currency === 'USD' ? 'USD' : 'ARS';

        // Leer el objetivo previo antes del upsert para dejar before/after en la auditoría
        const previo = await prisma.monthlyTarget.findUnique({
            where: {
                month_year: {
                    month: currentMonth,
                    year: currentYear
                }
            }
        });

        const updatedTarget = await prisma.monthlyTarget.upsert({
            where: {
                month_year: {
                    month: currentMonth,
                    year: currentYear
                }
            },
            update: {
                target1: parseFloat(target1),
                target2: parseFloat(target2),
                target3: target3 ? parseFloat(target3) : null,
                currency: targetCurrency
            },
            create: {
                month: currentMonth,
                year: currentYear,
                target1: parseFloat(target1),
                target2: parseFloat(target2),
                target3: target3 ? parseFloat(target3) : null,
                currency: targetCurrency
            }
        });

        const actor = getActor(request);
        await logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'UPDATE',
            entityType: 'SETTING',
            entityId: updatedTarget.id,
            details: {
                descripcion: `Objetivos de ${currentMonth}/${currentYear} ${previo ? 'actualizados' : 'creados'}`,
                month: currentMonth,
                year: currentYear,
                before: previo ? {
                    target1: previo.target1,
                    target2: previo.target2,
                    target3: previo.target3,
                    currency: previo.currency,
                } : null,
                after: {
                    target1: updatedTarget.target1,
                    target2: updatedTarget.target2,
                    target3: updatedTarget.target3,
                    currency: updatedTarget.currency,
                },
            },
        });

        return NextResponse.json(updatedTarget);
    } catch (error) {
        console.error('Error updating monthly targets:', error);
        return NextResponse.json({ error: 'Error updating targets' }, { status: 500 });
    }
}
