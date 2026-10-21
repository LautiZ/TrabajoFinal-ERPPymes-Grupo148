-- =============================================================
-- Payments service seed data (DML)
-- Run after payments.sql. sale_id values reference sales from seed-erp.sql.
-- =============================================================

INSERT INTO "payments" ("id", "payment_state", "mp_payment_id", "amount", "sale_id") VALUES
  -- Sale 1: confirmed by the Mercado Pago webhook (RN-15)
  ('55555555-5555-5555-5555-000000000001', 'Paid', '1300000001', 12350.00, '44444444-4444-4444-4444-000000000001'),
  -- Sale 2: waiting for Mercado Pago confirmation
  ('55555555-5555-5555-5555-000000000002', 'Pending', NULL, 12000.00, '44444444-4444-4444-4444-000000000002');
