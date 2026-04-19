import { NextResponse } from 'next/server';
import { BillingService } from '@/services/billing.service';
import { getBillingAccountConfig } from '@/lib/afip';
import type { BillingAccount } from '@/lib/afip';
import fs from 'fs';
import path from 'path';

export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const invoice = await BillingService.getInvoice(id);
        
        if (!invoice) {
            return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
        }

        const accountConfig = getBillingAccountConfig(invoice.billingAccount as BillingAccount);
        
        // Logo
        let logoBase64: string | null = null;
        try {
            const logoPath = path.join(process.cwd(), 'public', 'assets', 'logo-atelier-optica.png');
            if (fs.existsSync(logoPath)) {
                logoBase64 = fs.readFileSync(logoPath).toString('base64');
            }
        } catch (e) {
            console.error('Error reading logo for PDF data API:', e);
        }

        const data = {
            invoice,
            issuer: {
                name: accountConfig.label,
                cuit: accountConfig.cuit.toString(),
                address: accountConfig.address,
                ivaCondition: 'Responsable Monotributo',
                activityStart: accountConfig.activityStart
            },
            logo: logoBase64
        };

        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Error in PDF data API:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
