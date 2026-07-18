import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';
import { canAccessOpticasLeads, normalizePhoneWa } from '@/lib/opticas-leads';

export const dynamic = 'force-dynamic';

function unauthorized() {
    return NextResponse.json({ error: 'Solo Ishtar y Milena pueden ver esta sección.' }, { status: 403 });
}

// GET /api/admin/opticas-leads — listado con filtros + stats
export async function GET(request: NextRequest) {
    const actor = getActor(request);
    if (!(await canAccessOpticasLeads(actor))) return unauthorized();

    try {
        const sp = request.nextUrl.searchParams;
        const status = sp.get('status') || '';
        const city = sp.get('city') || '';
        const q = sp.get('q') || '';
        const minRating = Number(sp.get('minRating') || 0);
        const onlyWa = sp.get('onlyWa') === '1';
        const page = Math.max(1, Number(sp.get('page') || 1));
        const limit = Math.min(200, Number(sp.get('limit') || 100));

        const where: any = {};
        if (status) where.status = status;
        else where.status = { not: 'OCULTO' };
        if (city) where.city = { contains: city, mode: 'insensitive' };
        if (minRating > 0) where.rating = { gte: minRating };
        if (onlyWa) where.phoneWa = { not: null };
        if (q) {
            where.OR = [
                { name: { contains: q, mode: 'insensitive' } },
                { address: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q } },
            ];
        }

        const [leads, totalCount, stats] = await Promise.all([
            prisma.opticaLead.findMany({
                where,
                orderBy: [{ createdAt: 'desc' }],
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.opticaLead.count({ where }),
            prisma.opticaLead.groupBy({ by: ['status'], _count: { _all: true } }),
        ]);

        const [total, conWa] = await Promise.all([
            prisma.opticaLead.count(),
            prisma.opticaLead.count({ where: { phoneWa: { not: null } } }),
        ]);
        const byStatus: Record<string, number> = {};
        for (const s of stats) byStatus[s.status] = s._count._all;

        return NextResponse.json({
            leads,
            totalCount,
            page,
            totalPages: Math.max(1, Math.ceil(totalCount / limit)),
            stats: { total, conWa, byStatus },
        });
    } catch (e: any) {
        console.error('opticas-leads GET error:', e);
        return NextResponse.json({ error: 'Error al listar leads' }, { status: 500 });
    }
}

// POST /api/admin/opticas-leads — importación masiva (scraper o CSV).
// Body: { leads: [{ name, phone?, rating?, reviewsCount?, category?, address?,
//                   city?, province?, mapsUrl?, placeId?, website?, instagram? }], source? }
// Dedup por placeId y por phoneWa: si ya existe, actualiza datos pero NUNCA
// pisa status/notes (para no perder el trabajo de contacto hecho).
export async function POST(request: NextRequest) {
    const actor = getActor(request);
    if (!(await canAccessOpticasLeads(actor))) return unauthorized();

    try {
        const body = await request.json();
        const rows: any[] = Array.isArray(body.leads) ? body.leads : [];
        const source = typeof body.source === 'string' ? body.source : 'manual';
        if (rows.length === 0) return NextResponse.json({ error: 'Sin leads en el body' }, { status: 400 });
        if (rows.length > 5000) return NextResponse.json({ error: 'Máximo 5000 leads por importación' }, { status: 400 });

        let created = 0, updated = 0, skipped = 0;
        for (const r of rows) {
            const name = (r.name || '').toString().trim();
            if (!name) { skipped++; continue; }
            const phoneWa = normalizePhoneWa(r.phone);
            const data = {
                name,
                phone: r.phone?.toString().trim() || null,
                phoneWa,
                rating: r.rating != null && !isNaN(Number(r.rating)) ? Number(r.rating) : null,
                reviewsCount: r.reviewsCount != null && !isNaN(Number(r.reviewsCount)) ? Number(r.reviewsCount) : null,
                category: r.category?.toString().trim() || null,
                address: r.address?.toString().trim() || null,
                city: r.city?.toString().trim() || null,
                province: r.province?.toString().trim() || null,
                mapsUrl: r.mapsUrl?.toString().trim() || null,
                placeId: r.placeId?.toString().trim() || null,
                website: r.website?.toString().trim() || null,
                instagram: r.instagram?.toString().trim() || null,
                source,
            };

            // Dedup: primero por placeId (estable), después por teléfono normalizado
            const existing = await prisma.opticaLead.findFirst({
                where: {
                    OR: [
                        ...(data.placeId ? [{ placeId: data.placeId }] : []),
                        ...(phoneWa ? [{ phoneWa }] : []),
                    ],
                },
            });
            if (existing) {
                await prisma.opticaLead.update({
                    where: { id: existing.id },
                    // No tocar status / notes / contactedAt: son trabajo humano
                    data: { ...data, placeId: data.placeId ?? existing.placeId },
                });
                updated++;
            } else {
                await prisma.opticaLead.create({ data });
                created++;
            }
        }

        logAudit({
            userId: actor.id, userName: actor.name,
            action: 'CREATE', entityType: 'OPTICA_LEAD', entityId: 'bulk-import',
            details: { source, created, updated, skipped, total: rows.length },
        }).catch(console.error);

        return NextResponse.json({ created, updated, skipped });
    } catch (e: any) {
        console.error('opticas-leads POST error:', e);
        return NextResponse.json({ error: 'Error al importar leads' }, { status: 500 });
    }
}
