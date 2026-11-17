import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from './pagination.dto';

// Mirrors the ERP Prisma enum; contracts must not depend on a service's generated client
export const PRODUCT_UNITS = ['Unit', 'Kg', 'Meter', 'Liter'] as const;
export type ProductUnit = (typeof PRODUCT_UNITS)[number];

export const PRODUCT_SORT_FIELDS = [
  'name',
  'sku',
  'category',
  'price',
  'stock',
] as const;
export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number];

export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

// Filters: "low" = 0 < stock <= lowStockThreshold, "out" = stock 0
export const STOCK_STATUS_FILTERS = ['low', 'out'] as const;
export type StockStatusFilter = (typeof STOCK_STATUS_FILTERS)[number];

// Manual adjustments: the client sends a direction and a positive quantity (RN-03)
export const STOCK_ADJUSTMENT_TYPES = ['Income', 'Outcome'] as const;
export type StockAdjustmentType = (typeof STOCK_ADJUSTMENT_TYPES)[number];

// Upper bounds of the Decimal(12,2) and Decimal(12,3) columns: above them Postgres overflows
// Smallest positive value each column can store
export const MIN_PRICE = 0.01;
export const MIN_QUANTITY = 0.001;
export const MAX_PRICE = 9_999_999_999.99;
export const MAX_QUANTITY = 999_999_999.999;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Query params arrive as strings. Not @Type(() => Boolean): Boolean('false') is true
const toBoolean = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

export class ListProductsDto extends PaginationDto {
  /** Matches name or SKU (case-insensitive) */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(PRODUCT_SORT_FIELDS)
  sortBy: ProductSortField = 'name';

  @IsOptional()
  @IsIn(SORT_ORDERS)
  sortOrder: SortOrder = 'asc';

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  /** low: 0 < stock <= the product's lowStockThreshold; out: no stock */
  @IsOptional()
  @IsIn(STOCK_STATUS_FILTERS)
  stockStatus?: StockStatusFilter;

  /** true: only active products (the POS sends it); false: only paused ones; omitted: both */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  active?: boolean;

  /**
   * Deprecated and ignored: the threshold is now a field of each product.
   * Still accepted so older clients do not get a 400.
   * @deprecated
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  lowStockThreshold?: number;
}

export class CreateProductDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  /** Unique across all products, deleted ones included */
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  sku!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  // Not @IsPositive: the Swagger plugin documents it as minimum 1
  @Min(MIN_PRICE)
  @Max(MAX_PRICE)
  price!: number;

  /** Initial stock. Afterwards it only changes through stock movements (RN-01) */
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(MAX_QUANTITY)
  stock!: number;

  /** Integer quantities only for Unit; Kg, Meter and Liter accept decimals (RN-05) */
  @IsIn(PRODUCT_UNITS)
  unit!: ProductUnit;

  @IsUUID()
  categoryId!: string;

  /** false = paused for sale (RN-04) */
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  /** Stock at or below this value counts as low; 0 disables the alert */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(MAX_QUANTITY)
  lowStockThreshold?: number;
}

// Written out instead of PartialType: stock is not editable (RN-01) and the
// Swagger plugin only documents properties declared on the class itself
export class UpdateProductDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  sku?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  // Not @IsPositive: the Swagger plugin documents it as minimum 1
  @Min(MIN_PRICE)
  @Max(MAX_PRICE)
  price?: number;

  @IsOptional()
  @IsIn(PRODUCT_UNITS)
  unit?: ProductUnit;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(MAX_QUANTITY)
  lowStockThreshold?: number;
}

export class AdjustStockDto {
  @IsIn(STOCK_ADJUSTMENT_TYPES)
  type!: StockAdjustmentType;

  /** Always positive; the type gives the direction (RN-03) */
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(MIN_QUANTITY)
  @Max(MAX_QUANTITY)
  quantity!: number;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  reason!: string;
}

// TCP payloads: ids and userId come from the route and the validated session, never from the body
export class ProductIdMessage {
  @IsUUID()
  id!: string;
}

export class CreateProductMessage {
  @IsUUID()
  userId!: string;

  @ValidateNested()
  @Type(() => CreateProductDto)
  product!: CreateProductDto;
}

export class UpdateProductMessage {
  @IsUUID()
  id!: string;

  @ValidateNested()
  @Type(() => UpdateProductDto)
  product!: UpdateProductDto;
}

export class AdjustStockMessage {
  @IsUUID()
  id!: string;

  @IsUUID()
  userId!: string;

  @ValidateNested()
  @Type(() => AdjustStockDto)
  adjustment!: AdjustStockDto;
}

// Response shapes shared by the ERP MS (producer) and the gateway (docs)
export interface CategorySummary {
  id: string;
  name: string;
}

export interface ProductView {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  lowStockThreshold: number;
  unit: ProductUnit;
  categoryId: string;
  category: CategorySummary;
  active: boolean;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockSummary {
  total: number;
  ok: number;
  low: number;
  out: number;
}
