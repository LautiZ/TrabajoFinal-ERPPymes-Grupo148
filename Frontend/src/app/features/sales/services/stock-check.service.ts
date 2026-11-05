import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { StockConflict } from '../models/stock-conflict.model';
import { CartService } from './cart.service';
import { CatalogService } from './catalog.service';

/**
 * Verifica contra el backend que el stock del carrito siga alcanzando y ayuda a
 * corregir el carrito cuando no es así (ventas concurrentes, TES-64).
 */
@Injectable({
  providedIn: 'root',
})
export class StockCheckService {
  private readonly cart = inject(CartService);
  private readonly catalog = inject(CatalogService);

  /**
   * Refresca el stock de cada ítem del carrito y devuelve los que ya no alcanzan.
   * Un producto que el backend no devuelve (borrado o pausado) cuenta como sin stock.
   * Si no se puede leer un producto por un error de red, no se lo marca: lo decide el backend.
   */
  verify(): Observable<StockConflict[]> {
    const items = this.cart.items();
    return this.catalog.getProducts(items.map((item) => item.productId)).pipe(
      map((products) => {
        const conflicts: StockConflict[] = [];
        items.forEach((item, index) => {
          const product = products[index];
          if (product === undefined || product === null) {
            return;
          }
          const available = product.active ? product.stock : 0;
          this.cart.setStock(item.productId, available);
          if (item.quantity > available) {
            conflicts.push({
              productId: item.productId,
              name: item.name,
              requested: item.quantity,
              available,
            });
          }
        });
        return conflicts;
      }),
    );
  }

  /** Ajusta cada ítem en conflicto a lo disponible, o lo quita si ya no queda stock. */
  adjustToAvailable(conflicts: readonly StockConflict[]): void {
    for (const conflict of conflicts) {
      const item = this.cart.items().find((i) => i.productId === conflict.productId);
      if (!item) {
        continue;
      }
      const available = item.unit === 'Unit' ? Math.floor(conflict.available) : conflict.available;
      this.cart.setStock(conflict.productId, conflict.available);
      if (available <= 0) {
        this.cart.removeItem(conflict.productId);
      } else {
        this.cart.updateQuantity(conflict.productId, available);
      }
    }
  }

  /** Completa el nombre de los conflictos que el backend informó sin nombre. */
  withNames(conflicts: readonly StockConflict[]): StockConflict[] {
    const names = new Map(this.cart.items().map((item) => [item.productId, item.name]));
    return conflicts.map((c) => ({ ...c, name: c.name || names.get(c.productId) || 'Producto' }));
  }
}
