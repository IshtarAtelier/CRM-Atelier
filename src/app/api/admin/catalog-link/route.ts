import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { canAccessOpticasLeads } from '@/lib/opticas-leads';
import { catalogAccessKey } from '@/lib/wholesale-access';

export const dynamic = 'force-dynamic';

// GET /api/admin/catalog-link — link general del catálogo mayorista.
// Es la única forma de obtener la llave: mismo permiso que el panel de ópticas
// (solo Ishtar y Milena). Si esto se abre, el catálogo vuelve a ser público.
export async function GET(request: NextRequest) {
    const actor = getActor(request);
    if (!(await canAccessOpticasLeads(actor))) {
        return NextResponse.json({ error: 'Solo Ishtar y Milena pueden ver esta sección.' }, { status: 403 });
    }

    try {
        return NextResponse.json({ key: catalogAccessKey() });
    } catch (error) {
        console.error('[catalog-link] no se pudo derivar la llave:', error);
        return NextResponse.json({ error: 'No se pudo generar el link.' }, { status: 500 });
    }
}
