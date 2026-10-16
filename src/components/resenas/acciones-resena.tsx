'use client';

import { useState } from 'react';
import { mensajePedidoResena, productosDeUltimaVenta, esSegundoPedido } from '@/lib/resenas/pedido-resena';

/**
 * Arma el mensaje prearmado del pedido de reseña (1º o 2º, según la tarea) y
 * abre el chat del CRM. El mensaje lo MANDA el vendedor: acá no se envía nada.
 */
export async function abrirChatPedidoResena(opts: { clientId: string; nombre?: string | null; telefono: string; descripcion?: string | null }) {
    let productos: string | null = null;
    try {
        const res = await fetch(`/api/contacts/${opts.clientId}`);
        if (res.ok) productos = productosDeUltimaVenta(await res.json());
    } catch (err) {
        console.error('Error leyendo la última venta para el pedido de reseña', err);
    }
    const texto = mensajePedidoResena({ nombre: opts.nombre, productos, segundo: esSegundoPedido(opts.descripcion) });
    let phone = opts.telefono.replace(/\D/g, '');
    if (phone.length === 10) phone = '549' + phone;
    window.location.href = `/admin/whatsapp?phone=${phone}&text=${encodeURIComponent(texto)}`;
}

/** Etiqueta "2º pedido" para la tarea que volvió a poner el robot. */
export function EtiquetaSegundoPedido({ descripcion }: { descripcion?: string | null }) {
    if (!esSegundoPedido(descripcion)) return null;
    return (
        <span className="inline-block ml-2 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 align-middle">
            2º pedido
        </span>
    );
}

/** "✅ Ya comentó": marca la ficha y cierra los pedidos de reseña abiertos. */
export function BotonYaComento({ clientId, onDone, className = '' }: { clientId: string; onDone?: () => void; className?: string }) {
    const [estado, setEstado] = useState<'idle' | 'enviando' | 'ok'>('idle');
    return (
        <button
            type="button"
            disabled={estado !== 'idle'}
            onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                setEstado('enviando');
                try {
                    const res = await fetch(`/api/contacts/${clientId}/resena`, { method: 'POST' });
                    if (!res.ok) throw new Error(String(res.status));
                    setEstado('ok');
                    if (typeof window !== 'undefined') window.dispatchEvent(new Event('tasks-updated'));
                    onDone?.();
                } catch {
                    setEstado('idle');
                    alert('❌ No se pudo marcar la reseña.');
                }
            }}
            className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-yellow-50 hover:bg-yellow-100 text-yellow-800 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-800 transition-all disabled:opacity-50 ${className}`}
            title="El cliente ya dejó su reseña en Google: no se le vuelve a pedir"
        >
            {estado === 'ok' ? '✅ Comentó' : estado === 'enviando' ? '…' : '✅ Ya comentó'}
        </button>
    );
}
