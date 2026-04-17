import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
    try {
        const result = await prisma.$transaction(async (tx) => {
            const order = await tx.order.findUnique({ where: { id: "cmnz137tg000w88vzxonx180f" } });
            if (!order) throw new Error("Order not found");

            const invoice = await tx.invoice.create({
                data: {
                    orderId: "cmnz137tg000w88vzxonx180f",
                    cae: "86161914321109",
                    caeExpiration: "2026-04-27",
                    voucherNumber: 1, // First invoice on point 3 ever
                    voucherType: 11,
                    pointOfSale: 3,
                    concept: 1,
                    totalAmount: 160194,
                    docType: 96,
                    docNumber: "44490849",
                    billingAccount: "ISH",
                    status: "COMPLETED"
                }
            });

            await tx.interaction.create({
                data: {
                    clientId: order.clientId,
                    type: "INVOICE",
                    content: `🧾 Factura FC 0003-00000001 recuperada manualmente por $160.194 - CAE: 86161914321109`
                }
            });

            return invoice;
        });

        return NextResponse.json({ success: true, invoice: result });
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
