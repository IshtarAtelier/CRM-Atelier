import { Metadata } from 'next';
import { Vitrina } from './Vitrina';

// ISR de verdad: la página se prerenderiza y se regenera cada minuto.
//
// Antes este `revalidate` no hacía nada, por dos motivos que marcaban la ruta
// como dinámica:
//   1. `cookies()` — se leía la sesión para saber si quien mira es una óptica
//      mayorista (título del tab, pie sin marca Atelier). Ahora eso lo resuelve
//      PieSegunSesion en el cliente, como el resto del rebrandeo mayorista que
//      TiendaClient ya venía haciendo ahí.
//   2. `searchParams` — la categoría de ?categoria= se resolvía en el servidor.
//      No hay forma de conservar eso y tener ISR: una página estática sirve el
//      mismo HTML para todas las querystrings. La categoría la aplica ahora
//      TiendaClient al hidratar (ya leía los otros cinco filtros de la URL así).
//      Contrapartida: el HTML inicial de /tienda?categoria=Sol trae la vitrina
//      completa y la grilla se recorta un instante después. Para tráfico e
//      indexación de una categoría sola están /lentes-de-sol y /receta, que sí
//      son URLs propias y siguen saliendo enteras del servidor.
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Colección de Anteojos',
  description: 'Descubrí nuestra colección completa de anteojos de diseño. Marcos premium seleccionados a mano.',
  alternates: {
    canonical: 'https://atelieroptica.com.ar/tienda',
  },
  openGraph: {
    title: 'Colección de Anteojos',
    description: 'Descubrí nuestra colección completa de anteojos de diseño. Marcos premium seleccionados a mano.',
    url: 'https://atelieroptica.com.ar/tienda',
    type: 'website',
    // La misma imagen que el home: el ATELIER grabado en la varilla. Es la
    // única del sitio que ya viene en 1200×630 (el formato que usan WhatsApp,
    // Instagram y Facebook). La anterior —mostrador-marmol— es vertical
    // (1600×2842) aunque el código declarara 1200×630: al compartir el link,
    // WhatsApp la recortaba y se veían las flores y el frasco de caramelos.
    images: [{ url: '/images/og-image.jpg', width: 1200, height: 630, alt: 'Anteojos Atelier Óptica' }],
  },
};

export default async function TiendaPage() {
  // La página 1. Todo el armado vive en Vitrina, compartido con /tienda/[pagina].
  return <Vitrina pagina={1} />;
}
