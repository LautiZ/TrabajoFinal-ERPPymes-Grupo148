import * as argon2 from 'argon2';

// argon2id: OWASP's first choice for password storage. It is memory-hard,
// which makes GPU brute-force attacks expensive. The salt is random per hash
// and is stored inside the resulting string, so no extra column is needed.
export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}
