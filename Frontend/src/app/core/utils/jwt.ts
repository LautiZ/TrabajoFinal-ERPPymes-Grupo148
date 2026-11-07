import { AuthUser, JwtPayload, isUserRole } from '../models/auth.model';

function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

/**
 * Lee los claims del JWT. NO verifica la firma (el cliente no puede ni debe): solo se usa para
 * mostrar el usuario, decidir qué menús ver y saber cuándo vence. Devuelve `null` si el token
 * está mal formado o le faltan claims necesarios.
 */
export function decodeJwt(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  try {
    const raw: unknown = JSON.parse(base64UrlDecode(parts[1]));
    if (typeof raw !== 'object' || raw === null) {
      return null;
    }
    const claims = raw as Record<string, unknown>;
    const { sub, role, exp, iat } = claims;
    if (
      typeof sub !== 'string' ||
      !sub ||
      !isUserRole(role) ||
      typeof exp !== 'number' ||
      !Number.isFinite(exp)
    ) {
      return null;
    }
    return {
      sub,
      role,
      exp,
      iat: typeof iat === 'number' ? iat : undefined,
      jti: optionalString(claims['jti']),
      email: optionalString(claims['email']),
      name: optionalString(claims['name']),
    };
  } catch {
    return null;
  }
}

/** Vencimiento del token en milisegundos desde epoch. */
export function expiresAtMs(payload: JwtPayload): number {
  return payload.exp * 1000;
}

export function isExpired(expiresAt: number, now: number = Date.now()): boolean {
  return now >= expiresAt;
}

export function toAuthUser(payload: JwtPayload): AuthUser {
  const email = payload.email ?? '';
  return {
    id: payload.sub,
    email,
    name: payload.name ?? (email ? email.split('@')[0] : 'Usuario'),
    role: payload.role,
  };
}
