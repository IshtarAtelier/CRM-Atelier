/**
 * La imagen con la que se comparte el sitio (WhatsApp, Facebook, Instagram)
 * cuando una página no tiene una propia.
 *
 * Existe porque Next NO hereda las `images` del layout cuando una página define
 * su propio `openGraph`: /receta, /lentes-de-sol, /clip-on y /multifocales se
 * compartían sin foto (auditoría del 25/9/2026). El layout y esas páginas leen
 * de acá.
 */
export const OG_IMAGEN_SITIO = {
  url: '/images/og-image.jpg',
  width: 1200,
  height: 630,
  alt: 'Atelier Óptica Córdoba',
} as const;
