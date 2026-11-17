import { ApiProperty } from '@nestjs/swagger';
import {
  PRODUCT_UNITS,
  type CategorySummary,
  type PaginatedResponse,
  type ProductUnit,
  type ProductView,
  type StockSummary,
} from '@app/contracts';
import { PageMetaDto } from '../../common/dto/page-meta.dto';

// HTTP response shapes only: documented for Swagger, not validated.
// `implements` keeps them in sync with what the ERP MS returns.
export class CategorySummaryDto implements CategorySummary {
  id!: string;
  /** @example Bebidas */
  name!: string;
}

export class ProductResponseDto implements ProductView {
  id!: string;
  /** @example Coca-Cola 2.25L */
  name!: string;
  /** @example BEB-001 */
  sku!: string;
  /** @example 2500.5 */
  price!: number;
  /** @example 40 */
  stock!: number;
  /** Stock at or below this value counts as low; 0 disables the alert */
  lowStockThreshold!: number;
  @ApiProperty({ enum: PRODUCT_UNITS })
  unit!: ProductUnit;
  categoryId!: string;
  category!: CategorySummaryDto;
  /** false = paused for sale (RN-04) */
  active!: boolean;
  deleted!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}

export class ProductPageResponseDto implements PaginatedResponse<ProductView> {
  data!: ProductResponseDto[];
  meta!: PageMetaDto;
}

export class StockSummaryResponseDto implements StockSummary {
  /** Products in the catalog (deleted ones excluded) */
  total!: number;
  /** stock above the product's lowStockThreshold */
  ok!: number;
  /** 0 < stock <= lowStockThreshold */
  low!: number;
  /** stock 0 */
  out!: number;
}
