import { randomUUID } from 'crypto';
import {
  hashPassword,
  verifyPassword,
  verifyPasswordOrDummy,
} from './password';

describe('password', () => {
  // Generated at runtime so secret scanners never see a literal password
  const plain = randomUUID();

  it('hashes with argon2id', async () => {
    const hash = await hashPassword(plain);

    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain(plain);
  });

  it('uses a random salt, so the same password gives different hashes', async () => {
    const [a, b] = await Promise.all([
      hashPassword(plain),
      hashPassword(plain),
    ]);

    expect(a).not.toBe(b);
  });

  it('verifies the correct password', async () => {
    const hash = await hashPassword(plain);

    await expect(verifyPassword(hash, plain)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword(plain);

    await expect(verifyPassword(hash, 'wrong-password')).resolves.toBe(false);
  });

  it('returns false for a missing user (dummy hash path)', async () => {
    await expect(verifyPasswordOrDummy(null, 'whatever')).resolves.toBe(false);
  });

  it('returns false instead of throwing on a malformed hash', async () => {
    await expect(verifyPasswordOrDummy('not-a-hash', 'x')).resolves.toBe(false);
  });
});
