import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contacto | Atelier Óptica Córdoba',
  description: 'Contactá a Atelier Óptica Córdoba. WhatsApp, Instagram y visita a nuestro local en Cerro de las Rosas. Turnos y consultas.',
  alternates: { canonical: 'https://www.atelieroptica.com.ar/contacto' },
  openGraph: {
    title: 'Contacto | Atelier Óptica Córdoba',
    description: 'Contactá a Atelier Óptica Córdoba. WhatsApp, Instagram y visita a nuestro local en Cerro de las Rosas.',
    type: "website",
    url: "https://www.atelieroptica.com.ar/contacto",
    images: [
      {
        url: "/images/blog/fachada-ladrillo.jpg",
        width: 1200,
        height: 630,
        alt: "Atelier Óptica Contacto",
      }
    ]
  }
};

export default function ContactoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
