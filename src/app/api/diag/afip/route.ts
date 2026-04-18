import { NextResponse } from 'next/server';
import { getAfipInstance, BILLING_ACCOUNTS } from '@/lib/afip';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
                    // Simple check for typical production vs testing content
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
