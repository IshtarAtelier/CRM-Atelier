'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LineChart, Target } from 'lucide-react';

/**
 * Analítica tiene dos preguntas distintas y cada una es una pestaña:
 *  - Tienda web: qué pasa DENTRO del sitio (embudo, carritos, productos).
 *  - Atribución: qué trajo a la gente HASTA acá (anuncios y canales).
 *
 * La pestaña activa va con fondo invertido, no con un tono claro: el equipo
 * incluye a alguien con baja visión y un estado activo tiene que ser
 * inconfundible, no una insinuación de color.
 */
const PESTANIAS = [
    { href: '/admin/analitica', label: 'Tienda web', icon: LineChart },
    { href: '/admin/analitica/atribucion', label: 'Atribución', icon: Target },
];

export default function AnaliticaLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div>
            <nav className="px-4 sm:px-6 pt-4 sm:pt-6 max-w-6xl mx-auto">
                <div className="flex items-center gap-2 overflow-x-auto">
                    {PESTANIAS.map(({ href, label, icon: Icono }) => {
                        const activa = pathname === href;
                        return (
                            <Link
                                key={href}
                                href={href}
                                aria-current={activa ? 'page' : undefined}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap border transition ${
                                    activa
                                        ? 'bg-stone-800 text-white border-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:border-stone-100'
                                        : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100 dark:bg-stone-800 dark:text-stone-200 dark:border-stone-600 dark:hover:bg-stone-700'
                                }`}
                            >
                                <Icono className="w-4 h-4" />
                                {label}
                            </Link>
                        );
                    })}
                </div>
            </nav>
            {children}
        </div>
    );
}
