import { NextResponse } from 'next/server';
import { ContactService } from '@/services/contact.service';

export const dynamic = 'force-dynamic';

// GET /api/contacts/attention-count
// Cantidad de contactos sin atender (sin presupuesto ni venta) — badge del sidebar
// y contador del filtro "Sin atender". Definición centralizada en ContactService.
export async function GET() {
    try {
        const count = await ContactService.getUnattendedCount();
        return NextResponse.json({ count });
    } catch (error: any) {
        console.error('[CONTACTS ATTENTION COUNT] Error:', error);
        return NextResponse.json({ count: 0 }, { status: 500 });
    }
}
