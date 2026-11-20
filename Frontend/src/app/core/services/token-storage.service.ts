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
/** Perfil del usuario (nombre y apellido): el JWT no los trae, los entrega el login. */
export const PROFILE_STORAGE_KEY = 'erp.auth.profile';

export interface StoredProfile {
  id: string;
  name: string;
  surname?: string | null;
}

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

  /** Perfil guardado junto al token, o `null` si no hay o está dañado. */
  getProfile(): StoredProfile | null {
    try {
      const raw = this.storage?.getItem(PROFILE_STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (typeof parsed !== 'object' || parsed === null) {
        return null;
      }
      const { id, name } = parsed as Record<string, unknown>;
      return typeof id === 'string' && typeof name === 'string' ? (parsed as StoredProfile) : null;
    } catch {
      return null;
    }
  }

  setProfile(profile: StoredProfile): void {
    try {
      this.storage?.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Sin storage el perfil se pierde al recargar; se usa el que trae el token.
    }
  }

  clear(): void {
    this._token.set(null);
    try {
      this.storage?.removeItem(PROFILE_STORAGE_KEY);
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
