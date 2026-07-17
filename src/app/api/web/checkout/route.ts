import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { snapshotFromProduct } from '@/lib/order-snapshot';
import { ContactService, normalizeArgentinePhone } from '@/services/contact.service';
import { notifyZeroCostSale } from '@/lib/zero-cost-alert';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { customerName, whatsapp, productId, totalPrice, lensType, treatment, tintColor } = body;

        if (!customerName || !whatsapp) {
            return NextResponse.json({ error: 'Faltan datos del cliente' }, { status: 400 });
        }

        // 1. Buscar o Crear Cliente
        const normalizedPhone = normalizeArgentinePhone(whatsapp);

        let client = await prisma.client.findFirst({
            where: { phone: normalizedPhone }
        });

        if (!client) {
            try {
                client = await ContactService.create({
                    name: customerName,
                    phone: normalizedPhone,
                    contactSource: 'WEB',
                    interest: 'Lentes Receta Web'
                });
            } catch (error: any) {
                try {
                    const parsedError = JSON.parse(error.message);
                    if (parsedError.isDuplicate && parsedError.existingClient) {
                        client = await ContactService.update(parsedError.existingClient.id, {
                            contactSource: 'WEB',
                            interest: 'Lentes Receta Web'
                        });
                    } else {
                        throw error;
                    }
                } catch (e) {
                    throw error;
                }
            }
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

        // Foto del producto para la línea de venta: si vino un armazón, la tomamos de él;
        // si no, describimos los cristales. Así el "Pedido Web" conserva qué se vendió aunque
        // el producto se borre o renombre después (mismo criterio que los demás canales).
        const dbFrame = productId ? await prisma.product.findUnique({ where: { id: productId } }) : null;
        const webLineName = `Cristales ${lensType || ''}${treatment ? ' - ' + treatment : ''}`.trim();

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
                            ...snapshotFromProduct(dbFrame, { name: webLineName, category: 'Cristal' }),
                            quantity: 1,
                            price: totalPrice, // Por ahora englobamos el precio total acá
                        }
                    ]
                }
            }
        });

        // Red de seguridad: avisar si alguna línea quedó con costo $0.
        notifyZeroCostSale(order.id).catch(err => console.error('Error en alerta de costo $0 (checkout web):', err));

        return NextResponse.json({ success: true, orderId: order.id });
    } catch (error: any) {
        console.error('Error in web checkout:', error);
        return NextResponse.json({ error: 'Error procesando el checkout', details: error.message }, { status: 500 });
    }
}
