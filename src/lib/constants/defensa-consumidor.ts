/**
 * Links y textos de defensa del consumidor que la tienda online tiene que
 * mostrar. Un solo lugar: los dos pies de página y el checkout leen de acá.
 *
 * Por qué (auditoría del 25/9/2026, confirmado el 28/9 en producción): el
 * sitio no tenía botón de arrepentimiento en ninguna página (/arrepentimiento
 * daba 404) ni link a la Ventanilla Federal de reclamos.
 *
 * Normativa citada por la auditoría: Disp. 954/2025 (botón de arrepentimiento,
 * reemplazó a la Res. SCI 424/2020) y Disp. 890/2025 (Ventanilla Federal Única
 * de Reclamos, vigente desde el 19/8/2025). El texto legal lo tiene que
 * confirmar quien lleve lo legal antes del deploy: ver
 * docs/legales-tienda-borrador-revision.md.
 */

/** Ruta del formulario del botón de arrepentimiento. */
export const RUTA_ARREPENTIMIENTO = '/arrepentimiento';

/** Cómo se llama el link: la norma pide que diga exactamente "Botón de arrepentimiento". */
export const TEXTO_BOTON_ARREPENTIMIENTO = 'Botón de arrepentimiento';

/**
 * Formulario de reclamos de la Ventanilla Federal Única. URL tomada de la
 * página oficial (argentina.gob.ar, "Ley simple: Ventanilla Federal Única",
 * consultada el 28/9/2026), que dice: "Los proveedores que tengan sitios de
 * internet o aplicaciones web deben incluir un enlace al formulario de
 * denuncia de la Ventanilla Federal Única". Redirige a
 * autogestion.produccion.gob.ar/consumidores.
 */
export const URL_VENTANILLA_FEDERAL_RECLAMOS = 'https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario';

export const TEXTO_VENTANILLA_FEDERAL = 'Defensa del consumidor: Ventanilla Federal de reclamos';
