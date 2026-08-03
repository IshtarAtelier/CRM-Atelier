import type { Metadata } from 'next';

/**
 * `page.tsx` de esta landing es un Client Component, así que no puede exportar
 * `metadata`. Sin este layout heredaba la del root y quedaba indexable, a
 * diferencia del resto de las landings — que llevan `index: false` a propósito
 * para no competir con el home por las mismas búsquedas.
 */
export const metadata: Metadata = {
  title: 'Wicue — Anteojos de sol con tinte regulable | Atelier Óptica',
  description:
    'Anteojos Wicue con cristal de tinte regulable: pasan de claro a oscuro con un toque. Consultá disponibilidad y precio por WhatsApp.',
  alternates: {
    canonical: 'https://atelieroptica.com.ar/landing/wicue',
  },
  robots: { index: false, follow: true },
};

export default function WicueLandingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
