import { JwtPayload } from '../models/auth.model';

function base64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface TestJwtOptions extends Partial<JwtPayload> {
  /** Segundos hasta el vencimiento desde ahora (negativo = ya vencido). Ignorado si se pasa `exp`. */
  expiresInSeconds?: number;
}

/** Arma un JWT de prueba (sin firma real) con los claims indicados. */
export function createJwt(options: TestJwtOptions = {}): string {
  const { expiresInSeconds = 900, ...claims } = options;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    sub: 'user-1',
    role: 'Employee',
    email: 'ana@example.com',
    name: 'Ana Pérez',
    jti: 'session-1',
    iat: nowSeconds,
    exp: nowSeconds + expiresInSeconds,
    ...claims,
  };
  return `${base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${base64Url(
    JSON.stringify(payload),
  )}.firma-de-prueba`;
}
