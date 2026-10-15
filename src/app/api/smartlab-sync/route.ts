import { NextResponse } from 'next/server';
import { correrSeguimiento } from '@/services/lab-modules/corrida';
import { MODULO_GRUPO_OPTICO } from '@/services/lab-modules/grupo-optico/modulo';

/**
 * El botón "Sync SmartLab" de /admin/ventas y /admin/pedidos. Corre el módulo
 * de Grupo Óptico con el turno del portal: si otra pasada lo tiene (el tick de
 * 10 min o la diaria de costos), no se abre un segundo Chromium contra el
 * portal y se responde `skipped` con 200. Ya no se dispara solo al abrir la
 * pantalla (3/10/2026): cada apertura lanzaba un navegador contra el portal.
 */
export async function POST() {
    try {
        const result = await correrSeguimiento(MODULO_GRUPO_OPTICO, { sinceDays: 21 });
        if (result.skipped) {
            return NextResponse.json({ success: true, skipped: true, reason: result.reason });
        }
        if (!result.ok) {
            return NextResponse.json({ error: result.error || 'El seguimiento de Grupo Óptico falló.' }, { status: 500 });
        }
        const s = result.seguimiento!;
        return NextResponse.json({
            success: true,
            ...result,
            // Lo que muestra el botón: "N sync · M nuevos".
            matched: s.vistos,
            newlyFinished: s.terminados,
        });
    } catch (error: any) {
        console.error('[SmartLab Sync] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Error interno al sincronizar con SmartLab.' },
            { status: 500 }
        );
    }
}
