import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from './pagination.dto';
import { MAX_QUANTITY, MIN_QUANTITY } from './product.dto';

// Mirrors the ERP Prisma enum; contracts must not depend on a service's generated client
export const SALE_STATES = [
  'Ordered',
  'Paid',
  'Dispatched',
  'Cancelled',
] as const;
export type SaleState = (typeof SALE_STATES)[number];

// Error code the frontend looks for on a 409 (sales/utils/stock-conflict.ts)
export const INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK';

// Error code on a 409 when a payment arrives for a sale that was already cancelled
export const SALE_CANCELLED = 'SALE_CANCELLED';

// A date alone ("2026-11-17") would be read as UTC midnight, which is the day
// before in Argentina. Requiring time and offset removes the ambiguity.
const ISO_WITH_OFFSET = /T.+(Z|[+-]\d{2}:\d{2})$/;

export class SaleItemDto {
  @IsUUID()
  productId!: string;

  /** Whole numbers for Unit products; decimals only for Kg, Meter and Liter (RN-05) */
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(MIN_QUANTITY)
  @Max(MAX_QUANTITY)
  quantity!: number;
}

// The client never sends prices or totals: the backend computes them (RN-06)
export class CreateSaleDto {
  /** One line per product: a repeated productId is rejected */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique((item: SaleItemDto) => item.productId, {
    message: 'each product can appear only once in a sale',
  })
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items!: SaleItemDto[];
}

export class ListSalesDto extends PaginationDto {
  @IsOptional()
  @IsIn(SALE_STATES)
  state?: SaleState;

  /** Inclusive lower bound on createdAt. ISO 8601 with time and offset, e.g. 2026-11-17T00:00:00-03:00 */
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(ISO_WITH_OFFSET, { message: 'from must include time and offset' })
  from?: string;

  /** Exclusive upper bound on createdAt. Same format as from */
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(ISO_WITH_OFFSET, { message: 'to must include time and offset' })
  to?: string;
}

// TCP payloads: userId comes from the validated session, never from the body
export class CreateSaleMessage {
  @IsUUID()
  userId!: string;

  @ValidateNested()
  @Type(() => CreateSaleDto)
  sale!: CreateSaleDto;
}

export class SaleIdMessage {
  @IsUUID()
  id!: string;
}

// Response shapes shared by the ERP MS (producer) and the gateway (docs)
export interface SaleItemView {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  /** Price at the moment of the sale (RN-07) */
  unitPrice: number;
  /** unitPrice * quantity, rounded half-up to 2 decimals */
  subtotal: number;
}

export interface SaleHistoryView {
  state: SaleState;
  /** null when the system made the change, e.g. a payment webhook (RN-10) */
  userId: string | null;
  createdAt: Date;
}

export interface SaleSummaryView {
  id: string;
  saleNumber: number;
  /** Assigned only when the sale is paid */
  receiptNumber: number | null;
  total: number;
  currentState: SaleState;
  userId: string;
  itemCount: number;
  createdAt: Date;
}

export interface SaleView extends SaleSummaryView {
  items: SaleItemView[];
  history: SaleHistoryView[];
}

export interface StockConflict {
  productId: string;
  name: string;
  requested: number;
  /** 0 when the product was deleted or paused */
  available: number;
}
