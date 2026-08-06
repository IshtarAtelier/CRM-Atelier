// Tope de Monotributo por unidad facturada (precio unitario máximo por ítem).
// Lo validan el modal de facturación (UI) y billing.service (server): un solo
// valor acá para que nunca vuelvan a divergir.
export const MONOTRIBUTO_UNIT_PRICE_LIMIT = 700000;
