import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { LabCostReconciliationService } from '@/services/lab-cost-reconciliation.service';

export const dynamic = 'force-dynamic';

// GET /api/lab-costs — conciliación de costos de laboratorio (solo ADMIN)
// Filtros: ?lab=OPTOVISION|GRUPO_OPTICO & status=OK|OVERCOST|UNDERCOST|UNMATCHED
export async function GET(request: Request) {
    try {
        const role = request.headers.get('x-user-role') || 'STAFF';
        if (role !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const where: any = {};
        const lab = searchParams.get('lab');
        const status = searchParams.get('status');
        if (lab) where.lab = lab;
        if (status) where.status = status;

        const entries = await prisma.labCostEntry.findMany({
            where,
            include: {
                order: {
                    select: {
                        id: true,
                        clientId: true,
                        createdAt: true,
                        client: { select: { name: true } },
                    },
                },
            },
            orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }],
            take: 500,
        });

        const totals = await prisma.labCostEntry.groupBy({
            by: ['status'],
            where: lab ? { lab } : undefined,
            _count: { _all: true },
            _sum: { difference: true },
        });

        // Historial de revisiones diarias (libro de auditoría del control).
        const auditRuns = await prisma.labAuditRun.findMany({
            orderBy: { runAt: 'desc' },
            take: 60,
        });

        return NextResponse.json({ entries, totals, auditRuns });
    } catch (error: any) {
        console.error('[lab-costs GET] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST /api/lab-costs — carga manual de costos facturados (solo ADMIN)
// Body: { rows: [{ lab, labOrderNumber, billed, invoiceDate? }] }
//   ó   { action: 'recheck' } para re-cruzar entradas sin match
//   ó   { action: 'scan-optovision' } para disparar el escaneo IMAP a demanda
export async function POST(request: Request) {
    try {
        const role = request.headers.get('x-user-role') || 'STAFF';
        if (role !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const body = await request.json();

        if (body.action === 'recheck') {
            const result = await LabCostReconciliationService.recheckUnmatched();
            return NextResponse.json({ ok: true, ...result });
        }

        if (body.action === 'scan-optovision') {
            const result = await LabCostReconciliationService.scanOptovisionInbox(body.days || 35);
            return NextResponse.json({ ok: true, ...result });
        }

        if (body.action === 'scan-grupo-optico') {
            const { GrupoOpticoProvider } = await import('@/services/lab-providers/grupo-optico.provider');
            const result = await GrupoOpticoProvider.collect();
            return NextResponse.json({ ok: true, ...result });
        }

        const rows: any[] = Array.isArray(body.rows) ? body.rows : [];
        if (rows.length === 0) {
            return NextResponse.json({ error: 'Sin filas para importar' }, { status: 400 });
        }
        if (rows.length > 1000) {
            return NextResponse.json({ error: 'Máximo 1000 filas por importación' }, { status: 400 });
        }

        const summary = { imported: 0, skipped: 0, overcost: 0, unmatched: 0 };
        for (const row of rows) {
            const labOrderNumber = String(row.labOrderNumber || '').trim();
            const billed = Number(row.billed);
            const lab = String(row.lab || 'GRUPO_OPTICO').trim().toUpperCase();
            if (!labOrderNumber || !Number.isFinite(billed) || billed <= 0) {
                summary.skipped++;
                continue;
            }

            const entry = await LabCostReconciliationService.upsertEntry({
                lab,
                labOrderNumber,
                // La planilla del lab trae un solo importe: se guarda como neto,
                // que es contra lo que se compara (igual que el subtotal del PDF).
                billedNet: billed,
                billedTotal: null,
                source: 'CSV',
                sourceFile: row.sourceFile || null,
                invoiceDate: row.invoiceDate ? new Date(row.invoiceDate) : null,
            });

            if (entry) {
                summary.imported++;
                if (entry.status === 'OVERCOST') summary.overcost++;
                if (entry.status === 'UNMATCHED') summary.unmatched++;
            } else {
                summary.skipped++;
            }
        }

        return NextResponse.json({ ok: true, ...summary });
    } catch (error: any) {
        console.error('[lab-costs POST] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
