-- Ítems tal como se facturaron (editables en el modal de emisión).
-- Antes se enviaban al backend pero solo servían para validar el tope de
-- monotributo: nunca se guardaban y el PDF se armaba con los ítems de la orden,
-- así que las ediciones de precio/descripción no aparecían en el comprobante.
ALTER TABLE "Invoice" ADD COLUMN "items" JSONB;
