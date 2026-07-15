// ────────────────────────────────────────────────────────────────────────────
// Fuente de verdad de la compuerta de "enviar a fábrica" / "convertir en venta".
//
// La regla de la seña mínima y la autorización del administrador vivían duplicadas
// en el cliente (CheckoutModal) y en el servidor (order.service, contact.service),
// con umbrales que llegaron a divergir (cliente 40% vs servidor 50%) y un botón que
// ignoraba la autorización. Este módulo centraliza esa lógica para que NO pueda
// volver a desincronizarse entre capas.
//
// IMPORTANTE: módulo PURO — sin imports de servidor (prisma, 'server-only', fs) para
// que también pueda importarse desde componentes 'use client'.
// ────────────────────────────────────────────────────────────────────────────

/** Proporción mínima de la seña sobre el total del pedido para habilitar el envío. */
export const MIN_DEPOSIT_RATIO = 0.5;

/** Seña mínima (monto) requerida para un total dado. */
export function minimumDeposit(total: number | null | undefined): number {
  return (total || 0) * MIN_DEPOSIT_RATIO;
}

/** ¿El pago cubre la seña mínima? (sin considerar la autorización del admin) */
export function meetsMinimumDeposit(
  paid: number | null | undefined,
  total: number | null | undefined,
): boolean {
  return (paid || 0) >= minimumDeposit(total);
}

/**
 * Autorización efectiva: prioriza el valor entrante en el request sobre el guardado
 * en la base. Así, autorizar y enviar en un mismo PATCH también funciona y no se lee
 * un valor viejo (evita el footgun de "autoricé pero el gate seguía bloqueando").
 */
export function effectiveAuthorization(
  incoming: boolean | null | undefined,
  persisted: boolean | null | undefined,
): boolean {
  return incoming ?? persisted ?? false;
}

export interface FactoryDepositGate {
  paid: number | null | undefined;
  total: number | null | undefined;
  authorizedByAdmin?: boolean | null;
}

/**
 * Compuerta de PAGO para enviar a fábrica / convertir en venta.
 * `true` si la seña cubre el mínimo O si un administrador autorizó la excepción.
 * No evalúa receta / armazón / email / método de pago: esas validaciones van aparte.
 */
export function depositClearsFactoryGate({ paid, total, authorizedByAdmin }: FactoryDepositGate): boolean {
  return !!authorizedByAdmin || meetsMinimumDeposit(paid, total);
}

/** Solo un administrador puede autorizar una seña menor al mínimo. */
export function canAuthorizeLowDeposit(role: string | null | undefined): boolean {
  return role === 'ADMIN';
}
