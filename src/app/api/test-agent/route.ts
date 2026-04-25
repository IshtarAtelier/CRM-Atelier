import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ReceiptAgentService } from '@/services/receipt-agent.service';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const payments = await prisma.payment.findMany({
            where: {
                receiptUrl: { not: null }
            }
        });

        const results = [];

        for (const p of payments) {
            try {
                // If notes already has a TX, skip or process? Let's force process if it's test
                console.log(`Processing payment ${p.id}...`);
                await ReceiptAgentService.analyzeReceipt(
                    p.id,
                    p.orderId,
                    p.receiptUrl!,
                    p.amount,
                    p.method
                );
                results.push(`Processed ${p.id}`);
            } catch (err: any) {
                results.push(`Error on ${p.id}: ${err.message}`);
            }
        }

        return NextResponse.json({ message: "Done", results });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
