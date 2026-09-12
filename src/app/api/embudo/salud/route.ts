import { NextResponse } from 'next/server';
import { saludDelEmbudo } from '@/lib/seguimientos/salud';

export const dynamic = 'force-dynamic';

/** Salud del embudo (últimos 7 días). Requiere sesión (middleware). La consume /admin/leads/salud. */
export async function GET(request: Request) {
    const dias = Math.min(Math.max(Number(new URL(request.url).searchParams.get('dias')) || 7, 1), 30);
    try {
        return NextResponse.json(await saludDelEmbudo(dias));
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
