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

// Error code on a 409 when a receipt is asked for a sale that is not paid
export const SALE_NOT_PAID = 'SALE_NOT_PAID';

// Error code on a 409 when a manual change (cancel, dispatch) does not apply
// to the sale's current state
export const INVALID_SALE_STATE = 'INVALID_SALE_STATE';

// Point of sale prefix of every receipt number: 0001-00000123 (TES-76)
export const RECEIPT_POINT_OF_SALE = '0001';

/**
 * Minutes a sale in Ordered can open a payment (TES-75). Each Mercado Pago
 * order also expires this long after it is created, so the last moment a
 * sale can be paid is 2 windows after it was registered; only then does the
 * ERP cancel it and return its stock. Overridable per service with
 * SALE_PAYMENT_WINDOW_MINUTES (same value in ERP and Payments).
 */
export const DEFAULT_SALE_PAYMENT_WINDOW_MINUTES = 30;

// A date alone ("2026-11-17") would be read as UTC midnight, which is the day
// before in Argentina. Requiring time and offset removes the ambiguity.
export const ISO_WITH_OFFSET = /T.+(Z|[+-]\d{2}:\d{2})$/;

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

// A state change made by a user from the gateway; userId goes to the history (RN-10)
export class SaleTransitionMessage {
  @IsUUID()
  id!: string;

  @IsUUID()
  userId!: string;
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

// What the ERP knows of a receipt; the gateway adds the seller (Auth) and the
// payment reference (Payments) to build the full receipt
export interface SaleReceiptView {
  /** Correlative number assigned when the sale was paid, e.g. 0001-00000123 */
  receiptNumber: string;
  saleId: string;
  saleNumber: number;
  /** When the sale was paid: the moment the receipt number was assigned */
  issuedAt: Date;
  /** Employee who registered the sale (RN-12) */
  sellerId: string;
  items: SaleItemView[];
  /** Equal to the sum of the item subtotals */
  total: number;
}

export interface StockConflict {
  productId: string;
  name: string;
  requested: number;
  /** 0 when the product was deleted or paused */
  available: number;
}
