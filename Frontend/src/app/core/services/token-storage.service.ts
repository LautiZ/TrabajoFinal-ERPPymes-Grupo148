import { Injectable, InjectionToken, inject, signal } from '@angular/core';

/**
 * Storage donde se guarda el JWT. Es `sessionStorage`: se borra al cerrar la pestaña,
 * sobrevive al F5 y no se comparte entre pestañas. Inyectable para sustituirlo en tests.
 */
export const TOKEN_STORAGE = new InjectionToken<Storage | null>('TOKEN_STORAGE', {
  providedIn: 'root',
  factory: () => {
    try {
      return globalThis.sessionStorage ?? null;
    } catch {
      return null;
    }
  },
});

export const TOKEN_STORAGE_KEY = 'erp.auth.token';

/**
 * Único punto de acceso al JWT. `AuthService` y los interceptors lo leen y escriben solo a
 * través de este servicio: ningún otro archivo debe tocar `sessionStorage` o `localStorage`
 * para el token. Mantiene una copia en memoria (signal) para no releer el storage.
 */
@Injectable({
  providedIn: 'root',
})
export class TokenStorageService {
  private readonly storage = inject(TOKEN_STORAGE);
  private readonly _token = signal<string | null>(this.read());

  /** Token actual (o `null`), reactivo. */
  readonly token = this._token.asReadonly();

  get(): string | null {
    return this._token();
  }

  set(token: string): void {
    this._token.set(token);
    try {
      this.storage?.setItem(TOKEN_STORAGE_KEY, token);
    } catch {
      // Storage no disponible (modo privado, cuota): la sesión vale mientras la página siga abierta.
    }
  }

  clear(): void {
    this._token.set(null);
    try {
      this.storage?.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // Nada más que limpiar.
    }
  }

  private read(): string | null {
    try {
      return this.storage?.getItem(TOKEN_STORAGE_KEY) || null;
    } catch {
      return null;
    }
  }
}
