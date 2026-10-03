import type { LabModule } from './contrato';
import { MODULO_VITOLEN } from './vitolen/modulo';

/**
 * Los módulos activos. Sumar un laboratorio = agregar su módulo acá; el cron,
 * el espejo, la salud y las pantallas lo toman solos.
 */
export const REGISTRO_MODULOS: LabModule[] = [MODULO_VITOLEN];

export function moduloPorClave(clave: string | null | undefined): LabModule | null {
    const k = String(clave || '').trim().toUpperCase();
    return REGISTRO_MODULOS.find(m => m.clave === k) ?? null;
}

/** El módulo dueño de un cristal, por su `Product.laboratory` (o el snapshot de la venta). */
export function moduloDeLab(nombreDeLab: string | null | undefined): LabModule | null {
    const n = String(nombreDeLab || '');
    if (!n.trim()) return null;
    return REGISTRO_MODULOS.find(m => m.patronProducto.test(n)) ?? null;
}
