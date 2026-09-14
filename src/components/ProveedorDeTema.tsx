'use client';

import { usePathname } from 'next/navigation';
import { ThemeProvider } from 'next-themes';

/**
 * Quién decide el modo claro/oscuro, y dónde.
 *
 * El modo oscuro es del CRM: ahí vive el interruptor (`ThemeToggle`) y ahí cada
 * pantalla declara su variante `dark:`. El SITIO PÚBLICO —tienda, blog, fichas,
 * checkout— está diseñado solo en claro: cada página fija su propio fondo crema
 * a mano, pero los tokens de gris y de dorado sí se dan vuelta con `.dark`. Un
 * `.dark` a medias no es "el sitio en oscuro": es el sitio claro con la mitad de
 * los textos ilegibles. Medido el 14/9 sobre producción: los links del menú a
 * 1,74:1, los volantillos a 2,38:1, el "Ordenar por" de la tienda a 1,26:1.
 *
 * Por eso el público va con `forcedTheme="light"` y el panel conserva su
 * elección. Antes esto ni siquiera se podía elegir: el provider tenía
 * `enableSystem`, así que alcanzaba con que el visitante tuviera el celular en
 * oscuro. Y el interruptor nunca ofreció "sistema" —tiene sol y luna y nada
 * más—, o sea que ese modo no se veía ni se podía apagar, pero mandaba.
 *
 * El día que el sitio público tenga su propio diseño en oscuro, esto se saca de
 * una línea. Hasta entonces, forzarlo es lo que lo hace legible para todos.
 */
export function ProveedorDeTema({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const esPanel = !!pathname && pathname.startsWith('/admin');

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      forcedTheme={esPanel ? undefined : 'light'}
    >
      {children}
    </ThemeProvider>
  );
}
