// @ts-nocheck
import Afip from '@afipsdk/afip.js';

/**
 * Billing accounts — cada monotributo es una cuenta independiente.
 * ISH = pagos con Pay Way Ish, Naranja Z Ish
 * YANI = pagos con Pay Way Yani, Naranja Z Yani
 */
export type BillingAccount = 'ISH' | 'YANI';

export interface BillingAccountConfig {
    cuit: number;
    label: string;
    puntoDeVenta: number;
}

const BILLING_ACCOUNTS: Record<BillingAccount, BillingAccountConfig> = {
    ISH: {
        cuit: parseInt(process.env.AFIP_CUIT_ISH || '23386152314'),
        label: 'Ishtar Pissano',
        puntoDeVenta: parseInt(process.env.AFIP_PUNTO_VENTA_ISH || '1'),
    },
    YANI: {
        cuit: parseInt(process.env.AFIP_CUIT_YANI || '20409378472'),
        label: 'Yani',
        puntoDeVenta: parseInt(process.env.AFIP_PUNTO_VENTA_YANI || '1'),
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
        const config: any = {
            CUIT: accountConfig.cuit,
            access_token: account === 'ISH'
                ? (process.env.AFIP_ACCESS_TOKEN_ISH || '')
                : (process.env.AFIP_ACCESS_TOKEN_YANI || ''),
        };

        // Producción: certificados por cuenta
        const certEnv = account === 'ISH' ? 'AFIP_CERT_ISH' : 'AFIP_CERT_YANI';
        const keyEnv = account === 'ISH' ? 'AFIP_KEY_ISH' : 'AFIP_KEY_YANI';
        if (process.env[certEnv] && process.env[keyEnv]) {
            config.cert = process.env[certEnv];
            config.key = process.env[keyEnv];
        }

        afipInstances[account] = new Afip(config);
    }
    return afipInstances[account]!;
}

/**
 * Métodos de pago que corresponden a cada cuenta.
 */
const ISH_METHODS = ['PAY_WAY_6_ISH', 'PAY_WAY_3_ISH', 'NARANJA_Z_ISH'];
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
