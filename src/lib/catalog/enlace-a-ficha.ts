import { slugVigenteDe } from './slugs-historicos';

/**
 * Un link a una ficha (`/producto/<slug>`) que ya no existe se corrige al
 * mostrarse, en vez de mandar a la persona a un 404.
 *
 * Las notas del blog que viven en la base se escribieron con los nombres de
 * fichas de su momento. El 10/10/2026 "elegir-anteojos-recetados" tenía 9
 * links a fichas que ya no existían: un 404 para quien lee (y para Google, un
 * sitio con links rotos). Editar las notas a mano se vuelve a romper con la
 * próxima ficha que se dé de baja; esto corrige al mostrar:
 *   1. ficha publicada → queda como está;
 *   2. renombrada (slugs-historicos) → la vigente;
 *   3. dada de baja, pero el modelo sigue en otro color → la búsqueda de la
 *      tienda con ese nombre ("hera" → /tienda?q=hera);
 *   4. si no → /tienda.
 *
 * `vivas`: slugs de las fichas publicadas (FICHA_PUBLICADA). Sin ese dato
 * (la base no respondió) no se toca nada.
 */
const LINK_A_FICHA = /^(?:https?:\/\/(?:www\.)?atelieroptica\.com\.ar)?\/producto\/([a-z0-9-]+)\/?(?:[?#].*)?$/i;

/** "atelier-hera-dwcn" → "hera"; "aurora-c1" → "aurora"; "armazon-receta-escarlata-pandora-c5-hk011" → "pandora". */
export function nombreDelModelo(slug: string): string {
  const partes = slug.toLowerCase().split('-').filter(Boolean);
  const ruido = new Set(['atelier', 'armazon', 'receta', 'escarlata', 'capsula', 'lentes', 'sol', 'clip', 'on', 'anteojos']);
  const utiles = partes.filter((p) => !ruido.has(p) && !/^c\d+$/.test(p) && !/\d/.test(p) && p.length > 2);
  // Los códigos al azar del sistema viejo ("dwcn", "k0k7") van al final: el
  // nombre del modelo es la primera palabra que queda.
  return utiles[0] ?? '';
}

export function enlaceDeFichaVigente(href: string, vivas: ReadonlySet<string> | null): string {
  if (!vivas) return href;
  const m = LINK_A_FICHA.exec(href.trim());
  if (!m) return href;
  const slug = m[1].toLowerCase();
  if (vivas.has(slug)) return href;
  const vigente = slugVigenteDe(slug);
  if (vigente && vivas.has(vigente)) return `/producto/${vigente}`;
  const nombre = nombreDelModelo(slug);
  const sigue = nombre && [...vivas].some((s) => s.split('-').includes(nombre));
  return sigue ? `/tienda?q=${encodeURIComponent(nombre)}` : '/tienda';
}
