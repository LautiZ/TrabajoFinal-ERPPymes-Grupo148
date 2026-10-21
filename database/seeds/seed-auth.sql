-- =============================================================
-- Auth service seed data (DML)
-- Run after auth.sql. Fixed UUIDs keep cross-service references
-- consistent with seed-erp.sql.
-- password_hash values are placeholders, not real credentials.
-- =============================================================

INSERT INTO "users" ("id", "email", "password_hash", "name", "surname", "role") VALUES
  ('11111111-1111-1111-1111-000000000001', 'owner@erp-pymes.test', '$2b$10$placeholderplaceholderplaceholderplaceholderplace', 'Laura', 'Gómez', 'Owner'),
  ('11111111-1111-1111-1111-000000000002', 'admin@erp-pymes.test', '$2b$10$placeholderplaceholderplaceholderplaceholderplace', 'Martín', 'Pérez', 'Admin'),
  ('11111111-1111-1111-1111-000000000003', 'employee@erp-pymes.test', '$2b$10$placeholderplaceholderplaceholderplaceholderplace', 'Sofía', NULL, 'Employee');
