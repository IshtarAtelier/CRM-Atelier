-- Índice sobre Payment.date: usado por buildSearchWhere (acota el scan al
-- período visible) y por el aggregate/groupBy/count/findMany del mismo
-- endpoint de pagos, que filtran por date en cada carga de la pantalla.
CREATE INDEX IF NOT EXISTS "Payment_date_idx" ON "Payment"("date");
