import { prisma } from '@/lib/db';
import { serverCache } from '@/lib/cache';
import { DEFAULT_MONTHLY_TARGETS, DEFAULT_MONTHLY_TARGETS_USD } from '@/lib/constants';

const DOLAR_CACHE_KEY = 'dolar-blue-venta';
const DOLAR_STALE_KEY = 'dolar-blue-venta:stale';

/**
 * Cotización blue (venta) resuelta en el servidor. Cachea 10 minutos y guarda
 * una copia "stale" de 30 días como respaldo si las fuentes externas fallan.
 */
export async function getDolarBlueVenta(): Promise<number | null> {
    const cached = serverCache.get<number>(DOLAR_CACHE_KEY);
    if (cached !== null) return cached;

    let venta: number | null = null;

    try {
        const res = await fetch('https://mercados.ambito.com//dolar/informal/variacion', {
            signal: AbortSignal.timeout(5000),
            cache: 'no-store',
        });
        if (res.ok) {
            const json = await res.json();
            const parsed = parseFloat(String(json.venta).replace('.', '').replace(',', '.'));
            if (!isNaN(parsed) && parsed > 0) venta = parsed;
        }
    } catch { /* probamos la fuente secundaria */ }

    if (venta === null) {
        try {
            const res = await fetch('https://dolarapi.com/v1/dolares/blue', {
                signal: AbortSignal.timeout(5000),
                cache: 'no-store',
            });
            if (res.ok) {
                const json = await res.json();
                if (typeof json.venta === 'number' && json.venta > 0) venta = json.venta;
            }
        } catch { /* caemos al stale */ }
    }

    if (venta !== null) {
        serverCache.set(DOLAR_CACHE_KEY, venta, 600);
        serverCache.set(DOLAR_STALE_KEY, venta, 86400 * 30);
        return venta;
    }

    return serverCache.get<number>(DOLAR_STALE_KEY);
}

export interface ResolvedTargets {
    /** Valores efectivos en ARS (ya convertidos si la config es en USD). */
    target1: number;
    target2: number;
    target3: number;
    /** Valores en USD (los configurados, o los ARS divididos por el blue). */
    usd1: number | null;
    usd2: number | null;
    usd3: number | null;
    /** Moneda en la que está guardada la config ('USD' | 'ARS'). */
    currency: string;
    /** Cotización usada para convertir (null si no se pudo obtener). */
    rate: number | null;
    /** true si hay una fila MonthlyTarget configurada para el mes. */
    isCustom: boolean;
}

interface TargetRow {
    target1: number;
    target2: number;
    target3: number | null;
    currency?: string | null;
}

/**
 * Convierte una fila de MonthlyTarget (o los defaults si row es null) a
 * valores efectivos en ARS + su equivalente USD, usando la cotización dada.
 */
export function resolveTargetsFromRow(row: TargetRow | null, rate: number | null): ResolvedTargets {
    if (row) {
        const currency = row.currency === 'USD' ? 'USD' : 'ARS';
        const t3raw = row.target3 ?? (currency === 'USD' ? DEFAULT_MONTHLY_TARGETS_USD.target3 : DEFAULT_MONTHLY_TARGETS.target3);

        if (currency === 'USD') {
            // Sin cotización no se puede convertir: caemos a los defaults ARS
            // para no comparar pesos contra dólares.
            if (!rate) {
                return { ...DEFAULT_MONTHLY_TARGETS, usd1: row.target1, usd2: row.target2, usd3: t3raw, currency, rate: null, isCustom: true };
            }
            return {
                target1: Math.round(row.target1 * rate),
                target2: Math.round(row.target2 * rate),
                target3: Math.round(t3raw * rate),
                usd1: row.target1,
                usd2: row.target2,
                usd3: t3raw,
                currency,
                rate,
                isCustom: true,
            };
        }

        return {
            target1: row.target1,
            target2: row.target2,
            target3: t3raw,
            usd1: rate ? Math.round(row.target1 / rate) : null,
            usd2: rate ? Math.round(row.target2 / rate) : null,
            usd3: rate ? Math.round(t3raw / rate) : null,
            currency,
            rate,
            isCustom: true,
        };
    }

    // Sin config: defaults en USD convertidos con el blue; sin cotización, defaults ARS.
    if (!rate) {
        return { ...DEFAULT_MONTHLY_TARGETS, usd1: null, usd2: null, usd3: null, currency: 'USD', rate: null, isCustom: false };
    }
    return {
        target1: Math.round(DEFAULT_MONTHLY_TARGETS_USD.target1 * rate),
        target2: Math.round(DEFAULT_MONTHLY_TARGETS_USD.target2 * rate),
        target3: Math.round(DEFAULT_MONTHLY_TARGETS_USD.target3 * rate),
        usd1: DEFAULT_MONTHLY_TARGETS_USD.target1,
        usd2: DEFAULT_MONTHLY_TARGETS_USD.target2,
        usd3: DEFAULT_MONTHLY_TARGETS_USD.target3,
        currency: 'USD',
        rate,
        isCustom: false,
    };
}

/** Objetivos efectivos (en ARS) de un mes puntual. */
export async function resolveMonthlyTargets(month: number, year: number): Promise<ResolvedTargets> {
    let row: TargetRow | null = null;
    try {
        row = await prisma.monthlyTarget.findUnique({ where: { month_year: { month, year } } });
    } catch (e) {
        console.warn('Could not fetch monthly target row:', e);
    }
    const rate = await getDolarBlueVenta();
    return resolveTargetsFromRow(row, rate);
}
