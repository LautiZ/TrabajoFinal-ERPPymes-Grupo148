import { Prisma } from '../generated/prisma/client';

// P2002: unique constraint violated (e.g. a second Pending payment for a sale)
export const isUniqueViolation = (err: unknown): boolean =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
