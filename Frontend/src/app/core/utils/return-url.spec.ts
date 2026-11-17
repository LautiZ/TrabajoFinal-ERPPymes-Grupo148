import { safeReturnUrl } from './return-url';

describe('safeReturnUrl', () => {
  it('acepta rutas internas, con query y fragmento', () => {
    expect(safeReturnUrl('/inventory')).toBe('/inventory');
    expect(safeReturnUrl('/inventory?page=2&search=caf')).toBe('/inventory?page=2&search=caf');
    expect(safeReturnUrl('/sales/payment/success?external_reference=abc')).toBe(
      '/sales/payment/success?external_reference=abc',
    );
    expect(safeReturnUrl('/inventory/p1/edit#top')).toBe('/inventory/p1/edit#top');
  });

  it('sin valor vuelve al panel (o al fallback indicado)', () => {
    expect(safeReturnUrl(null)).toBe('/dashboard');
    expect(safeReturnUrl(undefined)).toBe('/dashboard');
    expect(safeReturnUrl('')).toBe('/dashboard');
    expect(safeReturnUrl(null, '/otra')).toBe('/otra');
  });

  it('rechaza direcciones de otro origen (redirección abierta)', () => {
    expect(safeReturnUrl('https://evil.com')).toBe('/dashboard');
    expect(safeReturnUrl('http://evil.com/inventory')).toBe('/dashboard');
    expect(safeReturnUrl('//evil.com')).toBe('/dashboard');
    expect(safeReturnUrl('//evil.com/inventory')).toBe('/dashboard');
    expect(safeReturnUrl('evil.com')).toBe('/dashboard');
  });

  it('rechaza esquemas peligrosos', () => {
    expect(safeReturnUrl('javascript:alert(1)')).toBe('/dashboard');
    expect(safeReturnUrl('data:text/html,<script>')).toBe('/dashboard');
  });

  it('rechaza barras invertidas y caracteres de control', () => {
    expect(safeReturnUrl('/\\evil.com')).toBe('/dashboard');
    expect(safeReturnUrl('/inventory\\..\\x')).toBe('/dashboard');
    expect(safeReturnUrl('/inventory\n')).toBe('/dashboard');
    expect(safeReturnUrl('/inv\u0000entory')).toBe('/dashboard');
  });

  it('rechaza las pantallas de autenticación para no entrar en un bucle', () => {
    expect(safeReturnUrl('/auth/login')).toBe('/dashboard');
    expect(safeReturnUrl('/auth/login?returnUrl=%2Fx')).toBe('/dashboard');
    expect(safeReturnUrl('/auth/register')).toBe('/dashboard');
    expect(safeReturnUrl('/auth')).toBe('/dashboard');
  });

  it('no confunde rutas que solo empiezan parecido a /auth', () => {
    expect(safeReturnUrl('/authors')).toBe('/authors');
  });
});
