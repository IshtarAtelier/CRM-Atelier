"use client";

import { useState, useEffect } from 'react';

// Badge con la cantidad de ventas web pendientes de confirmación (sidebar).
export function WebSalesBadge() {
    const [count, setCount] = useState(0);

    useEffect(() => {
        const fetchCount = async () => {
            try {
                const res = await fetch('/api/orders/web-pending-count');
                const data = await res.json();
                if (typeof data.count === 'number') {
                    setCount(data.count);
                }
            } catch (e) {
                // Ignore
            }
        };

        fetchCount();
        const interval = setInterval(fetchCount, 30000);
        return () => clearInterval(interval);
    }, []);

    if (count === 0) return null;

    return (
        <span className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-black text-white bg-sky-500 rounded-full shadow-sm animate-pulse">
            {count}
        </span>
    );
}
