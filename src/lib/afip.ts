import Afip from '@afipsdk/afip.js';

/**
 * Billing accounts — cada monotributo es una cuenta independiente.
 * ISH = pagos con Pay Way Ish, Naranja Z Ish
 * YANI = pagos con Pay Way Yani, Naranja Z Yani
 * LUCIA = pagos con Cuenta Lucía
 */
export type BillingAccount = 'ISH' | 'YANI';

export interface BillingAccountConfig {
    cuit: number;
    label: string;
    puntoDeVenta: number;
    address: string;
    activityStart: string;
}

export const BILLING_ACCOUNTS: Record<BillingAccount, BillingAccountConfig> = {
    ISH: {
        cuit: parseInt(process.env.AFIP_CUIT_ISH || '0'),
        label: 'Ishtar Pissano',
        puntoDeVenta: parseInt(process.env.AFIP_PUNTO_VENTA_ISH || '1'),
        address: 'Santiago del Estero 66 Local 12, Córdoba',
        activityStart: '01/01/2024'
    },
    YANI: {
        cuit: parseInt(process.env.AFIP_CUIT_YANI || '0'),
        label: 'Yani Pissano',
        puntoDeVenta: parseInt(process.env.AFIP_PUNTO_VENTA_YANI || '1'),
        address: 'Luis Jose de Tejeda 4380, Córdoba',
        activityStart: '01/01/2025'
    },
};

export function getBillingAccountConfig(account: BillingAccount): BillingAccountConfig {
    return BILLING_ACCOUNTS[account];
}

export function getAllBillingAccounts(): Record<BillingAccount, BillingAccountConfig> {
    return BILLING_ACCOUNTS;
}

// Cache de instancias AFIP (una por cuenta)
const afipInstances: Partial<Record<BillingAccount, any>> = {};

/**
 * Singleton para la instancia de Afip SDK por cuenta.
 */
export function getAfipInstance(account: BillingAccount = 'ISH'): any {
    if (!afipInstances[account]) {
        const accountConfig = BILLING_ACCOUNTS[account];

        // Access token del panel app.afipsdk.com (eliminando espacios extra)
        const accessToken = account === 'ISH'
            ? (process.env.AFIP_ACCESS_TOKEN_ISH || '').trim()
            : (process.env.AFIP_ACCESS_TOKEN_YANI || '').trim();

        // Certificado (.crt) descargado de AFIP tras subir el CSR
        const certRaw = account === 'ISH'
            ? (process.env.AFIP_CERT_ISH || '')
            : (process.env.AFIP_CERT_YANI || '');

        // Clave privada (.key) generada al crear el CSR
        const keyRaw = account === 'ISH'
            ? (process.env.AFIP_KEY_ISH || '')
            : (process.env.AFIP_KEY_YANI || '');

        const formatPem = (raw: string) => {
            let str = raw.replace(/^["']|["']$/g, ''); // Quitar comillas si las hay
            str = str.replace(/\\n/g, '\n');           // Reemplazar \n literal por salto real
            
            // Si la key o cert se pegó en Railway como una sola línea, la reconstruimos
            if (!str.includes('\n') && str.includes('-----BEGIN')) {
                const headerMatch = str.match(/-----BEGIN [A-Z ]+-----/);
                const footerMatch = str.match(/-----END [A-Z ]+-----/);
                if (headerMatch && footerMatch) {
                    const header = headerMatch[0];
                    const footer = footerMatch[0];
                    // Todo lo que está entre medio, le sacamos los espacios
                    const body = str.replace(header, '').replace(footer, '').replace(/\s+/g, '');
                    // Lo dividimos en líneas de 64 caracteres típicas de PEM
                    const bodyChunks = body.match(/.{1,64}/g) || [];
                    str = `${header}\n${bodyChunks.join('\n')}\n${footer}`;
                }
            }
            return str.trim();
        };

        const cert = formatPem(certRaw);
        const key = formatPem(keyRaw);

        const config: any = {
            CUIT: accountConfig.cuit,
            access_token: accessToken,
        };

        // Agregar cert y key si están disponibles (necesarios para producción)
        if (cert) config.cert = cert;
        if (key) config.key = key;

        if (process.env.AFIP_PRODUCTION_MODE === 'true') {
            config.production = true;
            console.log(`[AFIP] Instancia ${account} configurada en MODO PRODUCCIÓN (cert: ${cert ? 'SI' : 'NO'}, key: ${key ? 'SI' : 'NO'})`);
        } else {
            console.log(`[AFIP] Instancia ${account} configurada en MODO SANDBOX (Pruebas)`);
        }

        afipInstances[account] = new Afip(config);
    }
    return afipInstances[account]!;
}

/**
 * Métodos de pago que corresponden a cada cuenta.
 */
const ISH_METHODS = ['PAY_WAY_6_ISH', 'PAY_WAY_3_ISH', 'NARANJA_Z_ISH', 'GO_CUOTAS_ISH'];
const YANI_METHODS = ['PAY_WAY_6_YANI', 'PAY_WAY_3_YANI', 'NARANJA_Z_YANI'];

/**
 * Detecta la cuenta de facturación a partir de los métodos de pago de una orden.
 * Si tiene métodos ISH → ISH. Si tiene métodos YANI → YANI.
 * Si tiene ambos o ninguno (ej: Efectivo, Go Cuotas) → null (el usuario debe elegir).
 */
export function detectBillingAccount(payments: { method: string }[]): BillingAccount | null {
    const hasIsh = payments.some(p => ISH_METHODS.includes(p.method));
    const hasYani = payments.some(p => YANI_METHODS.includes(p.method));

    if (hasIsh && !hasYani) return 'ISH';
    if (hasYani && !hasIsh) return 'YANI';
    return null; // Ambivalente — usuario elige
}

/**
 * Formatea una fecha en el formato que usa ARCA (yyyymmdd)
 */
export function formatAfipDate(date: Date = new Date()): number {
    const d = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
    return parseInt(d.toISOString().split('T')[0].replace(/-/g, ''));
}
