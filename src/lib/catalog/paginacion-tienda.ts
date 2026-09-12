/**
 * Paginación y estado de la grilla de /tienda — una sola definición.
 *
 * Lo que vive acá lo usan tres lugares que ANTES no podían ponerse de acuerdo
 * porque cada uno tenía su copia del número 24: la grilla cliente
 * (TiendaClient), la página que la sirve (tienda/page.tsx) y las páginas
 * indexables /tienda/2, /tienda/3… Si el tamaño de página cambiara en uno solo,
 * "Cargar más" y los links de paginación mostrarían conjuntos distintos.
 */

/** Cuántos modelos entran en una página de la grilla. */
export const PRODUCTOS_POR_PAGINA = 24;

/** La tienda siempre filtra sobre esta ruta, aunque se esté mirando /tienda/3. */
export const RUTA_TIENDA = '/tienda';

/**
 * Cuántos productos hay cargados en pantalla, guardado en la URL (?ver=48).
 *
 * Por qué en la URL y no en memoria: al entrar a una ficha y volver con el
 * botón "atrás", el componente se monta de cero. Sin este dato, la grilla
 * reaparecía con los primeros 24 y en scroll 0 — o sea que comparar dos modelos
 * (entrar, volver, entrar a otro) obligaba a rehacer todo el camino cada vez.
 * En la URL sobrevive al remonte, al reload y al link compartido.
 */
export const PARAM_VER = 'ver';

/**
 * Lee ?ver= y lo devuelve saneado: nunca menos que una página, nunca más que el
 * catálogo, y siempre múltiplo del tamaño de página (es la cantidad que deja
 * "Cargar más", no un número libre que alguien pueda escribir a mano para
 * pedir el catálogo entero en una sola consulta).
 */
export const MAX_PAGINAS_RESTAURABLES = 40;

export function leerVer(valor: string | null, totalConocido?: number): number {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= PRODUCTOS_POR_PAGINA) return PRODUCTOS_POR_PAGINA;
  const paginas = Math.ceil(n / PRODUCTOS_POR_PAGINA);
  const topeDePaginas = totalConocido && totalConocido > 0
    ? Math.ceil(totalConocido / PRODUCTOS_POR_PAGINA)
    : MAX_PAGINAS_RESTAURABLES;
  return Math.min(paginas, topeDePaginas, MAX_PAGINAS_RESTAURABLES) * PRODUCTOS_POR_PAGINA;
}

/**
 * Saca el estado de la grilla de una URL.
 *
 * Se llama en TODOS los lugares que escriben filtros (los chips de categoría,
 * el panel, quitar un filtro, limpiar todo). Un filtro nuevo devuelve otro
 * conjunto de resultados: conservar "tenía 96 cargados" ahí pediría 96
 * productos de una lista que quizá tiene 7.
 */
export function limpiarEstadoDeGrilla(params: URLSearchParams): URLSearchParams {
  params.delete(PARAM_VER);
  return params;
}

/** `/tienda` para la página 1, `/tienda/N` para el resto. */
export function urlDePagina(pagina: number): string {
  return pagina <= 1 ? RUTA_TIENDA : `${RUTA_TIENDA}/${pagina}`;
}

/** Cuántas páginas indexables hay para un catálogo de `total` modelos. */
export function totalDePaginas(total: number): number {
  return Math.max(1, Math.ceil((total || 0) / PRODUCTOS_POR_PAGINA));
}
