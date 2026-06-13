import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Tienda Online",
  description: "Explorá nuestra colección de armazones recetados, lentes de sol y multifocales. Diseños exclusivos y la mejor calidad óptica en Córdoba con envíos a todo el país.",
  openGraph: {
    title: "Tienda Online",
    description: "Explorá nuestra colección de armazones recetados, lentes de sol y multifocales. Diseños exclusivos y la mejor calidad óptica en Córdoba con envíos a todo el país.",
    type: "website",
    url: "https://www.atelieroptica.com.ar/tienda",
    images: [
      {
        url: "/images/blog/mostrador-marmol.webp",
        width: 1200,
        height: 630,
        alt: "Colección Atelier Óptica",
      }
    ]
  }
};

export default function TiendaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
