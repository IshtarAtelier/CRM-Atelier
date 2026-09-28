import { NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/api-guard';
import { arrepentimientoSchema, validateBody } from '@/lib/validation';
import { generarCodigoTramite, registrarArrepentimiento } from '@/services/arrepentimiento.service';

/**
 * Botón de arrepentimiento (formulario público de /arrepentimiento).
 *
 * Público y sin login (el middleware deja pasar /api/web/). La ruta valida y
 * llama al service; la lógica vive en src/services/arrepentimiento.service.ts.
 * Responde lo mismo exista o no el pedido: no revela qué números son reales.
 */
export async function POST(req: Request) {
    // Anti-abuso: 3 solicitudes por minuto por IP alcanzan para una persona.
    const limitado = enforceRateLimit(req, 'web-arrepentimiento', { limit: 3, windowMs: 60_000 });
    if (limitado) return limitado;

    const cuerpo = await req.json().catch(() => null);
    const validado = validateBody(arrepentimientoSchema, cuerpo);
    if (!validado.success) return NextResponse.json({ error: validado.error }, { status: 400 });
    const { numeroPedido, email, motivo, sitio } = validado.data;

    // Campo trampa completado = robot. Se le responde igual que a una persona,
    // pero no se registra ni se avisa a nadie.
    if (sitio) {
        return NextResponse.json({ ok: true, codigo: generarCodigoTramite(new Date()) });
    }

    try {
        const { codigo, recibidoEn } = await registrarArrepentimiento({ numeroPedido, email, motivo });
        return NextResponse.json({ ok: true, codigo, recibidoEn: recibidoEn.toISOString() });
    } catch (error) {
        console.error('[Arrepentimiento] No se pudo registrar la solicitud:', error);
        return NextResponse.json(
            { error: 'No pudimos registrar tu solicitud. Probá de nuevo en unos minutos o escribinos por WhatsApp.' },
            { status: 500 },
        );
    }
}
