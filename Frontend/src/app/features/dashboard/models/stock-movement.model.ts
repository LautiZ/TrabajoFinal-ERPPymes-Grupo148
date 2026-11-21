export type MovementType = 'Income' | 'Outcome' | 'Adjustment';

export interface StockMovement {
  id: string;
  type: MovementType;
  /** `In`: entrada de stock; `Out`: salida. */
  direction: 'In' | 'Out';
  /** Siempre positiva; `direction` da el sentido. */
  quantity: number;
  /** Motivo de un ajuste manual; `null` en los movimientos del sistema. */
  reason: string | null;
  saleNumber: number | null;
  product: { id: string; name: string; sku: string };
  createdAt: string;
}

/** Motivo a mostrar: el del ajuste o uno derivado del origen del movimiento. */
export function movementReason(movement: StockMovement): string {
  if (movement.reason) {
    return movement.reason;
  }
  if (movement.saleNumber !== null) {
    return movement.type === 'Outcome'
      ? `Venta #${movement.saleNumber}`
      : `Cancelación de venta #${movement.saleNumber}`;
  }
  return movement.type === 'Income' ? 'Stock inicial' : '—';
}
