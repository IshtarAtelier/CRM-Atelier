import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { decrypt } from '@/lib/auth';
import { BILLING_ACCOUNTS } from '@/lib/afip';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session');

        if (!session?.value) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const payload = await decrypt(session.value);
        if (!payload || payload.role !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const productionMode = process.env.AFIP_PRODUCTION_MODE === 'true';
        
        const results: any = {
            environment: productionMode ? 'PRODUCTION' : 'TESTING (SANDBOX)',
            accounts: {}
        };

        for (const [key, config] of Object.entries(BILLING_ACCOUNTS)) {
            const cert = key === 'ISH' ? process.env.AFIP_CERT_ISH : process.env.AFIP_CERT_YANI;
            const keyPriv = key === 'ISH' ? process.env.AFIP_KEY_ISH : process.env.AFIP_KEY_YANI;
            
            let certInfo = "NOT LOADED";
            let certType = "UNKNOWN";

            if (cert) {
                certInfo = "LOADED";
                if (cert.includes('----BEGIN CERTIFICATE----')) {
                    if (cert.includes('AFIP')) {
                        certType = "PRODUCTION (Likely - AFIP Issued)";
                    } else if (cert.includes('Testing')) {
                        certType = "TESTING (Sandbox)";
                    }
                }
            }

            results.accounts[key] = {
                config: {
                    cuit: config.cuit,
                    label: config.label,
                    puntoDeVenta: config.puntoDeVenta
                },
                certificate: {
                    status: certInfo,
                    type: certType,
                    length: cert?.length || 0
                },
                hasKey: !!keyPriv
            };
        }

        results.timestamp = new Date().toISOString();
        return NextResponse.json(results);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
