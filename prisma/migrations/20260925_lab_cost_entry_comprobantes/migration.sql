-- Los comprobantes de cada pedido de laboratorio, con su importe y el link
-- para verlos (portal de Grupo Óptico o correo de Optovisión). Pedido de
-- Ishtar del 25/9/2026: "en el cuadro dejame el link directo a ver las
-- facturas, para poder cruzar en nuestro sistema y en el de ellos".
--
-- Solo AGREGA una columna NULL-able: el deploy viejo sigue funcionando.

ALTER TABLE "LabCostEntry"
    ADD COLUMN IF NOT EXISTS "invoiceRefs" JSONB;
