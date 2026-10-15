import type { LabModule } from './contrato';
import { MODULO_VITOLEN } from './vitolen/modulo';
import { MODULO_GRUPO_OPTICO } from './grupo-optico/modulo';

/**
 * Los módulos activos. Sumar un laboratorio = agregar su módulo acá; el cron,
 * el espejo, la salud y las pantallas lo toman solos.
 *
 * OJO: el seguimiento de Grupo Óptico NO lo corre /api/cron/lab-modulos sino
 * /api/cron/smartlab-sync (ahí mismo sigue la conciliación rápida de costos,
 * en el mismo tick y en ese orden). Está acá para el reporte semanal, el
 * retiro automático y todo lo que mira el registro.
 */
export const REGISTRO_MODULOS: LabModule[] = [MODULO_VITOLEN, MODULO_GRUPO_OPTICO];

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
