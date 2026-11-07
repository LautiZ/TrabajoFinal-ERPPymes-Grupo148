import { PrismaClient, Role } from '../src/generated/prisma/client';
import { hashPassword } from '../src/security/password';

// Only the user model is needed, which keeps the function easy to mock in tests
export type AuthSeedClient = Pick<PrismaClient, 'user'>;

export interface OwnerSeed {
  email: string;
  password: string;
  name: string;
  surname?: string;
}

// Returns the Owner id so the orchestrator can hand it to the ERP seed.
// The database allows a single Owner (uq_users_single_owner), so the lookup is
// by role, not by email. An existing Owner is never modified: re-running the
// seed must not reset a real password.
export async function seedAuth(
  prisma: AuthSeedClient,
  owner: OwnerSeed,
): Promise<string> {
  const existing = await prisma.user.findFirst({
    where: { role: Role.Owner },
    select: { id: true },
  });

  if (existing) {
    console.log('[seed:auth] Owner already exists, skipping');
    return existing.id;
  }

  const created = await prisma.user.create({
    data: {
      email: owner.email,
      passwordHash: await hashPassword(owner.password),
      name: owner.name,
      surname: owner.surname,
      role: Role.Owner,
    },
    select: { id: true },
  });

  console.log(`[seed:auth] Owner created (${owner.email})`);
  return created.id;
}
