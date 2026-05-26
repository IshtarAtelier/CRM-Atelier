import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Contacto",
  description: "Contactate con Atelier Óptica. Nuestro equipo de profesionales está disponible para asesorarte sobre multifocales, cristales y armazones.",
  openGraph: {
    title: "Contacto",
    description: "Contactate con Atelier Óptica. Nuestro equipo de profesionales está disponible para asesorarte sobre multifocales, cristales y armazones.",
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
