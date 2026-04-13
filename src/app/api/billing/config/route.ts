import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { BillingService } from '@/services/billing.service';
import { getAllBillingAccounts, BillingAccount } from '@/lib/afip';

export const dynamic = 'force-dynamic';

/**
 * GET /api/billing/config — Estado de la configuración de ARCA para todas las cuentas
 */
export async function GET() {
    try {
        const headersList = await headers();
        const role = headersList.get('x-user-role') || 'STAFF';

        if (role !== 'ADMIN') {
            return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 });
        }

        const accounts = getAllBillingAccounts();
        const results = await Promise.all(
            Object.keys(accounts).map(async (accKey) => {
                const account = accKey as BillingAccount;
                const status = await BillingService.checkConnection(account);
                
                let lastVoucherNum = null;
                if (status.connected) {
                    try {
                        const lastVoucherData = await BillingService.getLastVoucherNumber(account);
                        lastVoucherNum = lastVoucherData.lastVoucher;
                    } catch { }
                }

                return {
                    ...status,
                    puntoDeVenta: accounts[account].puntoDeVenta,
                    lastVoucherNumber: lastVoucherNum,
                };
            })
        );

        return NextResponse.json(results);
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || 'Error verificando configuración' },
            { status: 500 }
        );
    }
}
