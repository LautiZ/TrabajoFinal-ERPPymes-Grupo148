import { Prisma } from '../generated/prisma/client';

const hasCode = (err: unknown, code: string): boolean =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;

// P2002: unique constraint violated (e.g. repeated SKU or category name)
export const isUniqueViolation = (err: unknown): boolean =>
  hasCode(err, 'P2002');

// P2034: write conflict or deadlock; P2028: transaction could not start or
// timed out (e.g. every pooled connection busy). Both are safe to retry.
export const isTransientTransactionError = (err: unknown): boolean =>
  hasCode(err, 'P2034') || hasCode(err, 'P2028');
