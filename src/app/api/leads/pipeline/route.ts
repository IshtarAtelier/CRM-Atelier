import { NextResponse } from 'next/server';
import { EmbudoService } from '@/services/embudo.service';

export const dynamic = 'force-dynamic';

// GET /api/leads/pipeline — el tablero del embudo (/admin/leads).
//
// La ruta solo responde: qué es un lead, en qué columna cae y qué toca hacer
// hoy lo decide EmbudoService (src/services/embudo.service.ts), que es el
// mismo que alimenta el resumen diario del equipo. Antes toda esa lógica vivía
// acá adentro y el resumen no podía reusarla sin copiarla.
export async function GET() {
  try {
    const tablero = await EmbudoService.tablero();
    return NextResponse.json({ success: true, ...tablero });
  } catch (error: any) {
    console.error('[API Leads Pipeline] Error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
