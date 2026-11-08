import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';

// argon2id: OWASP's first choice for password storage. It is memory-hard,
// which makes GPU brute-force attacks expensive. The salt is random per hash
// and is stored inside the resulting string, so no extra column is needed.
export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}

// Hash of a random value nobody knows, computed once at startup. When the
// email does not exist we still verify against it, so a missing user takes
// as long as a wrong password and response time does not reveal valid emails.
const dummyHash = hashPassword(randomUUID());

export async function verifyPasswordOrDummy(
  hash: string | null,
  plain: string,
): Promise<boolean> {
  if (hash === null) {
    await argon2.verify(await dummyHash, plain);
    return false;
  }
  return argon2.verify(hash, plain);
}
