import { createJwt } from '../testing/jwt';
import { decodeJwt, expiresAtMs, isExpired, toAuthUser } from './jwt';

describe('decodeJwt', () => {
  it('lee los claims de un token válido', () => {
    const token = createJwt({ sub: 'u9', role: 'Admin', exp: 2_000_000_000, jti: 's1' });

    expect(decodeJwt(token)).toEqual({
      sub: 'u9',
      role: 'Admin',
      exp: 2_000_000_000,
      iat: expect.any(Number),
      jti: 's1',
      email: 'ana@example.com',
      name: 'Ana Pérez',
    });
  });

  it('decodifica caracteres no ASCII del payload', () => {
    expect(decodeJwt(createJwt({ name: 'José Ñandú' }))?.name).toBe('José Ñandú');
  });

  it('devuelve null si el token no tiene tres partes', () => {
    expect(decodeJwt('')).toBeNull();
    expect(decodeJwt('a.b')).toBeNull();
    expect(decodeJwt('a.b.c.d')).toBeNull();
  });

  it('devuelve null si el payload no es JSON o no es un objeto', () => {
    expect(decodeJwt('a.%%%.c')).toBeNull();
    expect(decodeJwt(`a.${btoa('no es json')}.c`)).toBeNull();
    expect(decodeJwt(`a.${btoa('"texto"')}.c`)).toBeNull();
    expect(decodeJwt(`a.${btoa('null')}.c`)).toBeNull();
  });

  it('devuelve null si faltan claims necesarios o son inválidos', () => {
    const withClaims = (claims: object): string => `a.${btoa(JSON.stringify(claims))}.c`;

    expect(decodeJwt(withClaims({ role: 'Admin', exp: 1 }))).toBeNull();
    expect(decodeJwt(withClaims({ sub: 'u', exp: 1 }))).toBeNull();
    expect(decodeJwt(withClaims({ sub: 'u', role: 'Admin' }))).toBeNull();
    expect(decodeJwt(withClaims({ sub: '', role: 'Admin', exp: 1 }))).toBeNull();
    expect(decodeJwt(withClaims({ sub: 'u', role: 'Superuser', exp: 1 }))).toBeNull();
    expect(decodeJwt(withClaims({ sub: 'u', role: 'Admin', exp: '1' }))).toBeNull();
  });

  it('ignora claims opcionales que no son texto', () => {
    const token = `a.${btoa(JSON.stringify({ sub: 'u', role: 'Owner', exp: 5, jti: 7, email: '  ' }))}.c`;

    expect(decodeJwt(token)).toMatchObject({ jti: undefined, email: undefined });
  });
});

describe('expiración', () => {
  it('expiresAtMs convierte los segundos del claim exp a milisegundos', () => {
    expect(expiresAtMs({ sub: 'u', role: 'Admin', exp: 1_000 })).toBe(1_000_000);
  });

  it('isExpired compara contra el instante indicado (vence justo en exp)', () => {
    expect(isExpired(1_000, 999)).toBe(false);
    expect(isExpired(1_000, 1_000)).toBe(true);
    expect(isExpired(1_000, 5_000)).toBe(true);
  });

  it('isExpired usa la hora actual por defecto', () => {
    expect(isExpired(Date.now() - 1)).toBe(true);
    expect(isExpired(Date.now() + 60_000)).toBe(false);
  });
});

describe('toAuthUser', () => {
  it('arma el usuario con id, email, nombre y rol', () => {
    expect(toAuthUser({ sub: 'u1', role: 'Owner', exp: 1, email: 'a@b.com', name: 'Ana' })).toEqual(
      {
        id: 'u1',
        email: 'a@b.com',
        name: 'Ana',
        role: 'Owner',
      },
    );
  });

  it('sin nombre usa la parte local del email, y sin ninguno un genérico', () => {
    expect(toAuthUser({ sub: 'u1', role: 'Admin', exp: 1, email: 'carlos@x.com' }).name).toBe(
      'carlos',
    );
    expect(toAuthUser({ sub: 'u1', role: 'Admin', exp: 1 })).toMatchObject({
      name: 'Usuario',
      email: '',
    });
  });
});
