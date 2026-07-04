-- Índice compuesto para acelerar los anti-joins EXISTS/NOT EXISTS sobre
-- Client.orders { some/none } (contactos "sin atender", oportunidades de venta,
-- consultas de saldos). Cubre (clientId, orderType, isDeleted) en un solo índice.
CREATE INDEX IF NOT EXISTS "Order_clientId_orderType_isDeleted_idx" ON "Order"("clientId", "orderType", "isDeleted");
