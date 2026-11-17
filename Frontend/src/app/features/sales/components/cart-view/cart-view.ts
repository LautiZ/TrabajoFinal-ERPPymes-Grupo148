import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { NotificationService } from '../../../../shared/services/notification.service';
import { CartItem } from '../../models/cart.model';
import { UNIT_LABELS } from '../../models/product.model';
import { CartService, lineTotal } from '../../services/cart.service';
import { describeCartError } from '../../utils/cart-messages';

@Component({
  selector: 'app-cart-view',
  imports: [CurrencyPipe, MatButtonModule, MatIconModule],
  templateUrl: './cart-view.html',
  styleUrl: './cart-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartView {
  protected readonly cart = inject(CartService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);

  /** El estado vacío invita a buscar productos; el padre decide cómo (p. ej. enfocar el buscador). */
  readonly browse = output<void>();

  protected readonly unitLabels = UNIT_LABELS;
  protected readonly lineTotal = lineTotal;

  protected increase(item: CartItem): void {
    this.apply(item, item.quantity + 1);
  }

  protected decrease(item: CartItem): void {
    this.apply(item, item.quantity - 1);
  }

  protected onQuantityInput(item: CartItem, input: HTMLInputElement): void {
    const value = input.valueAsNumber;
    if (Number.isNaN(value)) {
      input.value = String(item.quantity);
      return;
    }
    if (!this.apply(item, value)) {
      input.value = String(item.quantity);
    }
  }

  protected remove(item: CartItem): void {
    this.cart.removeItem(item.productId);
  }

  protected checkout(): void {
    if (this.cart.isEmpty()) {
      return;
    }
    void this.router.navigate(['/sales', 'checkout']);
  }

  private apply(item: CartItem, quantity: number): boolean {
    const result = this.cart.updateQuantity(item.productId, quantity);
    if (!result.ok) {
      this.notify.error(describeCartError(result.reason, result.max));
    }
    return result.ok;
  }
}
