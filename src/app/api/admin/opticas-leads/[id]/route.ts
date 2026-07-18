import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';
import { canAccessOpticasLeads } from '@/lib/opticas-leads';

export const dynamic = 'force-dynamic';

const VALID_STATUS = ['NUEVO', 'CONTACTADO', 'RESPONDIO', 'CLIENTE', 'BLOCKLIST', 'OCULTO'];

// PATCH /api/admin/opticas-leads/[id] — cambiar estado / notas
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const actor = getActor(request);
    if (!(await canAccessOpticasLeads(actor))) {
        return NextResponse.json({ error: 'Solo Ishtar y Milena pueden ver esta sección.' }, { status: 403 });
    }

    try {
        const { id } = await params;
        const body = await request.json();
        const data: any = {};

        if (body.status !== undefined) {
            if (!VALID_STATUS.includes(body.status)) {
                return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
            }
            data.status = body.status;
            if (body.status === 'CONTACTADO') {
                data.contactedAt = new Date();
                data.contactedBy = actor.name;
            }
        }
        if (body.notes !== undefined) data.notes = body.notes?.toString() || null;
        if (Object.keys(data).length === 0) {
            return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 });
        }

        const lead = await prisma.opticaLead.update({ where: { id }, data });

        logAudit({
            userId: actor.id, userName: actor.name,
            action: data.status ? 'STATUS_CHANGE' : 'UPDATE',
            entityType: 'OPTICA_LEAD', entityId: id,
            details: { name: lead.name, ...data },
        }).catch(console.error);

        return NextResponse.json(lead);
    } catch (e: any) {
        console.error('opticas-leads PATCH error:', e);
        return NextResponse.json({ error: 'Error al actualizar lead' }, { status: 500 });
    }
}
