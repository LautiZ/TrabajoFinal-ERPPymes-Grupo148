// Mirrors the Role enum of the Auth Prisma schema.
// Kept as plain strings so contracts never depend on a generated Prisma client.
export const ROLES = ['Owner', 'Admin', 'Employee'] as const;

export type Role = (typeof ROLES)[number];
