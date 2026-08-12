/**
 * Con qué pasarela entró el dinero de una venta web.
 *
 * El panel de ventas decía "pago acreditado vía Payway" con el nombre escrito a
 * mano, de cuando Payway era la única forma de cobrar con tarjeta. Cuando se
 * sumó Mercado Pago, ese cartel empezó a atribuirle a Payway cobros que habían
 * entrado por Mercado Pago: la pantalla afirmaba algo falso sobre plata real, y
 * quien fuera a conciliar contra el panel de la pasarela buscaba en la que no era.
 *
 * Se deduce de `Payment.notes` porque es el único campo que ya viaja al panel
 * (`payments` en /api/orders) y porque las filas viejas también lo tienen: sin
 * migración ni backfill, las ventas de antes quedan bien etiquetadas igual.
 * Ambas pasarelas escriben su nombre ahí — "Pago aprobado por Payway…" y
 * "Pago aprobado por Mercado Pago · …" (ver checkout/payway/route.ts y
 * finalize-web-payment.ts).
 *
 * Devuelve `null` si no se puede afirmar cuál fue. El llamador NO debe inventar
 * un nombre en ese caso: no decir la pasarela es correcto, decir la equivocada no.
 */
export function webPaymentGatewayLabel(
  payments?: ReadonlyArray<{ notes?: string | null }> | null,
): string | null {
  if (!payments?.length) return null;

  // Se recorre de atrás para adelante: si una venta tuvo varios intentos, el
  // que vale es el último acreditado.
  for (let i = payments.length - 1; i >= 0; i--) {
    const notas = (payments[i]?.notes || '').toLowerCase();
    if (notas.includes('mercado pago')) return 'Mercado Pago';
    if (notas.includes('payway')) return 'Payway';
  }
  return null;
}
