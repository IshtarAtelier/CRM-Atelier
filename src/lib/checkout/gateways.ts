import { isMercadoPagoEnabled } from '@/services/mercadopago.service';

/**
 * ¿Se muestra Payway como medio de pago en el checkout?
 *
 * Payway quedó OCULTO el 11/8/2026: convivir con Mercado Pago confundía al
 * comprador (dos cajas de "tarjeta" que se ven casi iguales) y el cartel del
 * panel de ventas atribuía a Payway cobros que en realidad habían entrado por
 * Mercado Pago. Mientras tanto Mercado Pago es la pasarela principal.
 *
 * La regla tiene una guarda deliberada: Payway REAPARECE solo si Mercado Pago
 * no está disponible. Sin eso, apagar `MP_ENABLED` un día dejaría la tienda sin
 * ninguna forma de pagar con tarjeta y la caída sería silenciosa — nadie mira
 * el checkout hasta que alguien avisa que no puede comprar.
 *
 * Para volver a mostrarlo junto a Mercado Pago: `PAYWAY_ENABLED=true` en
 * Railway. Se lee en cada request (la página del checkout es `force-dynamic`),
 * así que alcanza con reiniciar — no hace falta deploy de código.
 */
export function isPaywayEnabled(): boolean {
  if (process.env.PAYWAY_ENABLED === 'true') return true;
  return !isMercadoPagoEnabled();
}
