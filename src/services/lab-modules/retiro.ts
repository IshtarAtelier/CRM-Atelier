import type { LabModule } from './contrato';

/**
 * ¿El cron de retiro (`/api/cron/pickup-reminder`) puede avisarle solo al
 * cliente, 24 h después de que el laboratorio marcó el pedido terminado?
 *
 * Con Grupo Óptico sí (es el circuito de siempre: terminado → 24 h → WhatsApp
 * "listo para retirar" → Listo p/ Retirar). Un laboratorio nuevo puede decir
 * que NO hasta que se sepa cuánto tarda el pedido en llegar al local (Vitolen,
 * decisión de Ishtar del 3/10/2026): entonces el aviso queda en la campanita
 * y lo manda el vendedor al marcar "Listo p/ Retirar". Puro.
 */
export function retiroAutomaticoPermitido(
    items: { laboratorySnapshot?: string | null; product?: { laboratory?: string | null } | null }[],
    modulos: Pick<LabModule, 'patronProducto' | 'avisoDeRetiroAutomatico' | 'nombre'>[],
): { permitido: boolean; modulo: string | null } {
    const labs = items.map(i => i.laboratorySnapshot || i.product?.laboratory || '').filter(Boolean);
    const modulo = modulos.find(m => labs.some(l => m.patronProducto.test(l)));
    if (!modulo) return { permitido: true, modulo: null };
    return { permitido: modulo.avisoDeRetiroAutomatico !== false, modulo: modulo.nombre };
}
