import { NextResponse } from 'next/server';
import { getBillingAccountConfig } from '@/lib/afip';

export async function GET() {
    try {
        const isProduction = process.env.AFIP_PRODUCTION_MODE === 'true';
        
        const checkCert = (cert: string | undefined) => {
            if (!cert) return { status: 'MISSING', type: 'N/A' };
            if (cert.includes('DESARROLLO') || cert.includes('HOMOLOGACIÓN')) {
                return { status: 'LOADED', type: 'TESTING (Sandbox)' };
            }
            if (cert.includes('BEGIN CERTIFICATE')) {
                return { status: 'LOADED', type: 'PRODUCTION (Likely)' };
            }
            return { status: 'INVALID FORMAT', type: 'Unknown' };
        };

        const ishCert = process.env.AFIP_CERT_ISH || process.env.AFIP_CERT; // Fallback to old var
        const yaniCert = process.env.AFIP_CERT_YANI;

        const results = {
            environment: isProduction ? 'PRODUCTION' : 'TESTING (SANDBOX)',
            accounts: {
                ISH: {
                    config: getBillingAccountConfig('ISH'),
                    certificate: checkCert(ishCert),
                    hasKey: !!(process.env.AFIP_KEY_ISH || process.env.AFIP_KEY)
                },
                YANI: {
                    config: getBillingAccountConfig('YANI'),
                    certificate: checkCert(yaniCert),
                    hasKey: !!process.env.AFIP_KEY_YANI
                }
            },
            timestamp: new Date().toISOString()
        };

        return NextResponse.json(results);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
