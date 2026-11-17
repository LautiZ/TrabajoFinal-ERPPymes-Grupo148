import { HOME_PATH } from '../auth-paths';

function hasControlCharacters(value: string): boolean {
  return Array.from(value).some((char) => {
    const code = char.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

/**
 * Valida el `returnUrl` (a dónde volver tras iniciar sesión) para evitar redirecciones abiertas:
 * solo se aceptan rutas internas absolutas de la aplicación. Se descartan direcciones con otro
 * origen (`//sitio.com`, `https://…`, `javascript:…`), con barras invertidas o caracteres de
 * control, y las pantallas de autenticación (para no entrar en un bucle).
 */
export function safeReturnUrl(
  value: string | null | undefined,
  fallback: string = HOME_PATH,
): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return fallback;
  }
  if (value.includes('\\') || hasControlCharacters(value)) {
    return fallback;
  }
  if (value === '/auth' || value.startsWith('/auth/') || value.startsWith('/auth?')) {
    return fallback;
  }
  try {
    // Si al resolverla contra un origen cualquiera cambia el origen, no era una ruta interna.
    if (new URL(value, 'http://app.local').origin !== 'http://app.local') {
      return fallback;
    }
  } catch {
    return fallback;
  }
  return value;
}
