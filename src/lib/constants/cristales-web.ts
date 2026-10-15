/**
 * A partir de qué importe una opción de cristal de "Armá tus lentes" lleva una
 * línea que explique POR QUÉ cuesta eso.
 *
 * Medido el 15/10/2026 en producción: en multifocales, Varilux aparecía como
 * "+$1.404.103" al lado de Digital ONE "+$332.577" sin una palabra de por qué
 * uno vale cuatro veces el otro. Un salto así sin explicación se lee como
 * error o como abuso, y la persona cierra el modal.
 *
 * Propuesto en el plan tienda 15/10/2026 (tarea 2.4). El texto de la
 * explicación NO vive acá: sale del producto vinculado (su nombre y la
 * descripción de la opción en /admin/web), ver `explicacionSaltoPrecio`.
 */
export const UMBRAL_EXPLICAR_SALTO_PRECIO = 300_000;
