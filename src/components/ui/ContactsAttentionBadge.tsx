"use client";

import { useState, useEffect } from 'react';

// Badge rojo con la cantidad de contactos sin atender (sin presupuesto ni venta).
// Se muestra junto a "Contactos y Clientes" en el sidebar.
// En modo colapsado renderiza sólo un punto (sin número).
export function ContactsAttentionBadge({ collapsed = false }: { collapsed?: boolean }) {
    const [count, setCount] = useState(0);

    useEffect(() => {
        const fetchCount = async () => {
            try {
                const res = await fetch('/api/contacts/attention-count');
                const data = await res.json();
                if (typeof data.count === 'number') {
                    setCount(data.count);
                }
            } catch {
                // Ignore
            }
        };

        fetchCount();
        const interval = setInterval(fetchCount, 30000);
        return () => clearInterval(interval);
    }, []);

    if (count === 0) return null;

    if (collapsed) {
        return (
            <div
                className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#12100f] shadow-[0_0_8px_#ef4444]"
                title={`${count} contacto${count === 1 ? '' : 's'} sin atender`}
            />
        );
    }

    return (
        <span className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-black text-white bg-red-500 rounded-full shadow-sm animate-pulse">
            {count}
        </span>
    );
}
