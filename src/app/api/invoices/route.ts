import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';

// POST /api/invoices — Create invoice for an order (ARCA Factura C)
export async function POST(request: Request) {
    try {
        // Only ADMIN can create invoices
        const headersList = await headers();
        const role = headersList.get('x-user-role') || 'STAFF';
        if (role !== 'ADMIN') {
            return NextResponse.json({ error: 'Solo el administrador puede emitir facturas. Solicitá la factura desde el panel de ventas.' }, { status: 403 });
        }

        const body = await request.json();
        const { orderId, pointOfSale, docType, docNumber } = body;

        if (!orderId || !pointOfSale) {
            return NextResponse.json({ error: 'orderId y pointOfSale son requeridos' }, { status: 400 });
        }

        // Check order exists
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: {
                id: true,
                total: true,
                orderType: true,
                isDeleted: true,
                client: { select: { id: true, name: true, phone: true, dni: true } },
                items: {
                    select: {
                        id: true, quantity: true, price: true,
                        product: { select: { id: true, name: true, brand: true, model: true } }
                    }
                },
            },
        });

        if (!order) {
            return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
        }

        // Check no existing invoice
        const existing = await prisma.invoice.findFirst({
            where: { orderId, status: 'COMPLETED' },
        });
        if (existing) {
            return NextResponse.json({ error: 'Esta orden ya tiene una factura emitida' }, { status: 409 });
        }

        // ── ARCA connection ──
        // Try to call ARCA service. If not configured, create a placeholder invoice.
        let cae = '';
        let caeExpiration = '';
        let voucherNumber = 0;

        try {
            // Try calling the ARCA billing service
            const arcaRes = await fetch('http://localhost:3200/api/facturar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pointOfSale,
                    voucherType: 11, // Factura C
                    concept: 1, // Productos
                    docType: docType || 99,
                    docNumber: docNumber || '0',
                    total: order.total,
                    items: order.items.map((i: any) => ({
                        description: `${i.product?.brand || ''} ${i.product?.model || i.product?.name || 'Producto'}`.trim(),
                        quantity: i.quantity,
                        unitPrice: i.price,
                        total: i.quantity * i.price,
                    })),
                }),
                signal: AbortSignal.timeout(15000),
            });

            if (arcaRes.ok) {
                const arcaData = await arcaRes.json();
                cae = arcaData.cae || arcaData.CAE || '';
                caeExpiration = arcaData.caeExpiration || arcaData.CAEFchVto || '';
                voucherNumber = arcaData.voucherNumber || arcaData.CbteDesde || 0;
            } else {
                const errText = await arcaRes.text();
                return NextResponse.json({ error: `Error ARCA: ${errText}` }, { status: 502 });
            }
        } catch (arcaErr: any) {
            // ARCA service not available — return error
            return NextResponse.json({
                error: 'Servicio ARCA no disponible. Verificá que el microservicio de facturación esté corriendo en puerto 3200.',
            }, { status: 503 });
        }

        // Save invoice in DB
        const invoice = await prisma.invoice.create({
            data: {
                orderId,
                cae,
                caeExpiration,
                voucherNumber,
                voucherType: 11,
                pointOfSale,
                concept: 1,
                totalAmount: order.total,
                docType: docType || 99,
                docNumber: docNumber || '0',
                status: 'COMPLETED',
            },
        });

        return NextResponse.json(invoice);
    } catch (error: any) {
        console.error('Error creating invoice:', error);
        return NextResponse.json({ error: error.message || 'Error al crear factura' }, { status: 500 });
    }
}

// GET /api/invoices — List all invoices
export async function GET() {
    try {
        const invoices = await prisma.invoice.findMany({
            select: {
                id: true,
                cae: true,
                caeExpiration: true,
                voucherNumber: true,
                voucherType: true,
                pointOfSale: true,
                totalAmount: true,
                status: true,
                billingAccount: true,
                createdAt: true,
                orderId: true,
                order: {
                    select: {
                        id: true,
                        total: true,
                        client: { select: { name: true, phone: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json(invoices);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
