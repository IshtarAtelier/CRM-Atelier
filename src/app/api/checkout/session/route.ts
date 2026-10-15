import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limiter';
import { ESTADO_ROBOT, esCompradorRobot } from '@/lib/checkout/robots';
import { emailValido } from '@/lib/checkout/email';
import { telefonoADigitos, telefonoValido } from '@/lib/checkout/telefono';

// Formato de email razonable: evita inyectar direcciones basura/malformadas que
// después el cron de carritos abandonados usaría para mandar emails brandeados.
// La misma regla (`emailValido`) la usa el navegador para no mandar un email a
// medio tipear.

// IP del cliente (primer segmento del XFF). Solo para rate-limit, no para auth.
const clientIp = (req: Request) => (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();

const ESTADOS_QUE_LLEGAN_DE_AFUERA: readonly unknown[] = ['COMPLETED', 'RECOVERED'];

export async function POST(req: Request) {
  try {
    // Endpoint PÚBLICO (el middleware lo deja pasar sin sesión, ver
    // `isCheckoutBypass` en src/middleware.ts): hay que acotarlo por IP para que
    // nadie inyecte cientos de emails de víctimas que después el cron de
    // carritos abandonados persigue con mails y WhatsApp con la marca de
    // Atelier. Sin este límite el dominio propio queda de vector de spam.
    const rl = checkRateLimit(`checkout-session-${clientIp(req)}`, { limit: 10, windowMs: 10 * 60 * 1000 });
    if (!rl.success) {
      return NextResponse.json({ error: 'Demasiadas solicitudes. Probá de nuevo en unos minutos.' }, { status: 429 });
    }

    const data = await req.json();
    const { firstName, lastName, phone, cartData } = data;
    // Sin espacios de más: un mail con un espacio al final no es inválido, es el
    // mismo mail (los teclados de celular lo agregan al usar una sugerencia).
    const email = typeof data.email === 'string' ? data.email.trim() : data.email;

    if (email && !emailValido(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
    }
    // El WhatsApp alcanza SOLO para abrir la sesión de recupero (plan
    // 15/10/2026, 3.1): es el primer campo del checkout y con él el equipo ya
    // tiene a quién escribirle. Pero tiene que ser un número de verdad, y se
    // guarda en dígitos: un "35" a medio tipear no abre nada.
    const telefono = typeof phone === 'string' && telefonoValido(phone) ? telefonoADigitos(phone) : '';
    if (phone && !telefono) {
      return NextResponse.json({ error: 'Teléfono inválido' }, { status: 400 });
    }
    if (!telefono && !email) {
      return NextResponse.json({ error: 'Hace falta un WhatsApp o un email' }, { status: 400 });
    }

    // Create a new CheckoutSession in the database
    const session = await prisma.checkoutSession.create({
      data: {
        email: email || '',
        firstName: firstName || '',
        lastName: lastName || '',
        phone: telefono,
        cartData: cartData || {},
        total: data.total || 0,
        // El robot de Google se guarda aparte: ver src/lib/checkout/robots.ts.
        status: esCompradorRobot(email) ? ESTADO_ROBOT : 'PENDING'
      }
    });

    return NextResponse.json({ success: true, sessionId: session.id });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    // También público. El límite es más alto que el del POST porque el checkout
    // actualiza la sesión a medida que la persona completa el formulario.
    const rl = checkRateLimit(`checkout-session-put-${clientIp(req)}`, { limit: 30, windowMs: 10 * 60 * 1000 });
    if (!rl.success) {
      return NextResponse.json({ error: 'Demasiadas solicitudes. Probá de nuevo en unos minutos.' }, { status: 429 });
    }

    const data = await req.json();
    const { sessionId, firstName, lastName, phone, cartData, shippingData, total, status } = data;
    const email = typeof data.email === 'string' ? data.email.trim() : data.email;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    if (email !== undefined && email && !emailValido(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
    }
    // Mismo criterio que el POST: un teléfono que viene, viene válido y en dígitos.
    if (phone !== undefined && phone && !telefonoValido(String(phone))) {
      return NextResponse.json({ error: 'Teléfono inválido' }, { status: 400 });
    }

    const updateData: any = {};
    if (email !== undefined) updateData.email = email;
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (phone !== undefined) updateData.phone = phone ? telefonoADigitos(String(phone)) : phone;
    if (cartData !== undefined) updateData.cartData = cartData;
    if (shippingData !== undefined) updateData.shippingData = shippingData;
    if (total !== undefined) updateData.total = total;
    // Es una ruta pública y el id de la sesión viaja en el link del mail de
    // recupero: solo se aceptan los dos estados que de verdad se mandan (el
    // checkout al pagar, el panel de carritos al marcarlo recuperado).
    if (status !== undefined) {
      if (!ESTADOS_QUE_LLEGAN_DE_AFUERA.includes(status)) {
        return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
      }
      updateData.status = status;
    }

    // Un checkout del robot de Google no pasa a carrito de persona, ni aunque
    // el navegador mande otro estado (ver src/lib/checkout/robots.ts).
    const actual = await prisma.checkoutSession.findUnique({ where: { id: sessionId }, select: { status: true, email: true } });
    if (actual?.status === ESTADO_ROBOT || esCompradorRobot(email ?? actual?.email)) updateData.status = ESTADO_ROBOT;

    // No se devuelve la fila: tiene nombre, teléfono, email y dirección, y
    // cualquiera que tenga el id (el link del mail de recupero lo lleva) podía
    // leerlos con un PUT vacío. Nadie usaba la respuesta.
    await prisma.checkoutSession.update({
      where: { id: sessionId },
      data: updateData,
      select: { id: true },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating checkout session:', error);
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    // Only return PENDING sessions
    const sessions = await prisma.checkoutSession.findMany({
      where: {
        status: 'PENDING'
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    return NextResponse.json(sessions);
  } catch (error: any) {
    console.error('Error fetching checkout sessions:', error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}
