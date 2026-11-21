import { PaginationDto } from './pagination.dto';

// Mirrors the ERP Prisma enum; contracts must not depend on a service's generated client
export const MOVEMENT_TYPES = ['Income', 'Outcome', 'Adjustment'] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

/** In: stock entered; Out: stock left. Adjustments take it from their sign. */
export type MovementDirection = 'In' | 'Out';

// Newest first; only pagination for now
export class ListStockMovementsDto extends PaginationDto {}

export interface StockMovementView {
  id: string;
  type: MovementType;
  direction: MovementDirection;
  /** Always positive; direction gives the sign */
  quantity: number;
  /** Required on manual Adjustments; null on movements made by the system */
  reason: string | null;
  /** Sale that caused the movement (sale outcome or cancel reversal), if any */
  saleNumber: number | null;
  product: { id: string; name: string; sku: string };
  createdAt: Date;
}
