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

        // Período REAL (regla del administrador): mes AAAA-MM elegido, o los
        // últimos 30 días por defecto — el listado, las tarjetas de resumen y
        // la cobertura nunca suman todo el histórico.
        const periodo = searchParams.get('periodo');
        let desde: Date, hasta: Date;
        if (periodo && /^\d{4}-\d{2}$/.test(periodo)) {
            const [y, m] = periodo.split('-').map(Number);
            desde = new Date(Date.UTC(y, m - 1, 1));
            hasta = new Date(Date.UTC(y, m, 1));
        } else {
            hasta = new Date();
            desde = new Date(Date.now() - 30 * 86400000);
        }
        // La "fecha" de una entrada es la de su factura; si todavía no tiene
        // factura, la fecha en que se registró el pedido.
        const enPeriodo = {
            OR: [
                { invoiceDate: { gte: desde, lt: hasta } },
                { invoiceDate: null, createdAt: { gte: desde, lt: hasta } },
            ],
        };

        const entries = await prisma.labCostEntry.findMany({
            where: { AND: [where, enPeriodo] },
            include: {
                order: {
                    select: {
                        id: true,
                        clientId: true,
                        createdAt: true,
                        labStatus: true,
                        client: { select: { name: true } },
                        // Ítems para mostrar QUÉ producto es y linkear a su ficha
                        // (poder revisar/ajustar el costo desde la conciliación).
                        items: {
                            select: {
                                eye: true,
                                productId: true,
                                productNameSnapshot: true,
                                productBrandSnapshot: true,
                                productCategorySnapshot: true,
                                productCostSnapshot: true,
                                laboratorySnapshot: true,
                                product: { select: { id: true, name: true, model: true, brand: true, cost: true, category: true, laboratory: true } },
                            },
                        },
                    },
                },
            },
            orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }],
            take: 500,
        });

        // Resumen de productos por entrada: solo los ítems del laboratorio de esa
        // entrada (cristales), dedup por producto, con nombre, id (link) y costo.
        const LAB_PAT: Record<string, RegExp> = {
            OPTOVISION: /optovision/i, GRUPO_OPTICO: /grupo[\s\-]?[oó]ptico/i,
        };
        const entriesConProductos = entries.map((e: any) => {
            const pat = LAB_PAT[e.lab];
            const items: any[] = e.order?.items || [];
            const labItems = pat ? items.filter(i => pat.test(i.laboratorySnapshot || i.product?.laboratory || '')) : [];
            const rel = labItems.length ? labItems : items.filter(i => /cristal/i.test(i.productCategorySnapshot || i.product?.category || ''));
            const byId = new Map<string, any>();
            for (const i of (rel.length ? rel : items)) {
                const pid = i.productId || i.product?.id || null;
                const nombre = i.productNameSnapshot || i.product?.model || i.product?.name || 'Producto';
                const marca = i.productBrandSnapshot || i.product?.brand || '';
                const costo = i.productCostSnapshot ?? i.product?.cost ?? null;
                const k = pid || nombre;
                if (!byId.has(k)) byId.set(k, { productId: pid, nombre, marca, costo });
            }
            const productos = [...byId.values()];
            const { items: _omit, ...orderRest } = e.order || {};
            return { ...e, order: e.order ? orderRest : null, productos };
        });

        // Tarjetas de resumen: SIEMPRE del período filtrado, por lab Y por tipo
        // de situación (dos cuadros en la pantalla, uno por laboratorio). No se
        // les aplica el filtro de lab: los dos cuadros se ven completos siempre.
        const totals = await prisma.labCostEntry.groupBy({
            by: ['lab', 'status'],
            where: enPeriodo,
            _count: { _all: true },
            _sum: { difference: true },
        });

        // Historial de revisiones diarias (libro de auditoría del control).
        const auditRuns = await prisma.labAuditRun.findMany({
            orderBy: { runAt: 'desc' },
            take: 60,
        });

        // Cuenta corriente por lab: último resumen de cuenta recibido (deuda
        // viva), con el cruce factura → venta/postventa recalculado EN VIVO
        // (las facturas y ventas pueden entrar después del snapshot).
        const statementsRaw = await prisma.labAccountStatement.findMany({
            orderBy: { statementDate: 'desc' },
            distinct: ['lab'],
        });
        const statements = await Promise.all(statementsRaw.map(async (s) => {
            const cruce = await LabCostReconciliationService
                .crossStatementRows(s.lab, (s.rows as any[]) || [])
                .catch(() => null);
            return cruce
                ? { ...s, rows: cruce.rows, conVenta: cruce.conVenta, conPostventa: cruce.conPostventa, sinGemelo: cruce.sinGemelo }
                : s;
        }));

        // Cobertura por lab: cuántos pedidos registrados tienen su gemelo en el
        // sistema (venta o postventa) y cuántos quedaron huérfanos. Es el cuadro
        // de "todo cubierto": para Grupo Óptico (sin resumen de cuenta) el barrido
        // del portal trae TODOS los pedidos, así que esta ES su cuenta corriente.
        // También acotada al período (no suma todo el histórico).
        const coberturaEntries = await prisma.labCostEntry.findMany({
            where: enPeriodo,
            select: { lab: true, orderId: true, notes: true, status: true },
        });
        const cobertura: Record<string, { total: number; conVenta: number; postventa: number; sinVenta: number; esperandoFactura: number }> = {};
        for (const e of coberturaEntries) {
            const c = (cobertura[e.lab] ||= { total: 0, conVenta: 0, postventa: 0, sinVenta: 0, esperandoFactura: 0 });
            c.total++;
            if (!e.orderId) c.sinVenta++;
            else if (e.notes?.includes('POSTVENTA (caso')) c.postventa++;
            else c.conVenta++;
            if (e.status === 'PENDING') c.esperandoFactura++;
        }

        return NextResponse.json({
            entries: entriesConProductos, totals, auditRuns, statements, cobertura,
            periodo: { desde, hasta, mes: periodo && /^\d{4}-\d{2}$/.test(periodo) ? periodo : null },
        });
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
