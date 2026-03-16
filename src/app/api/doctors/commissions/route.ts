import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { PLATFORM_COMMISSIONS, DOCTOR_COMMISSION_RATE } from '@/lib/constants';


export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const doctor = searchParams.get('doctor');

        if (!doctor) {
            return NextResponse.json({ error: 'Parámetro doctor requerido' }, { status: 400 });
        }

        // 1. Find all clients referred by this doctor
        const clients = await prisma.client.findMany({
            where: { doctor },
            select: { id: true, name: true }
        });

        if (clients.length === 0) {
            return NextResponse.json({
                operations: [],
                totalCommission: 0,
                totalPaidToDoctor: 0,
                balance: 0,
                doctorPayments: []
            });
        }

        const clientIds = clients.map(c => c.id);
        const clientMap: Record<string, string> = {};
        clients.forEach(c => { clientMap[c.id] = c.name; });

        // 2. Get all SALE orders for those clients (not deleted)
        const orders = await prisma.order.findMany({
            where: {
                clientId: { in: clientIds },
                orderType: 'SALE',
                isDeleted: false,
            },
            include: {
                payments: true,
                items: { include: { product: true } }
            },
            orderBy: { createdAt: 'desc' },
        });

        // 3. Calculate commissions per operation
        const operations: any[] = [];
        let totalCommission = 0;

        for (const order of orders) {
            let orderPlatformFee = 0;
            let orderPaidTotal = 0;

            // Sum payments and calculate platform fees
            for (const payment of order.payments) {
                const method = payment.method || 'CASH';
                const rate = PLATFORM_COMMISSIONS[method] || 0;
                orderPlatformFee += payment.amount * rate;
                orderPaidTotal += payment.amount;
            }

            // Net amount = total - platform fee
            const netAmount = (order.total || 0) - orderPlatformFee;
            // Doctor commission = 15% of net
            const commission = netAmount * DOCTOR_COMMISSION_RATE;

            totalCommission += commission;

            operations.push({
                orderId: order.id,
                clientName: clientMap[order.clientId] || 'Desconocido',
                clientId: order.clientId,
                orderTotal: order.total || 0,
                platformFee: orderPlatformFee,
                netAmount,
                commission,
                date: order.createdAt,
                paymentMethods: order.payments.map((p: any) => p.method),
            });
        }

        // 4. Get payments made TO the doctor
        const doctorPayments = await prisma.doctorPayment.findMany({
            where: { doctorName: doctor },
            orderBy: { date: 'desc' },
        });

        const totalPaidToDoctor = doctorPayments.reduce((sum: number, p: any) => sum + p.amount, 0);
        const balance = totalCommission - totalPaidToDoctor;

        return NextResponse.json({
            operations,
            totalCommission: Math.round(totalCommission * 100) / 100,
            totalPaidToDoctor: Math.round(totalPaidToDoctor * 100) / 100,
            balance: Math.round(balance * 100) / 100,
            doctorPayments,
        });
    } catch (error: any) {
        console.error('Error calculating doctor commissions:', error);
        return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
    }
}
