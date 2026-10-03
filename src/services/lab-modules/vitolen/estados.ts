import type { EstadoEnPortal } from '../contrato';

/**
 * Los estados del portal de Vitolen (docs/vitolen-portal.md) traducidos al
 * vocabulario del marco. La barra del detalle de un pedido los muestra en
 * orden: Confirmación → En Proceso → Tránsito a OF → En Oficina → Despachado.
 *
 * "En Oficina" (llegó a la oficina de Córdoba) se trata como TERMINADO: el
 * laboratorio ya no tiene nada que hacerle. Si Vitolen prefiere avisar recién
 * en "Despachado", es una línea acá. Puro: `npm run check:lab-modulos`.
 */
const TABLA: [RegExp, EstadoEnPortal][] = [
    [/^confirmaci[oó]n$/i, 'INGRESADO'],
    [/^en\s+proceso$/i, 'EN_PROCESO'],
    [/^tr[aá]nsito\s+a\s+of/i, 'EN_PROCESO'],
    [/^en\s+oficina$/i, 'TERMINADO'],
    [/^despachad[oa]$/i, 'DESPACHADO'],
    [/^(anulad|cancelad|rechazad)[oa]$/i, 'ANULADO'],
];

export function estadoDe(statusRaw: string | null | undefined): EstadoEnPortal {
    const s = String(statusRaw || '').replace(/\s+/g, ' ').trim();
    if (!s) return 'DESCONOCIDO';
    for (const [patron, estado] of TABLA) if (patron.test(s)) return estado;
    return 'DESCONOCIDO';
}
