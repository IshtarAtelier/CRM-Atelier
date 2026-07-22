import { Metadata } from 'next';
import IngresoMayoristaClient from './IngresoMayoristaClient';

// Puerta de entrada del ÁREA MAYORISTA — separada a propósito del /login del
// CRM interno: otra URL, otro branding (negro/dorado del canal), otro texto.
// Las ópticas nunca deberían ver nada que diga "Sistema de Gestión y CRM".
export const metadata: Metadata = {
  // absolute: sin esto el layout root agrega "| Atelier Óptica" al tab.
  title: { absolute: 'Ingreso Mayorista · Cápsula Escarlata' },
  description: 'Acceso al portal mayorista Cápsula Escarlata para ópticas y distribuidores.',
  robots: { index: false, follow: false },
  // openGraph/twitter/icons propios: sin esto se heredan los del layout root
  // (og:siteName "Atelier Óptica", og:image y favicon de Atelier) y el preview
  // del link en WhatsApp delata la marca.
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    siteName: 'Cápsula Escarlata',
    title: 'Ingreso Mayorista · Cápsula Escarlata',
    description: 'Acceso al portal mayorista para ópticas y distribuidores.',
    images: [
      {
        url: '/images/editorial/filmmaker-frida.webp',
        width: 1200,
        height: 630,
        alt: 'Cápsula Escarlata',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ingreso Mayorista · Cápsula Escarlata',
    description: 'Acceso al portal mayorista para ópticas y distribuidores.',
    images: ['/images/editorial/filmmaker-frida.webp'],
  },
  // Ícono neutro (monograma CE inline): pisa el logo PWA de Atelier del root.
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%23111'/%3E%3Ctext x='16' y='22' font-family='Georgia,serif' font-size='14' fill='%23c8a55c' text-anchor='middle'%3ECE%3C/text%3E%3C/svg%3E",
  },
};

export default function IngresoMayoristaPage() {
  return <IngresoMayoristaClient />;
}
