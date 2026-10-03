/**
 * Una ruta del sitio ("/images/x.webp") como URL completa, para los datos
 * estructurados (JSON-LD) y las vistas previas: Google y los buscadores
 * esperan URLs absolutas, y una relativa en el ItemList de la home se leía
 * como inválida (auditoría del 25/9/2026). Si ya es absoluta, queda igual.
 */
export const ORIGEN_SITIO = 'https://atelieroptica.com.ar';

export function urlAbsoluta(ruta: string | null | undefined): string | undefined {
  if (!ruta) return undefined;
  if (/^https?:\/\//i.test(ruta)) return ruta;
  return `${ORIGEN_SITIO}${ruta.startsWith('/') ? '' : '/'}${ruta}`;
}
