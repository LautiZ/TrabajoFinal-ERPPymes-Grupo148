import { Role } from '../src/generated/prisma/client';
import { verifyPassword } from '../src/security/password';
import { AuthSeedClient, seedAuth } from './seed';

describe('seedAuth', () => {
  const owner = {
    email: 'owner@pyme.test',
    password: 'S3cure-Passw0rd!',
    name: 'Ana',
  };

  function mockClient(existingOwner: { id: string } | null) {
    const user = {
      findFirst: jest.fn().mockResolvedValue(existingOwner),
      create: jest.fn().mockResolvedValue({ id: 'new-owner-id' }),
    };
    return { client: { user } as unknown as AuthSeedClient, user };
  }

  it('creates the Owner with a hashed password when none exists', async () => {
    const { client, user } = mockClient(null);

    const id = await seedAuth(client, owner);

    expect(id).toBe('new-owner-id');
    const { data } = user.create.mock.calls[0][0];
    expect(data.role).toBe(Role.Owner);
    expect(data.email).toBe(owner.email);
    expect(data.passwordHash).not.toBe(owner.password);
    await expect(
      verifyPassword(data.passwordHash, owner.password),
    ).resolves.toBe(true);
  });

  it('reuses the existing Owner and never touches it', async () => {
    const { client, user } = mockClient({ id: 'existing-owner-id' });

    const id = await seedAuth(client, owner);

    expect(id).toBe('existing-owner-id');
    expect(user.create).not.toHaveBeenCalled();
  });
});
