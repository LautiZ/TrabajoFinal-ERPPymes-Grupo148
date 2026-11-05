/** Ítem del carrito cuyo stock cambió y ya no alcanza para la cantidad pedida. */
export interface StockConflict {
  productId: string;
  name: string;
  requested: number;
  available: number;
}
