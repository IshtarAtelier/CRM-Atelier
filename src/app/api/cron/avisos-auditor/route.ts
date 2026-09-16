import { NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { auditarAvisos, etiqueta } from '@/services/avisos-auditor.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * AUDITOR DE AVISOS AUTOMÁTICOS.
 *
 * Revisa que los tres avisos que el cliente espera —confirmación de compra,
 * pedido procesado con la fecha estimada, y listo para retirar— hayan llegado
 * DE VERDAD a la conversación, y redispara los que no. El porqué y las reglas
 * están en `avisos-auditor.service.ts`.
 *
 * Alta en cron-job.org: GET cada 2 h a
 *   /api/cron/avisos-auditor?secret=CRON_SECRET
 *
 * Parámetros opcionales:
 *   &dias=N    ventana a revisar (default 30). Nunca mira antes del día en que
 *              el auditor entró en servicio (`AUDITA_DESDE`): el atraso viejo se
 *              revisa a mano con el check, no lo redispara un cron.
 *   &modo=seco corrida de prueba: informa sin mandar nada, aunque el sistema
 *              esté en 'real'. Al revés NO se puede: prender los envíos es una
 *              decisión que se toma en la base (SystemSetting
 *              `auditor_avisos_modo`), no en una URL que cualquiera puede armar.
 *
 * Como los otros crons nuevos, no manda mail de "todo bien": el resultado está
 * en la respuesta y en el log. Solo escribe al equipo cuando un aviso no se
 * pudo reenviar, que es lo único que necesita una mano humana.
 */
export async function GET(request: Request) {
    try {
        const auth = verifyCronAuth(request);
        if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

        const { searchParams } = new URL(request.url);
        const dias = parseInt(searchParams.get('dias') || '', 10);
        const forzarSeco = searchParams.get('modo') === 'seco';

        const r = await auditarAvisos({
            dias: Number.isFinite(dias) && dias > 0 ? dias : undefined,
            ...(forzarSeco ? { modo: 'seco' as const } : {}),
        });

        console.log(
            `[Auditor de avisos] modo=${r.modo} ventas=${r.ventasRevisadas} faltantes=${r.faltantes.length} ` +
            `reenviados=${r.reenviados} fallidos=${r.fallidos} postergados=${r.postergados} viejos=${r.viejos}`,
        );

        return NextResponse.json({
            ok: true,
            modo: r.modo,
            ventasRevisadas: r.ventasRevisadas,
            faltantes: r.faltantes.length,
            reenviados: r.reenviados,
            fallidos: r.fallidos,
            postergados: r.postergados,
            // Faltantes de más de 24 h: se informan, nunca se reenvían solos.
            viejos: r.viejos,
            detalle: r.faltantes.map(f => ({
                pedido: f.nro,
                cliente: f.clientName,
                aviso: etiqueta(f.tipo),
                viejo: !!f.viejo,
                desde: f.desde,
                reenvio: f.reenvio || null,
            })),
        });
    } catch (error: any) {
        console.error('[Auditor de avisos] Error:', error?.message);
        return NextResponse.json({ error: error?.message || 'Error inesperado' }, { status: 500 });
    }
}
