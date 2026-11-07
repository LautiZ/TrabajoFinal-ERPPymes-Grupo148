import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { DEFAULT_LOW_STOCK_THRESHOLD } from '../utils/stock-status';

/** Storage donde se recuerda el umbral elegido. Inyectable para poder sustituirlo en tests. */
export const INVENTORY_STORAGE = new InjectionToken<Storage | null>('INVENTORY_STORAGE', {
  providedIn: 'root',
  factory: () => {
    try {
      return globalThis.localStorage ?? null;
    } catch {
      return null;
    }
  },
});

export const LOW_STOCK_THRESHOLD_KEY = 'erp.inventory.low-stock-threshold.v1';
export const MAX_LOW_STOCK_THRESHOLD = 100_000;

/**
 * Umbral configurable de "stock bajo". Es una preferencia de este navegador: el producto
 * no tiene un mínimo propio en el modelo de datos.
 */
@Injectable({
  providedIn: 'root',
})
export class LowStockThresholdService {
  private readonly storage = inject(INVENTORY_STORAGE);
  private readonly _value = signal(this.restore());

  readonly value = this._value.asReadonly();

  /** Cambia el umbral. Devuelve `false` (sin cambios) si el valor no es válido. */
  set(value: number): boolean {
    if (!Number.isFinite(value) || value < 0 || value > MAX_LOW_STOCK_THRESHOLD) {
      return false;
    }
    const rounded = Math.round(value * 1000) / 1000;
    this._value.set(rounded);
    try {
      this.storage?.setItem(LOW_STOCK_THRESHOLD_KEY, String(rounded));
    } catch {
      // Sin storage (modo privado, cuota): el umbral vale solo mientras la pestaña esté abierta.
    }
    return true;
  }

  private restore(): number {
    try {
      const raw = this.storage?.getItem(LOW_STOCK_THRESHOLD_KEY);
      if (raw === null || raw === undefined || raw === '') {
        return DEFAULT_LOW_STOCK_THRESHOLD;
      }
      const parsed = Number(raw);
      return Number.isFinite(parsed) && parsed >= 0 && parsed <= MAX_LOW_STOCK_THRESHOLD
        ? parsed
        : DEFAULT_LOW_STOCK_THRESHOLD;
    } catch {
      return DEFAULT_LOW_STOCK_THRESHOLD;
    }
  }
}
