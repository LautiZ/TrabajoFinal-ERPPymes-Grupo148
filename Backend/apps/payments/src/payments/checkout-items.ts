import type { SaleView } from '@app/contracts';
import { CheckoutItem } from '../mercadopago/mercadopago.client';

const toCents = (amount: number) => Math.round(amount * 100);

// Maps a sale to the lines Mercado Pago shows the buyer. Whatever the lines
// are, they must add up to the sale total, which is what the payment stores.
export const toCheckoutItems = (sale: SaleView): CheckoutItem[] => {
  const items = sale.items.map((item) =>
    Number.isInteger(item.quantity)
      ? {
          code: item.sku,
          title: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        }
      : // Weighed products (Kg, Meter, Liter) go as one line at their subtotal
        {
          code: item.sku,
          title: `${item.name} x ${item.quantity}`,
          quantity: 1,
          unitPrice: item.subtotal,
        },
  );

  // Subtotals are rounded per line in the ERP, so unitPrice x quantity can be a
  // cent away from the stored total. One line with the total is always exact.
  const itemsCents = items.reduce(
    (sum, item) => sum + toCents(item.unitPrice) * item.quantity,
    0,
  );
  if (itemsCents !== toCents(sale.total)) {
    return [
      {
        code: `VENTA-${sale.saleNumber}`,
        title: `Venta #${sale.saleNumber}`,
        quantity: 1,
        unitPrice: sale.total,
      },
    ];
  }
  return items;
};
