import { Injectable, InjectionToken, inject } from '@angular/core';
import { PurchaseSnapshot } from '../models/purchase-snapshot.model';

/**
 * Storage del último detalle de compra. Es `localStorage`: la pantalla pública de agradecimiento se
 * abre en otra pestaña (la del link de pago) y `sessionStorage` no se comparte entre pestañas.
 */
export const PURCHASE_STORAGE = new InjectionToken<Storage | null>('PURCHASE_STORAGE', {
  providedIn: 'root',
  factory: () => {
    try {
      return globalThis.localStorage ?? null;
    } catch {
      return null;
    }
  },
});

export const PURCHASE_SNAPSHOT_KEY = 'erp.sales.last-purchase.v1';

/** Pasado este tiempo el detalle ya no se ofrece cuando no hay una venta que lo identifique. */
export const PURCHASE_SNAPSHOT_TTL_MS = 2 * 60 * 60 * 1000;

/**
 * Guarda el detalle de la última compra (nombres y cantidades) en este navegador para mostrarlo en
 * la pantalla pública "Gracias por su compra". No hay un endpoint público en el backend para
 * consultar una venta, así que el detalle solo está si el comprador vuelve en el mismo navegador
 * donde se generó el pago.
 */
@Injectable({
  providedIn: 'root',
})
export class PurchaseSnapshotService {
  private readonly storage = inject(PURCHASE_STORAGE);

  save(snapshot: PurchaseSnapshot): void {
    try {
      this.storage?.setItem(PURCHASE_SNAPSHOT_KEY, JSON.stringify(snapshot));
    } catch {
      // Sin storage no hay detalle: la pantalla de agradecimiento funciona igual.
    }
  }

  /**
   * Detalle de la venta `saleId`; si el retorno no la informa, el último guardado y reciente.
   * `null` si no hay nada que mostrar.
   */
  find(saleId: string | null, now: number = Date.now()): PurchaseSnapshot | null {
    const snapshot = this.read();
    if (!snapshot) {
      return null;
    }
    if (saleId) {
      return snapshot.saleId === saleId ? snapshot : null;
    }
    return now - snapshot.createdAt <= PURCHASE_SNAPSHOT_TTL_MS ? snapshot : null;
  }

  private read(): PurchaseSnapshot | null {
    try {
      const raw = this.storage?.getItem(PURCHASE_SNAPSHOT_KEY);
      const value: unknown = raw ? JSON.parse(raw) : null;
      if (typeof value !== 'object' || value === null) {
        return null;
      }
      const { saleId, items, total, createdAt } = value as Partial<PurchaseSnapshot>;
      const valid =
        typeof saleId === 'string' &&
        typeof total === 'number' &&
        typeof createdAt === 'number' &&
        Array.isArray(items) &&
        items.every(
          (i) =>
            typeof i?.name === 'string' &&
            typeof i?.quantity === 'number' &&
            typeof i?.unit === 'string',
        );
      return valid ? (value as PurchaseSnapshot) : null;
    } catch {
      return null;
    }
  }
}
