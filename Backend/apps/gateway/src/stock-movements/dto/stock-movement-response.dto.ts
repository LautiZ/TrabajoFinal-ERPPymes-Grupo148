import { ApiProperty } from '@nestjs/swagger';
import {
  MOVEMENT_TYPES,
  type MovementDirection,
  type MovementType,
  type PaginatedResponse,
  type StockMovementView,
} from '@app/contracts';
import { PageMetaDto } from '../../common/dto/page-meta.dto';

// HTTP response shapes only: documented for Swagger, not validated
export class StockMovementProductDto {
  id!: string;
  /** @example Yerba 1kg */
  name!: string;
  /** @example YER-001 */
  sku!: string;
}

export class StockMovementResponseDto implements StockMovementView {
  id!: string;
  @ApiProperty({ enum: MOVEMENT_TYPES })
  type!: MovementType;
  @ApiProperty({ enum: ['In', 'Out'] })
  direction!: MovementDirection;
  /** Always positive; direction gives the sign @example 2 */
  quantity!: number;
  /** Reason of a manual Adjustment; null on system movements */
  reason!: string | null;
  /** Sale that caused the movement (sale or its cancellation), if any */
  saleNumber!: number | null;
  product!: StockMovementProductDto;
  createdAt!: Date;
}

export class StockMovementPageResponseDto implements PaginatedResponse<StockMovementView> {
  data!: StockMovementResponseDto[];
  meta!: PageMetaDto;
}
