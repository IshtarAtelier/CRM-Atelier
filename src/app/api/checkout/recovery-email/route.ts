import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { enforceRateLimit } from '@/lib/api-guard';
import { sendRecoveryEmailForSession } from '@/lib/checkout/recovery';

export async function POST(req: Request) {
  try {
    // Con tope, como sus vecinas de /api/checkout. Esta ruta pasa sin sesión
    // (el bypass del checkout) y manda un mail CON LA MARCA a la dirección
    // guardada en la sesión: sin límite, alcanza con crear sesiones con el mail
    // de cualquiera y dispararlas en bucle para spamear desde nuestro dominio y
    // quemarle la reputación al remitente. No es una fuga de datos; es la
    // casilla desde la que salen los avisos de las ventas.
    const limitado = enforceRateLimit(req, 'recovery-email', { limit: 10, windowMs: 10 * 60 * 1000 });
    if (limitado) return limitado;

    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID requerido' }, { status: 400 });
    }

    const session = await prisma.checkoutSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 });
    }

    if (!session.email) {
      return NextResponse.json({ error: 'El cliente no tiene email registrado' }, { status: 400 });
    }

    const result = await sendRecoveryEmailForSession(session);

    if (result.skipped === 'purchased') {
      return NextResponse.json({
        error: 'Este cliente ya tiene una compra confirmada o vendida. No se envió el email.'
      }, { status: 409 });
    }

    if (result.sent) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Error al enviar el email' }, { status: 500 });
  } catch (error: any) {
    console.error('[Recovery Email] Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
