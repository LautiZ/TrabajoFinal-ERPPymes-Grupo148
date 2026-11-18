-- Receipt correlative, drawn when a sale is marked Paid (SalesRepository.markPaid).
-- Prisma cannot express a sequence that is not a column default, so it lives here.
CREATE SEQUENCE "sales_receipt_number_seq" AS INTEGER START WITH 1 OWNED BY "sales"."receipt_number";
