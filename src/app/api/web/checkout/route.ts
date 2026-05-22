import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { customerName, whatsapp, productId, totalPrice, lensType, treatment, tintColor } = body;

        if (!customerName || !whatsapp) {
            return NextResponse.json({ error: 'Faltan datos del cliente' }, { status: 400 });
        }

        // 1. Buscar o Crear Cliente
        let client = await prisma.client.findFirst({
            where: { phone: whatsapp }
        });

        if (!client) {
            client = await prisma.client.create({
                data: {
                    name: customerName,
                    phone: whatsapp,
                    status: 'CONTACT',
                    contactSource: 'WEB',
                    interest: 'Lentes Receta Web'
                }
            });
        }

        // 2. Obtener un Usuario Vendedor (Admin)
        // Como es una venta automatizada por la web, se la asignamos al admin principal
        const adminUser = await prisma.user.findFirst({
            where: { role: 'ADMIN' }
        });

        if (!adminUser) {
            throw new Error('No se encontró un usuario ADMIN para asignar la venta web');
        }

        // 3. Crear Orden
        const orderNotes = `Pedido Web\nCristales: ${lensType} ${treatment ? '- ' + treatment : ''}\nTinte: ${tintColor || 'Ninguno'}`;

        const order = await prisma.order.create({
            data: {
                clientId: client.id,
                userId: adminUser.id,
                status: 'PENDING',
                orderType: 'SALE',
                total: totalPrice,
                paid: 0,
                labNotes: orderNotes,
                items: {
                    create: [
                        {
                            productId: productId || undefined, // Si viene armazón, lo vinculamos
                            quantity: 1,
                            price: totalPrice, // Por ahora englobamos el precio total acá
                        }
                    ]
                }
            }
        });

        return NextResponse.json({ success: true, orderId: order.id });
    } catch (error: any) {
        console.error('Error in web checkout:', error);
        return NextResponse.json({ error: 'Error procesando el checkout', details: error.message }, { status: 500 });
    }
}
