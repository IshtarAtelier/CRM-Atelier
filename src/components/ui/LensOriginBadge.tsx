import React from 'react';
import { lensOriginLabel, normalizeLensOrigin } from '@/lib/lens-origin';

// Badge estándar del origen del cristal (Stock verde / Laboratorio celeste).
// No renderiza nada si el valor no es un origen válido, así los call-sites
// pueden pasarlo directo sin condicionales.
export default function LensOriginBadge({
    origin,
    className = '',
}: {
    origin?: string | null;
    className?: string;
}) {
    const normalized = normalizeLensOrigin(origin);
    if (!normalized) return null;

    const colors = normalized === 'STOCK'
        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
        : 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400';

    return (
        <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${colors} ${className}`}>
            {lensOriginLabel(normalized)}
        </span>
    );
}
