import { Prisma } from '../generated/prisma/client';

// P2002: unique constraint violated (e.g. repeated SKU or category name)
export const isUniqueViolation = (err: unknown): boolean =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
