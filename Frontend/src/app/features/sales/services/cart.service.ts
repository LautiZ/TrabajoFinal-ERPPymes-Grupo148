import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { CartItem } from '../models/cart.model';
import { CatalogProduct, ProductUnit, allowsDecimals } from '../models/product.model';

/** Storage donde se persiste el carrito. Inyectable para poder sustituirlo en tests. */
export const CART_STORAGE = new InjectionToken<Storage | null>('CART_STORAGE', {
  providedIn: 'root',
  factory: () => {
    try {
      return globalThis.sessionStorage ?? null;
    } catch {
      return null;
    }
  },
});

export const CART_STORAGE_KEY = 'erp.sales.cart.v1';

export type CartError =
  | 'inactive'
  | 'out-of-stock'
  | 'invalid-quantity'
  | 'integer-required'
  | 'exceeds-stock'
  | 'not-found';

export type CartResult = { ok: true } | { ok: false; reason: CartError; max?: number };

const OK: CartResult = { ok: true };

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
const round3 = (value: number): number => Math.round((value + Number.EPSILON) * 1000) / 1000;

export function lineTotal(item: Pick<CartItem, 'unitPrice' | 'quantity'>): number {
  return round2(item.unitPrice * item.quantity);
}

@Injectable({
  providedIn: 'root',
})
export class CartService {
  private readonly storage = inject(CART_STORAGE);
  private readonly _items = signal<CartItem[]>(this.restore());

  readonly items = this._items.asReadonly();
  /** Cantidad de líneas (productos distintos) del carrito. */
  readonly itemCount = computed(() => this._items().length);
  readonly subtotal = computed(() =>
    round2(this._items().reduce((sum, item) => sum + lineTotal(item), 0)),
  );
  /** Sin impuestos ni descuentos en el alcance actual: coincide con el subtotal. */
  readonly total = computed(() => this.subtotal());
  readonly isEmpty = computed(() => this._items().length === 0);

  addItem(product: CatalogProduct, quantity = 1): CartResult {
    if (!product.active) {
      return { ok: false, reason: 'inactive' };
    }
    if (product.stock <= 0) {
      return { ok: false, reason: 'out-of-stock' };
    }
    const invalid = this.validateQuantity(product.unit, quantity);
    if (invalid) {
      return invalid;
    }

    const current = this._items().find((item) => item.productId === product.id);
    const nextQuantity = round3((current?.quantity ?? 0) + quantity);
    if (nextQuantity > product.stock) {
      return { ok: false, reason: 'exceeds-stock', max: product.stock };
    }

    const next: CartItem = {
      productId: product.id,
      name: product.name,
      sku: product.sku,
      unitPrice: product.price,
      quantity: nextQuantity,
      stock: product.stock,
      unit: product.unit,
    };
    this.commit(
      current
        ? this._items().map((item) => (item.productId === product.id ? next : item))
        : [...this._items(), next],
    );
    return OK;
  }

  /** Fija la cantidad de un ítem. Una cantidad <= 0 quita el ítem del carrito. */
  updateQuantity(productId: string, quantity: number): CartResult {
    const current = this._items().find((item) => item.productId === productId);
    if (!current) {
      return { ok: false, reason: 'not-found' };
    }
    if (Number.isFinite(quantity) && quantity <= 0) {
      this.removeItem(productId);
      return OK;
    }
    const invalid = this.validateQuantity(current.unit, quantity);
    if (invalid) {
      return invalid;
    }

    const rounded = round3(quantity);
    if (rounded > current.stock) {
      return { ok: false, reason: 'exceeds-stock', max: current.stock };
    }
    this.commit(
      this._items().map((item) =>
        item.productId === productId ? { ...item, quantity: rounded } : item,
      ),
    );
    return OK;
  }

  removeItem(productId: string): void {
    this.commit(this._items().filter((item) => item.productId !== productId));
  }

  clear(): void {
    this.commit([]);
  }

  /** Actualiza el último stock conocido de un ítem (no modifica la cantidad). */
  setStock(productId: string, stock: number): void {
    if (!Number.isFinite(stock) || stock < 0) {
      return;
    }
    this.commit(
      this._items().map((item) => (item.productId === productId ? { ...item, stock } : item)),
    );
  }

  private validateQuantity(unit: ProductUnit, quantity: number): CartResult | null {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { ok: false, reason: 'invalid-quantity' };
    }
    if (!allowsDecimals(unit) && !Number.isInteger(quantity)) {
      return { ok: false, reason: 'integer-required' };
    }
    return null;
  }

  private commit(items: CartItem[]): void {
    this._items.set(items);
    try {
      this.storage?.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Sin storage disponible (modo privado, cuota): el carrito sigue funcionando en memoria.
    }
  }

  private restore(): CartItem[] {
    try {
      const raw = this.storage?.getItem(CART_STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(isCartItem) : [];
    } catch {
      return [];
    }
  }
}

function isCartItem(value: unknown): value is CartItem {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const item = value as Record<string, unknown>;
  return (
    typeof item['productId'] === 'string' &&
    typeof item['name'] === 'string' &&
    typeof item['sku'] === 'string' &&
    typeof item['unitPrice'] === 'number' &&
    typeof item['quantity'] === 'number' &&
    item['quantity'] > 0 &&
    typeof item['stock'] === 'number' &&
    (item['unit'] === 'Unit' ||
      item['unit'] === 'Kg' ||
      item['unit'] === 'Meter' ||
      item['unit'] === 'Liter')
  );
}
