import { NextResponse } from 'next/server';

/**
 * Broadcast masivo de seguimientos de cierre — DADO DE BAJA.
 *
 * Lo que hacía: lanzaba `scripts/broadcast-followup.ts` con `npx tsx` en
 * segundo plano y contestaba "🚀 Bot de seguimiento masivo iniciado".
 *
 * Por qué se da de baja, y no se arregla:
 *
 *  1. No funcionaba. La respuesta era una mentira estructural: `spawn` no
 *     espera nada, así que la ruta contestaba "iniciado" pasara lo que pasara.
 *     Y en producción no podía andar — el contenedor corre el build standalone
 *     de Next (`node server.js`), donde no está la carpeta `scripts/` ni `tsx`.
 *     Un cron externo apuntándole veía 200 y nadie recibía nada.
 *
 *  2. No vuelve. El script mandaba texto libre por WhatsApp a gente que no
 *     había escrito. Con la API oficial eso fuera de la ventana de 24 h solo
 *     entra como plantilla aprobada, y la decisión del 18/8/2026 fue que los
 *     seguimientos proactivos por IA no vuelven (docs/plan-whatsapp-api-oficial.md,
 *     C7: "SE VA"). Los seguimientos los hace una persona desde el embudo
 *     (/admin/leads) y desde Oportunidades de Cierre.
 *
 * Queda la ruta —en vez de borrarla— devolviendo 410 para que, si hay un
 * despertador externo todavía apuntando acá, falle FUERTE y con motivo en vez
 * de recibir un 200 alegre o un 404 mudo.
 */
export async function GET() {
    return NextResponse.json(
        {
            status: 'gone',
            message: 'El broadcast masivo de seguimientos por WhatsApp está dado de baja. Los seguimientos se hacen desde /admin/leads y Oportunidades de Cierre. Si esto lo llamó un cron externo, hay que darlo de baja.',
        },
        { status: 410 },
    );
}
