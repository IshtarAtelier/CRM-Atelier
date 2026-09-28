/**
 * Compradores que no son personas.
 *
 * El robot de Google Merchant Center recorre la tienda todas las mañanas
 * (~07:30) para verificar que se pueda comprar: agrega un producto, entra al
 * checkout y deja un mail de `storebotmail.joonix.net`. Hasta el 28/9/2026 esos
 * checkouts se guardaban como carritos abandonados comunes: el cron le mandaba
 * los mails de recupero, el panel de Oportunidades de Cierre los mostraba como
 * clientes y la campaña de carritos los contaba. En 45 días, los 14 carritos
 * "abandonados con datos" eran todos de este robot.
 *
 * Se guardan igual (la verificación de Google tiene que poder completar el
 * checkout) pero con `status = ESTADO_ROBOT`, que ningún lector cuenta como
 * carrito abierto.
 */
export const ESTADO_ROBOT = 'BOT';

const DOMINIOS_ROBOT = ['storebotmail.joonix.net'];

export function esCompradorRobot(email?: string | null): boolean {
  const dominio = String(email || '').trim().toLowerCase().split('@')[1];
  return Boolean(dominio) && DOMINIOS_ROBOT.includes(dominio);
}

/**
 * Filtro para las consultas de carritos: deja afuera también los checkouts del
 * robot guardados ANTES de que existiera ESTADO_ROBOT (quedaron como PENDING,
 * EMAIL_SENT o FINALIZED). Se combina con el `where` de cada lector.
 */
export const SIN_ROBOTS = {
  NOT: DOMINIOS_ROBOT.map((d) => ({ email: { endsWith: `@${d}` } })),
};
