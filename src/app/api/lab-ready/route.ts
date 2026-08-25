import { NextResponse } from 'next/server';
import { PricingService } from '@/services/PricingService';
import { prisma } from '@/lib/db';
import { serverCache } from '@/lib/cache';

export const dynamic = 'force-dynamic';

// GET /api/lab-ready — Orders that are 100% in SmartLab but not yet marked as READY in CRM
export async function GET() {
    try {
        const cacheKey = 'lab-ready';
        const cached = serverCache.get<any[]>(cacheKey);
        if (cached !== null) {
            return NextResponse.json(cached);
        }

        const orders = await prisma.order.findMany({
            where: {
                isDeleted: false,
                orderType: 'SALE',
                labStatus: { in: ['FINISHED', 'IN_PROGRESS', 'READY'] },
            },
            select: {
                id: true,
                labOrderNumber: true,
                labStatus: true,
                smartLabSector: true,
                smartLabProgress: true,
                smartLabLastSync: true,
                smartLabEntryDate: true,
                smartLabDays: true,
                smartLabDetails: true,
                labSentAt: true,
                createdAt: true,
                // Para el saldo pendiente de la tarjeta (pedido de Ishtar 25/8:
                // "que se sepa que el pedido tiene saldo" al ir a entregarlo).
                // TODOS los campos que PricingService necesita, payments
                // incluido — sin las filas de pago, el cálculo inventa saldos
                // fantasma (lección de la confirmación de compra).
                total: true,
                paid: true,
                subtotalWithMarkup: true,
                specialDiscount: true,
                markup: true,
                discountCash: true,
                discountTransfer: true,
                payments: { select: { amount: true, method: true } },
                client: { select: { id: true, name: true, phone: true } },
                user: { select: { name: true } },
                items: {
                    select: {
                        productNameSnapshot: true,
                        productBrandSnapshot: true,
                        productCategorySnapshot: true,
                        product: { select: { brand: true, name: true, category: true } },
                    },
                },
            },
            orderBy: { smartLabLastSync: 'desc' },
        });

        const readyOrders = orders.filter(order => {
            if (order.labStatus === 'FINISHED' || order.labStatus === 'READY') return true;
            if (order.labStatus === 'IN_PROGRESS' && order.smartLabDetails) {
                try {
                    const details = JSON.parse(order.smartLabDetails as string);
                    if (Array.isArray(details) && details.length > 1) {
                        return details.some((d: any) => d.progress >= 100);
                    }
                } catch { }
            }
            return false;
        });

        // El SALDO calculado en el servidor (nunca total − pagado: cada pago se
        // convierte a su equivalente de lista — PricingService). Se manda solo
        // el número de lista: alcanza para saber que el pedido tiene saldo al
        // entregarlo, sin cargar el panel de detalles que no pidió nadie.
        const conSaldo = readyOrders.map((o: any) => {
            const fin = PricingService.calculateOrderFinancials(o);
            // Los campos financieros crudos NO viajan al navegador: se piden
            // solo para calcular, y afuera va únicamente el resultado.
            const { payments: _p, total: _t, paid: _pa, subtotalWithMarkup: _s, specialDiscount: _e,
                    markup: _m, discountCash: _dc, discountTransfer: _dt, ...resto } = o;
            return {
                ...resto,
                saldoPendiente: fin.hasBalance ? fin.remainingList : 0,
            };
        });

        serverCache.set(cacheKey, conSaldo, 30); // Cache for 30 seconds

        return NextResponse.json(conSaldo);
    } catch (error: any) {
        console.error('Error fetching lab-ready orders:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
