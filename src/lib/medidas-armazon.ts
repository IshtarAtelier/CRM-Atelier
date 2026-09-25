/**
 * Medidas del armazón tal como están CARGADAS — nunca completadas.
 *
 * La ficha de producto dibujaba 52/18/42 mm cuando el armazón no tenía medidas,
 * ponía "Frente 12 mm" (la suma de campos vacíos más una constante) y mostraba
 * el alto de lente como calibre × 0,8. El catálogo PDF hacía lo mismo con
 * 52-18-145. Para el cliente eso es un dato: compra un armazón que le queda
 * chico o grande por una medida que nadie midió (auditoría del 25/9/2026).
 *
 * Regla: una medida que no está cargada no se dibuja, no se estima y no se
 * reemplaza por un valor típico. Se oculta o se ofrece consultarla.
 */

export interface MedidasArmazon {
  lensWidth: number | null;
  bridgeWidth: number | null;
  templeLength: number | null;
  frameHeight: number | null;
}

export type CampoMedida = keyof MedidasArmazon;

/** Orden y nombre con que se muestran. */
export const MEDIDAS_ARMAZON: readonly { campo: CampoMedida; etiqueta: string }[] = [
  { campo: 'lensWidth', etiqueta: 'Ancho de lente' },
  { campo: 'bridgeWidth', etiqueta: 'Puente' },
  { campo: 'templeLength', etiqueta: 'Largo de patilla' },
  { campo: 'frameHeight', etiqueta: 'Alto de lente' },
];

/** Un 0 o un vacío es "no cargada": ningún armazón mide 0 mm. */
export function medidaCargada(valor: number | null | undefined): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor > 0;
}

/** Las medidas que el armazón tiene de verdad, en el orden de `MEDIDAS_ARMAZON`. */
export function medidasCargadas(m: Partial<MedidasArmazon>) {
  return MEDIDAS_ARMAZON
    .filter(({ campo }) => medidaCargada(m[campo]))
    .map(({ campo, etiqueta }) => ({ campo, etiqueta, mm: m[campo] as number }));
}

/** Las que faltan, para decirle al cliente cuáles puede consultar. */
export function medidasFaltantes(m: Partial<MedidasArmazon>) {
  return MEDIDAS_ARMAZON.filter(({ campo }) => !medidaCargada(m[campo]));
}

/**
 * Notación de catálogo "calibre-puente-patilla" (ej. "52-18-145"), con "—"
 * donde falta una. `null` si no hay ninguna: mejor no imprimir nada que
 * imprimir "—-—-—".
 */
export function medidasCompactas(m: Partial<MedidasArmazon>): string | null {
  const campos: CampoMedida[] = ['lensWidth', 'bridgeWidth', 'templeLength'];
  if (!campos.some((c) => medidaCargada(m[c]))) return null;
  return campos.map((c) => (medidaCargada(m[c]) ? String(m[c]) : '—')).join('-');
}
