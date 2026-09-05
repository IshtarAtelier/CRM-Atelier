// ────────────────────────────────────────────────────────────────────────────
// Conteo por faceta de un filtro — UN solo lugar, para todas las facetas.
//
// QUÉ PROBLEMA RESUELVE
// Antes de esto, `/api/store/products` tenía una función `contarPor` que solo
// sabía contar 3 facetas ('brand' | 'shape' | 'material'), con el "contra qué
// otros filtros se cuenta" escrito A MANO adentro de la función: agregar una
// faceta nueva (color, género, precio) significaba editar esa función y
// ensanchar su unión de tipos cada vez. Es exactamente lo que "escalable y
// modular" pide que deje de pasar.
//
// CÓMO SE USA AHORA
// Cada faceta se declara una vez, como un objeto: cómo sacarle el valor a un
// producto (un producto puede tener CERO, UNO o VARIOS valores — un armazón
// "negro y dorado" cuenta para las dos), y con eso `calcularFacetas` hace el
// resto: cuenta cada faceta contra TODAS las demás activas, nunca contra sí
// misma. Sumar una faceta nueva es agregar un objeto a la lista, no tocar la
// función de conteo.
//
// LA SEMÁNTICA QUE HAY QUE CONSERVAR (la aprendió la auditoría del 2/9/26)
// El conteo de una opción se calcula contra los OTROS filtros activos, nunca
// contra el propio: con "Titanio" puesto, "Cuadrado (5)" son los cuadrados de
// titanio, pero al contar las FORMAS no se aplica el filtro de forma — si no,
// elegida una forma, todas las demás darían cero y parecería que el catálogo
// se vació. Es la diferencia entre un contador útil y uno que miente.
// ────────────────────────────────────────────────────────────────────────────

/** Una faceta filtrable: cómo sacarle el/los valor(es) a un producto, y si el
 *  filtro activo de ESTA faceta coincide con un producto dado. */
export interface DefinicionFaceta<T> {
  /** Nombre estable de la faceta (clave en `conteos`, ej. "forma", "color"). */
  clave: string;
  /**
   * Valor(es) del producto para esta faceta. Devolver un array permite que un
   * producto cuente para más de una opción (el color "negro y dorado" cuenta
   * para Negro Y para Dorado). Un producto sin valor devuelve `[]`.
   */
  valoresDe: (item: T) => string[];
  /** ¿El filtro ACTIVO de esta faceta (si hay uno puesto) incluye a `item`?
   *  `filtroActivo` es `null` cuando no hay nada elegido en esta faceta —
   *  en ese caso siempre tiene que devolver `true` (nada que excluir). */
  coincide: (item: T, filtroActivo: string | null) => boolean;
}

/**
 * Cuenta cada faceta declarada contra las demás. Devuelve
 * `{ [claveDeFaceta]: { [valor]: cantidad } }`.
 *
 * `filtrosActivos` es `{ [claveDeFaceta]: valorElegido | null }` — el estado
 * actual de la URL. Al contar la faceta X, se filtra `items` por todas las
 * facetas MENOS X (esa es la regla de arriba).
 */
export function calcularFacetas<T>(
  items: readonly T[],
  facetas: readonly DefinicionFaceta<T>[],
  filtrosActivos: Record<string, string | null>,
): Record<string, Record<string, number>> {
  const resultado: Record<string, Record<string, number>> = {};

  for (const faceta of facetas) {
    const otras = facetas.filter(f => f.clave !== faceta.clave);
    const cuenta: Record<string, number> = {};

    for (const item of items) {
      const pasaLasOtras = otras.every(f => f.coincide(item, filtrosActivos[f.clave] ?? null));
      if (!pasaLasOtras) continue;

      for (const valor of faceta.valoresDe(item)) {
        if (!valor) continue;
        cuenta[valor] = (cuenta[valor] || 0) + 1;
      }
    }

    resultado[faceta.clave] = cuenta;
  }

  return resultado;
}

/**
 * Filtra `items` por TODAS las facetas cuyo `filtrosActivos[clave]` no sea
 * null — el filtrado real de la grilla, con la misma lista de facetas que usa
 * `calcularFacetas` (una sola declaración para contar Y para filtrar; antes
 * eran dos juegos de funciones —`coincideForma`/`contarPor`— que podían
 * divergir sin que nada avisara).
 */
export function filtrarPorFacetas<T>(
  items: readonly T[],
  facetas: readonly DefinicionFaceta<T>[],
  filtrosActivos: Record<string, string | null>,
): T[] {
  return items.filter(item =>
    facetas.every(f => f.coincide(item, filtrosActivos[f.clave] ?? null)),
  );
}

/**
 * Faceta de VALOR ÚNICO por comparación exacta (mayúsculas/minúsculas no
 * importan) — el caso más común: marca, forma, material. `extraerValor`
 * devuelve un solo string o null; se envuelve solo para `valoresDe`.
 */
export function facetaValorUnico<T>(
  clave: string,
  extraerValor: (item: T) => string | null | undefined,
): DefinicionFaceta<T> {
  return {
    clave,
    valoresDe: (item) => {
      const v = extraerValor(item);
      return v ? [v] : [];
    },
    coincide: (item, filtroActivo) => {
      if (!filtroActivo) return true;
      const v = extraerValor(item);
      return !!v && v.toUpperCase() === filtroActivo.toUpperCase();
    },
  };
}

/**
 * Faceta de VALORES MÚLTIPLES (ids ya normalizados, comparación exacta) — el
 * caso del color: un producto puede pertenecer a más de una familia.
 */
export function facetaValoresMultiples<T>(
  clave: string,
  extraerValores: (item: T) => string[],
): DefinicionFaceta<T> {
  return {
    clave,
    valoresDe: extraerValores,
    coincide: (item, filtroActivo) => {
      if (!filtroActivo) return true;
      return extraerValores(item).includes(filtroActivo);
    },
  };
}
