import { CartError } from '../services/cart.service';

export function describeCartError(reason: CartError, max?: number): string {
  switch (reason) {
    case 'inactive':
      return 'El producto está pausado y no se puede vender.';
    case 'out-of-stock':
      return 'El producto no tiene stock disponible.';
    case 'invalid-quantity':
      return 'La cantidad debe ser mayor a cero.';
    case 'integer-required':
      return 'Este producto solo admite cantidades enteras.';
    case 'exceeds-stock':
      return max === undefined
        ? 'La cantidad supera el stock disponible.'
        : `La cantidad supera el stock disponible (máximo ${max}).`;
    case 'not-found':
      return 'El producto ya no está en el carrito.';
  }
}
