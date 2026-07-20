import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Formato de email razonable: evita inyectar direcciones basura/malformadas que
// después el cron de carritos abandonados usaría para mandar emails brandeados.
const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { email, firstName, lastName, phone, cartData } = data;

    if (email && !isValidEmail(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
    }

    // Create a new CheckoutSession in the database
    const session = await prisma.checkoutSession.create({
      data: {
        email: email || '',
        firstName: firstName || '',
        lastName: lastName || '',
        phone: phone || '',
        cartData: cartData || {},
        total: data.total || 0,
        status: 'PENDING'
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
    const data = await req.json();
    const { sessionId, email, firstName, lastName, phone, cartData, shippingData, total, status } = data;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const updateData: any = {};
    if (email !== undefined) updateData.email = email;
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (phone !== undefined) updateData.phone = phone;
    if (cartData !== undefined) updateData.cartData = cartData;
    if (shippingData !== undefined) updateData.shippingData = shippingData;
    if (total !== undefined) updateData.total = total;
    if (status !== undefined) updateData.status = status;

    const session = await prisma.checkoutSession.update({
      where: { id: sessionId },
      data: updateData
    });

    return NextResponse.json({ success: true, session });
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
